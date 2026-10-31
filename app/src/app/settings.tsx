import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, ToastAndroid, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatBaht } from '@/lib/amount';
import { listBills, type Bill } from '@/lib/bills';
import { exportCsv } from '@/lib/csv';
import { setSetting } from '@/lib/db';
import { localError } from '@/lib/errors';
import { ensurePermission, getReminderSettings, saveReminderSettings, type ReminderSettings } from '@/lib/reminders';
import { getBudget } from '@/lib/stats';

export default function SettingsScreen() {
  const [budget, setBudget] = useState(''); // ตามที่พิมพ์ (บาท เต็มจำนวน)
  const [reminders, setReminders] = useState<ReminderSettings | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [exporting, setExporting] = useState(false);

  // กลับมาจากหน้าแก้บิลแล้วรายการต้องอัปเดต → โหลดทุกครั้งที่หน้านี้ถูกโฟกัส
  useFocusEffect(
    useCallback(() => {
      Promise.all([getBudget(), getReminderSettings(), listBills()]).then(
        ([b, r, list]) => {
          setBudget(b ? String(b) : '');
          setReminders(r);
          setBills(list);
        },
        (e) => ToastAndroid.show(localError('โหลดการตั้งค่า', e), ToastAndroid.LONG),
      );
    }, []),
  );

  async function saveBudget() {
    const baht = Math.round(Number(budget));
    const value = baht > 0 ? String(baht * 100) : null; // ว่าง/0 = ไม่ใช้งบ
    try {
      await setSetting('budget_satang', value);
      setBudget(value ? String(baht) : '');
      ToastAndroid.show(value ? `ตั้งงบเดือนละ ${formatBaht(baht)} แล้ว` : 'ปิดงบประมาณแล้ว', ToastAndroid.SHORT);
    } catch (e) {
      ToastAndroid.show(localError('บันทึกงบ', e), ToastAndroid.LONG);
    }
  }

  async function updateReminders(next: ReminderSettings) {
    const turningOn = (next.daily && !reminders?.daily) || (next.bills && !reminders?.bills);
    if (turningOn && !(await ensurePermission())) {
      ToastAndroid.show('ยังไม่ได้อนุญาตการแจ้งเตือน — เปิดได้ที่ ตั้งค่า Android › แอป › Expense', ToastAndroid.LONG);
      return;
    }
    setReminders(next);
    saveReminderSettings(next).catch((e) => ToastAndroid.show(localError('ตั้งการแจ้งเตือน', e), ToastAndroid.LONG));
  }

  function pickTime() {
    if (!reminders) return;
    const [h, m] = reminders.time.split(':').map(Number);
    DateTimePickerAndroid.open({
      value: new Date(2000, 0, 1, h, m),
      mode: 'time',
      is24Hour: true,
      onValueChange: (_event, d) =>
        updateReminders({ ...reminders, time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }),
    });
  }

  async function onExport() {
    setExporting(true);
    try {
      const n = await exportCsv();
      ToastAndroid.show(`สร้างไฟล์ ${n} รายการแล้ว`, ToastAndroid.SHORT);
    } catch (e) {
      ToastAndroid.show(localError('export', e), ToastAndroid.LONG);
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Section title="งบประมาณรายเดือน" hint="หน้าสรุปจะบอกว่าใช้ไปกี่ % และเหลือใช้ได้วันละเท่าไร · เว้นว่าง = ไม่ใช้งบ">
        <View style={styles.row}>
          <Text style={styles.label}>งบเดือนละ</Text>
          <View style={styles.budgetBox}>
            <Text style={styles.label}>฿</Text>
            <TextInput
              style={styles.budgetInput}
              value={budget}
              onChangeText={(t) => setBudget(t.replace(/\D/g, ''))}
              onEndEditing={saveBudget}
              keyboardType="number-pad"
              placeholder="12000"
              placeholderTextColor={Colors.textSecondary}
              maxLength={7}
            />
          </View>
        </View>
      </Section>

      <Section title="แจ้งเตือน" hint="เตือนเฉพาะวันที่ยังไม่ได้บันทึกอะไรเลย">
        {reminders ? (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>เตือนบันทึกทุกคืน</Text>
              <Switch
                value={reminders.daily}
                onValueChange={(v) => updateReminders({ ...reminders, daily: v })}
                trackColor={{ true: Colors.primary, false: Colors.lemon }}
                thumbColor={Colors.surface}
              />
            </View>
            <Pressable style={styles.row} onPress={pickTime} disabled={!reminders.daily}>
              <Text style={[styles.label, !reminders.daily && styles.dim]}>เวลา</Text>
              <Text style={[styles.value, !reminders.daily && styles.dim]}>{reminders.time} ›</Text>
            </Pressable>
            <View style={styles.row}>
              <Text style={styles.label}>เตือนวันครบกำหนดบิล (9:00)</Text>
              <Switch
                value={reminders.bills}
                onValueChange={(v) => updateReminders({ ...reminders, bills: v })}
                trackColor={{ true: Colors.primary, false: Colors.lemon }}
                thumbColor={Colors.surface}
              />
            </View>
          </>
        ) : (
          <ActivityIndicator color={Colors.primary} />
        )}
      </Section>

      <Section title="บิลประจำเดือน" hint='ถึงวันแล้วจะขึ้นบนหน้าสรุป กด "จ่ายแล้ว" ครั้งเดียวก็บันทึกเป็นรายจ่าย'>
        {bills.map((b) => (
          <Pressable
            key={b.id}
            style={styles.row}
            onPress={() => router.push({ pathname: '/bill/[id]', params: { id: String(b.id) } })}>
            <Text style={styles.label}>
              {b.category.icon} {b.name} <Text style={styles.small}>· ทุกวันที่ {b.dayOfMonth}</Text>
            </Text>
            <Text style={styles.value}>{formatBaht(b.amount)} ›</Text>
          </Pressable>
        ))}
        <Pressable style={styles.row} onPress={() => router.push({ pathname: '/bill/[id]', params: { id: 'new' } })}>
          <Text style={styles.link}>＋ เพิ่มบิล</Text>
        </Pressable>
      </Section>

      <Section title="ข้อมูล">
        <Pressable style={styles.row} onPress={() => router.push('/backup')}>
          <View style={styles.inline}>
            <Ionicons name="archive-outline" size={18} color={Colors.text} />
            <Text style={styles.label}>สำรอง / กู้คืนข้อมูล</Text>
          </View>
          <Text style={styles.value}>›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={onExport} disabled={exporting}>
          <View style={styles.inline}>
            <Ionicons name="document-text-outline" size={18} color={Colors.text} />
            <Text style={styles.label}>Export เป็น CSV (เปิดใน Excel ได้)</Text>
          </View>
          {exporting ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.value}>›</Text>}
        </Pressable>
      </Section>
    </ScrollView>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {children}
      {hint && <Text style={styles.small}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.one },
  title: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text, marginBottom: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: Spacing.two },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexShrink: 1 },
  label: { fontSize: FontSize.body, color: Colors.text, flexShrink: 1 },
  value: { fontSize: FontSize.body, color: Colors.text, fontWeight: '600' },
  small: { fontSize: FontSize.caption, color: Colors.textSecondary },
  link: { fontSize: FontSize.body, color: Colors.chart, fontWeight: '600' },
  dim: { opacity: 0.35 },
  budgetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: Colors.lemon,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    minWidth: 120,
  },
  budgetInput: { flex: 1, paddingVertical: 6, fontSize: FontSize.body, fontWeight: '600', color: Colors.text, textAlign: 'right' },
});
