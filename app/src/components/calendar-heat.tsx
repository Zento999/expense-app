import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { THAI_WEEKDAYS_SHORT } from '@/lib/date';

// 0 = ไม่ได้ใช้ → เข้มขึ้นตามยอด (เทียบกับวันที่ใช้มากสุดของเดือน)
const LEVELS = [Colors.chartTrack, Colors.butter, Colors.honey, Colors.primarySoft, Colors.primary];

function level(total: number, max: number): number {
  if (total <= 0) return 0;
  return Math.min(LEVELS.length - 1, 1 + Math.floor((total / max) * (LEVELS.length - 1) - 0.0001));
}

type Props = {
  month: Date; // วันที่ 1 ของเดือน
  totals: Map<number, number>; // วันที่ → ยอด
  onPressDay: (day: number) => void;
};

/** ปฏิทินเดือน — สีเข้ม = วันที่ใช้เยอะ แตะเพื่อดูรายการวันนั้น */
export function CalendarHeat({ month, totals, onPressDay }: Props) {
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = month.getDay(); // ช่องว่างก่อนวันที่ 1 (อาทิตย์ = 0)
  const max = Math.max(0, ...totals.values());
  const now = new Date();
  const isThisMonth = now.getFullYear() === month.getFullYear() && now.getMonth() === month.getMonth();

  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <View style={styles.grid}>
      {THAI_WEEKDAYS_SHORT.map((w) => (
        <Text key={w} style={styles.weekday}>
          {w}
        </Text>
      ))}
      {cells.map((day, i) => {
        if (day === null) return <View key={`e${i}`} style={styles.cell} />;
        const total = totals.get(day) ?? 0;
        const future = isThisMonth && day > now.getDate();
        const lv = level(total, max);
        return (
          <Pressable
            key={day}
            onPress={() => onPressDay(day)}
            disabled={future || total === 0}
            accessibilityLabel={`วันที่ ${day} ใช้ ${total} บาท`}
            style={styles.cell}>
            <View
              style={[
                styles.day,
                { backgroundColor: future ? 'transparent' : LEVELS[lv] },
                isThisMonth && day === now.getDate() && styles.today,
              ]}>
              <Text style={[styles.dayText, future && styles.future, lv === LEVELS.length - 1 && styles.dayStrong]}>
                {day}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.one },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, color: Colors.textSecondary },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  day: { flex: 1, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  today: { borderColor: Colors.text },
  dayText: { fontSize: FontSize.caption, color: Colors.text },
  dayStrong: { fontWeight: '800' },
  future: { color: Colors.textSecondary, opacity: 0.5 },
});
