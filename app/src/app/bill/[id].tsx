import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, ToastAndroid, View } from 'react-native';

import { CategoryGrid } from '@/components/category-grid';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { deleteBill, getBill, saveBill } from '@/lib/bills';
import { getCategories } from '@/lib/db';
import { localError } from '@/lib/errors';
import { refreshRemindersQuietly } from '@/lib/reminders';
import type { Category } from '@/lib/types';

const BILL_CATEGORY_ID = 6; // บิล/ค่าน้ำไฟ — ค่าเริ่มต้นของบิลใหม่

/** เพิ่ม (id = "new") หรือแก้บิลประจำเดือน */
export default function BillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const billId = id === 'new' ? null : Number(id);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(1);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getCategories(), billId === null ? null : getBill(billId)]).then(
      ([cats, bill]) => {
        setCategories(cats);
        if (bill) {
          setName(bill.name);
          setAmount(String(bill.amount));
          setDay(bill.dayOfMonth);
          setCategoryId(bill.category.id);
        } else {
          setDay(new Date().getDate());
          setCategoryId(cats.some((c) => c.id === BILL_CATEGORY_ID) ? BILL_CATEGORY_ID : (cats[0]?.id ?? null));
        }
      },
      (e) => ToastAndroid.show(localError('โหลดบิล', e), ToastAndroid.LONG),
    );
  }, [billId]);

  const valid = name.trim() !== '' && Number(amount) > 0 && categoryId !== null;

  async function onSave() {
    if (!valid || categoryId === null) {
      ToastAndroid.show('ใส่ชื่อและยอดเงินก่อน', ToastAndroid.SHORT);
      return;
    }
    setSaving(true);
    try {
      await saveBill(billId, { name: name.trim(), amount: Number(amount).toFixed(2), dayOfMonth: day, categoryId });
      refreshRemindersQuietly();
      router.back();
    } catch (e) {
      ToastAndroid.show(localError('บันทึกบิล', e), ToastAndroid.LONG);
      setSaving(false);
    }
  }

  function onDelete() {
    if (billId === null) return;
    Alert.alert('ลบบิลนี้?', 'รายจ่ายที่เคยบันทึกจากบิลนี้ยังอยู่ครบ', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: () =>
          deleteBill(billId).then(
            () => {
              refreshRemindersQuietly();
              router.back();
            },
            (e) => ToastAndroid.show(localError('ลบบิล', e), ToastAndroid.LONG),
          ),
      },
    ]);
  }

  if (!categories) return <ActivityIndicator color={Colors.primary} style={styles.loading} />;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: billId === null ? 'เพิ่มบิล' : 'แก้ไขบิล' }} />

      <Text style={styles.label}>ชื่อบิล</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="ค่าเน็ตบ้าน"
        placeholderTextColor={Colors.textSecondary}
        maxLength={60}
      />

      <Text style={styles.label}>ยอดต่อเดือน (บาท)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))}
        placeholder="599"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="decimal-pad"
        maxLength={10}
      />

      <Text style={styles.label}>จ่ายทุกวันที่</Text>
      <View style={styles.stepper}>
        <StepButton label="−" onPress={() => setDay((d) => (d === 1 ? 31 : d - 1))} />
        <Text style={styles.day}>{day}</Text>
        <StepButton label="＋" onPress={() => setDay((d) => (d === 31 ? 1 : d + 1))} />
      </View>
      {day > 28 && <Text style={styles.hint}>เดือนที่มีไม่ถึง {day} วัน จะนับเป็นวันสุดท้ายของเดือน</Text>}

      <Text style={styles.label}>หมวด</Text>
      <CategoryGrid categories={categories} selectedId={categoryId} onSelect={setCategoryId} />

      <Pressable
        onPress={onSave}
        disabled={saving}
        style={({ pressed }) => [styles.save, !valid && styles.saveDim, (pressed || saving) && styles.pressed]}>
        {saving ? <ActivityIndicator color={Colors.text} /> : <Text style={styles.saveText}>บันทึกบิล</Text>}
      </Pressable>
      {billId !== null && (
        <Pressable onPress={onDelete} style={styles.delete}>
          <Text style={styles.deleteText}>ลบบิลนี้</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.step, pressed && styles.pressed]} hitSlop={8}>
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: Spacing.six },
  container: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  label: { fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: Spacing.two },
  hint: { fontSize: FontSize.caption, color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lemon,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  step: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.butter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  day: { fontSize: FontSize.big, fontWeight: '800', color: Colors.text, minWidth: 48, textAlign: 'center' },
  save: {
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  saveDim: { backgroundColor: Colors.lemon },
  pressed: { opacity: 0.7 },
  saveText: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  delete: { alignItems: 'center', padding: Spacing.three },
  deleteText: { fontSize: FontSize.body, color: Colors.danger },
});
