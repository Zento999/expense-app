import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatBaht } from '@/lib/amount';
import type { CategoryTotal } from '@/lib/types';

const TOP_N = 4; // หมวดที่เหลือรวมเป็น "อื่นๆ" — กันรายการยาวจนอ่านยาก

type Props = {
  items: CategoryTotal[]; // เรียงมาก→น้อยจาก API แล้ว
  monthTotal: number;
  onPressCategory: (categoryId: number) => void;
};

function deltaText(total: number, prev: number): string {
  if (prev === 0) return 'ใหม่เดือนนี้';
  const diff = total - prev;
  if (diff === 0) return 'เท่าเดือนก่อน';
  return `${diff > 0 ? '▲' : '▼'} ${formatBaht(Math.abs(diff))} จากช่วงเดียวกันเดือนก่อน`;
}

/**
 * แท่งแนวนอนแยกหมวด — ใช้สีเดียว ทุกแท่งมีชื่อ ยอด % กำกับ (อ่านได้โดยไม่ต้องจับคู่สี)
 * แท่งยาวเทียบกับหมวดที่ใช้มากที่สุด เพื่อให้เห็นความต่างชัด
 */
export function CategoryBars({ items, monthTotal, onPressCategory }: Props) {
  const top = items.slice(0, TOP_N);
  const rest = items.slice(TOP_N);
  const restTotal = rest.reduce((sum, c) => sum + c.total, 0);
  const max = Math.max(top[0]?.total ?? 0, restTotal, 1);
  const pct = (n: number) => (monthTotal > 0 ? Math.round((n / monthTotal) * 100) : 0);

  return (
    <View style={styles.list}>
      {top.map((c) => (
        <Pressable
          key={c.category.id}
          onPress={() => onPressCategory(c.category.id)}
          accessibilityLabel={`${c.category.name} ${formatBaht(c.total)} ดูรายการ`}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {c.category.icon} {c.category.name}
            </Text>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${(c.total / max) * 100}%` }]} />
            </View>
            <Text style={styles.amount}>{formatBaht(c.total)}</Text>
          </View>
          <Text style={styles.detail}>
            {pct(c.total)}% · {deltaText(c.total, c.prev_total)}
          </Text>
        </Pressable>
      ))}
      {rest.length > 0 && (
        <View style={styles.item}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              📦 อื่นๆ {rest.length} หมวด
            </Text>
            <View style={styles.track}>
              <View style={[styles.bar, styles.barOther, { width: `${(restTotal / max) * 100}%` }]} />
            </View>
            <Text style={styles.amount}>{formatBaht(restTotal)}</Text>
          </View>
          <Text style={styles.detail} numberOfLines={1}>
            {pct(restTotal)}% · {rest.map((c) => c.category.name).join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  item: { gap: 2, paddingVertical: Spacing.one },
  pressed: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { width: 110, fontSize: FontSize.body, color: Colors.text },
  track: { flex: 1, height: 12, backgroundColor: Colors.chartTrack, borderRadius: Radius.full, overflow: 'hidden' },
  // ปลายแท่งมนเฉพาะด้านขวา (ด้านซ้ายติดฐาน)
  bar: { height: 12, backgroundColor: Colors.chart, borderTopRightRadius: Radius.full, borderBottomRightRadius: Radius.full },
  barOther: { backgroundColor: Colors.chartOther },
  amount: { minWidth: 72, textAlign: 'right', fontSize: FontSize.body, fontWeight: '700', color: Colors.text },
  detail: { fontSize: FontSize.caption, color: Colors.textSecondary, textAlign: 'right' },
});
