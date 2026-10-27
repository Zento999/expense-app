import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatBaht } from '@/lib/amount';
import { monthLabel } from '@/lib/date';

type Props = {
  month: Date;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  total: number; // ยอดของสิ่งที่แสดงอยู่ (กรองแล้ว)
  count: number;
  monthTotal: number; // ยอดทั้งเดือน (ไม่กรอง) ไว้เทียบสัดส่วน
  filterLabel: string | null; // null = ไม่ได้กรอง
};

/** การ์ดยอดรวมรายเดือน — ตัวเลขใหญ่สุดในหน้า, กรองแล้วบอกสัดส่วนเทียบทั้งเดือน */
export function MonthTotalCard({ month, canGoNext, onPrev, onNext, total, count, monthTotal, filterLabel }: Props) {
  const filtered = filterLabel !== null;
  const share = monthTotal > 0 ? Math.round((total / monthTotal) * 100) : 0;

  return (
    // สีอ่อนลงตอนกรอง = สัญญาณว่าตัวเลขนี้ไม่ใช่ยอดทั้งเดือน
    <View style={[styles.card, { backgroundColor: filtered ? Colors.butter : Colors.primarySoft }]}>
      <View style={styles.monthRow}>
        <Pressable onPress={onPrev} hitSlop={16} accessibilityLabel="เดือนก่อน">
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.month}>{monthLabel(month)}</Text>
        <Pressable onPress={onNext} disabled={!canGoNext} hitSlop={16} accessibilityLabel="เดือนถัดไป">
          <Ionicons name="chevron-forward" size={24} color={Colors.text} style={!canGoNext && styles.disabled} />
        </Pressable>
      </View>

      <Text style={styles.caption}>{filterLabel ?? 'ใช้ไปทั้งเดือน'}</Text>
      <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>
        {formatBaht(total)}
      </Text>
      <Text style={styles.caption}>
        {count} รายการ{filtered && ` · ${share}% ของทั้งเดือน ${formatBaht(monthTotal)}`}
      </Text>
      {filtered && (
        <View style={styles.track}>
          <View style={[styles.bar, { width: `${Math.min(share, 100)}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.half },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text },
  disabled: { opacity: 0.25 },
  caption: { textAlign: 'center', fontSize: FontSize.caption, color: Colors.text },
  total: { textAlign: 'center', fontSize: 40, fontWeight: '800', color: Colors.text },
  track: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    marginTop: Spacing.two,
    overflow: 'hidden',
  },
  bar: { height: 6, borderRadius: Radius.full, backgroundColor: Colors.text },
});
