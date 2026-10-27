import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatBaht } from '@/lib/amount';
import { monthLabel } from '@/lib/date';

type Props = {
  month: Date;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  caption: string; // บรรทัดเหนือตัวเลข เช่น "ใช้ไปทั้งเดือน" / "เฉพาะ อาหาร"
  total: number;
  muted?: boolean; // สีอ่อน = ตัวเลขนี้ไม่ใช่ยอดทั้งเดือน (กำลังกรองอยู่)
  children?: ReactNode; // ส่วนท้ายการ์ด แต่ละหน้าใส่ต่างกัน
};

/** การ์ดยอดรวมรายเดือน — ตัวเลขใหญ่สุดในหน้า ใช้ทั้งหน้าสรุปและหน้าประวัติ */
export function MonthTotalCard({ month, canGoNext, onPrev, onNext, caption, total, muted, children }: Props) {
  return (
    <View style={[styles.card, { backgroundColor: muted ? Colors.butter : Colors.primarySoft }]}>
      <View style={styles.monthRow}>
        <Pressable onPress={onPrev} hitSlop={16} accessibilityLabel="เดือนก่อน">
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.month}>{monthLabel(month)}</Text>
        <Pressable onPress={onNext} disabled={!canGoNext} hitSlop={16} accessibilityLabel="เดือนถัดไป">
          <Ionicons name="chevron-forward" size={24} color={Colors.text} style={!canGoNext && styles.disabled} />
        </Pressable>
      </View>
      <Text style={styles.caption}>{caption}</Text>
      <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>
        {formatBaht(total)}
      </Text>
      {children}
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
});
