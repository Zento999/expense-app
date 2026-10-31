import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatBaht } from '@/lib/amount';
import type { BudgetStatus } from '@/lib/stats';

// น้องใบเสร็จ: สีหน้าตามความเร็วการใช้เงิน (ไม่ใช่แค่ % — วันที่ 5 ใช้ไป 50% ก็ต้องกังวลแล้ว)
const MOOD = {
  happy: { face: '😊', note: 'ใช้ตามแผน' },
  meh: { face: '😐', note: 'เร็วกว่าแผนนิดนึง' },
  worried: { face: '😵', note: 'ใช้เร็วไปแล้ว' },
} as const;

/** หลอดงบในการ์ดยอดเดือน */
export function BudgetMeter({ status }: { status: BudgetStatus }) {
  const mood = MOOD[status.mood];
  return (
    <View style={styles.wrap}>
      <View style={styles.face} accessibilityLabel={mood.note}>
        <Text style={styles.faceText}>{mood.face}</Text>
      </View>
      <View style={styles.flex}>
        <View style={styles.track}>
          <View style={[styles.bar, { width: `${Math.min(status.percent, 100)}%` }, status.over > 0 && styles.barOver]} />
        </View>
        <View style={styles.row}>
          <Text style={styles.text}>
            {status.percent}% ของงบ {formatBaht(status.budget)}
          </Text>
          <Text style={[styles.text, styles.strong]}>
            {status.over > 0 ? `เกินงบ ${formatBaht(status.over)}` : `เหลือวันละ ${formatBaht(status.perDayLeft)}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  flex: { flex: 1, gap: Spacing.one },
  face: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceText: { fontSize: 24 },
  track: { height: 10, borderRadius: Radius.full, backgroundColor: 'rgba(255, 255, 255, 0.6)', overflow: 'hidden' },
  bar: { height: 10, borderRadius: Radius.full, backgroundColor: Colors.text },
  barOver: { backgroundColor: Colors.danger },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  text: { fontSize: FontSize.caption, color: Colors.text },
  strong: { fontWeight: '700' },
});
