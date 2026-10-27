import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatBaht } from '@/lib/amount';
import { THAI_MONTHS_SHORT } from '@/lib/date';
import type { MonthTotal } from '@/lib/types';

const CHART_HEIGHT = 90;

type Props = {
  months: MonthTotal[]; // เก่า→ใหม่ ตัวสุดท้ายคือเดือนที่กำลังดู
  lastIsPartial: boolean; // เดือนล่าสุดยังไม่จบ → ติด * ไว้
};

function shortLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${THAI_MONTHS_SHORT[m - 1]} ${String(y + 543).slice(-2)}`;
}

/** แท่ง 6 เดือนย้อนหลัง — แตะแท่งเพื่อดูยอดเดือนนั้น (บนมือถือไม่มี hover เลยใช้แตะแทน) */
export function MonthBars({ months, lastIsPartial }: Props) {
  const [selected, setSelected] = useState(months.length - 1);
  const max = Math.max(...months.map((m) => m.total), 1);
  const picked = months[Math.min(selected, months.length - 1)];

  return (
    <View>
      <Text style={styles.readout}>
        {picked && `${shortLabel(picked.month)}: ${formatBaht(picked.total)}`}
        {picked && lastIsPartial && picked === months[months.length - 1] ? ' (ยังไม่จบเดือน)' : ''}
      </Text>
      <View style={styles.plot}>
        {months.map((m, i) => (
          <Pressable
            key={m.month}
            onPress={() => setSelected(i)}
            style={styles.column}
            accessibilityLabel={`${shortLabel(m.month)} ${formatBaht(m.total)}`}>
            <View
              style={[
                styles.bar,
                {
                  height: m.total > 0 ? Math.max((m.total / max) * CHART_HEIGHT, 4) : 0,
                  backgroundColor: i === months.length - 1 ? Colors.chart : Colors.chartMuted,
                },
                i === selected && styles.barSelected,
              ]}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.labels}>
        {months.map((m, i) => (
          <Text key={m.month} style={[styles.label, i === months.length - 1 && styles.labelCurrent]}>
            {THAI_MONTHS_SHORT[Number(m.month.slice(5)) - 1]}
            {i === months.length - 1 && lastIsPartial ? '*' : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { fontSize: FontSize.caption, color: Colors.text, marginBottom: Spacing.two, fontWeight: '600' },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    height: CHART_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lemon,
  },
  // พื้นที่แตะเต็มความสูงคอลัมน์ ใหญ่กว่าตัวแท่ง — แตะง่ายแม้แท่งเตี้ย
  column: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: Radius.sm / 2, borderTopRightRadius: Radius.sm / 2 },
  barSelected: { borderWidth: 2, borderBottomWidth: 0, borderColor: Colors.text },
  labels: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  label: { flex: 1, textAlign: 'center', fontSize: FontSize.caption, color: Colors.textSecondary },
  labelCurrent: { color: Colors.text, fontWeight: '700' },
});
