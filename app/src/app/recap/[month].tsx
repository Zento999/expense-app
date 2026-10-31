import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatBaht } from '@/lib/amount';
import { monthLabel, shortDate, THAI_MONTHS_SHORT } from '@/lib/date';
import { localError } from '@/lib/errors';
import { getMonthRecap, type Medal, type MonthRecap } from '@/lib/recap';

const MEDAL: Record<Medal, { emoji: string; title: string }> = {
  gold: { emoji: '🥇', title: 'เหรียญทอง' },
  silver: { emoji: '🥈', title: 'เหรียญเงิน' },
  bronze: { emoji: '🥉', title: 'เหรียญทองแดง' },
  ribbon: { emoji: '🎗️', title: 'ให้กำลังใจ' },
};

/** สรุปเดือน (/recap/2026-10) — ส่วนการ์ดถ่ายเป็นรูปแชร์ได้ */
export default function RecapScreen() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const [recap, setRecap] = useState<MonthRecap | null>(null);
  const [sharing, setSharing] = useState(false);
  const shotRef = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    getMonthRecap(month).then(setRecap, (e) => ToastAndroid.show(localError('โหลดสรุปเดือน', e), ToastAndroid.LONG));
  }, [month]);

  async function onShare() {
    setSharing(true);
    try {
      // ถ่ายรูปเฉพาะการ์ด (ไม่รวมปุ่ม) เป็นไฟล์ชั่วคราว แล้วเปิดหน้าแชร์ของ Android
      const uri = await captureRef(shotRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'แชร์สรุปเดือน' });
    } catch (e) {
      ToastAndroid.show(localError('สร้างรูป', e), ToastAndroid.LONG);
    } finally {
      setSharing(false);
    }
  }

  if (!recap) return <ActivityIndicator color={Colors.primary} style={styles.loading} />;

  const [y, m] = recap.month.split('-').map(Number);
  const prevName = THAI_MONTHS_SHORT[(m + 10) % 12];
  const medal = MEDAL[recap.medal];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: `สรุป ${THAI_MONTHS_SHORT[m - 1]}` }} />

      {/* collapsable={false}: ให้ Android สร้าง view จริง ไม่งั้นถ่ายรูปไม่ได้ */}
      <View ref={shotRef} collapsable={false} style={styles.shot}>
        <View style={styles.hero}>
          <Text style={styles.heroCaption}>สรุปเดือน{monthLabel(new Date(y, m - 1, 1))}</Text>
          <Text style={styles.medal}>{medal.emoji}</Text>
          <Text style={styles.medalTitle}>
            {medal.title} · {recap.medalReason}
          </Text>
          <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>
            {formatBaht(recap.total)}
          </Text>
          <Text style={styles.heroCaption}>
            {recap.budget !== null && `${recap.budgetPercent}% ของงบ ${formatBaht(recap.budget)} · `}
            {recap.count} รายการ
          </Text>
        </View>

        <View style={styles.card}>
          {recap.topCategory && (
            <Row
              label="หมวดที่ใช้มากสุด"
              value={`${recap.topCategory.category.icon} ${recap.topCategory.category.name} ${formatBaht(recap.topCategory.total)}`}
            />
          )}
          {recap.heaviestDay && (
            <Row label="วันที่ใช้หนักสุด" value={`${shortDate(recap.heaviestDay.date)} ${formatBaht(recap.heaviestDay.total)}`} />
          )}
          <Row label="บันทึกต่อเนื่องยาวสุด" value={`🔥 ${recap.longestStreak} วัน`} />
          <Row label="วันที่มีบันทึก" value={`${recap.loggedDays} / ${recap.daysInMonth} วัน`} />
          {recap.changePercent !== null && (
            <Row
              label={`เทียบ ${prevName} (${formatBaht(recap.prevTotal)})`}
              value={recap.changePercent <= 0 ? `น้อยลง ${-recap.changePercent}%` : `มากขึ้น ${recap.changePercent}%`}
              color={recap.changePercent <= 0 ? Colors.success : Colors.danger}
            />
          )}
        </View>
        <Text style={styles.brand}>🧾 Expense</Text>
      </View>

      <Pressable
        onPress={onShare}
        disabled={sharing}
        style={({ pressed }) => [styles.share, (pressed || sharing) && styles.pressed]}>
        {sharing ? (
          <ActivityIndicator color={Colors.text} />
        ) : (
          <>
            <Ionicons name="share-social-outline" size={20} color={Colors.text} />
            <Text style={styles.shareText}>บันทึก / แชร์เป็นรูป</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, color !== undefined && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: Spacing.six },
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  shot: { backgroundColor: Colors.background, gap: Spacing.three, padding: Spacing.two, borderRadius: Radius.lg },
  hero: { backgroundColor: Colors.primarySoft, borderRadius: Radius.lg, padding: Spacing.four, alignItems: 'center', gap: Spacing.one },
  heroCaption: { fontSize: FontSize.caption, color: Colors.text, textAlign: 'center' },
  medal: { fontSize: 56, marginVertical: Spacing.one },
  medalTitle: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  total: { fontSize: 40, fontWeight: '800', color: Colors.text, marginTop: Spacing.two },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  rowLabel: { fontSize: FontSize.caption, color: Colors.textSecondary, flexShrink: 1 },
  rowValue: { fontSize: FontSize.body, color: Colors.text, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  brand: { fontSize: FontSize.caption, color: Colors.textSecondary, textAlign: 'center' },
  share: {
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pressed: { opacity: 0.7 },
  shareText: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
});
