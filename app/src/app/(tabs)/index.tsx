import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryBars } from '@/components/category-bars';
import { ConnectionBadge } from '@/components/connection-badge';
import { MonthBars } from '@/components/month-bars';
import { MonthTotalCard } from '@/components/month-total-card';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatBaht } from '@/lib/amount';
import { describeError, getSummary } from '@/lib/api';
import { addMonths, monthKey, THAI_MONTHS_SHORT } from '@/lib/date';
import type { Summary } from '@/lib/types';

type Compare = { text: string; direction: 'up' | 'down' | 'same' };

/** "น้อยกว่า 1–27 ก.ย. ฿1,150 (−12%)" — เทียบกับช่วงเดียวกันของเดือนก่อน */
function compareWithPrev(s: Summary, month: Date): Compare {
  const prev = addMonths(month, -1);
  const prevName = THAI_MONTHS_SHORT[prev.getMonth()];
  const daysInPrev = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
  const period =
    s.compare_day && s.compare_day < daysInPrev ? `1–${s.compare_day} ${prevName}` : `${prevName} ทั้งเดือน`;

  const base = s.prev_same_period_total;
  if (base === 0) return { text: `${period} ไม่มีรายจ่ายให้เทียบ`, direction: 'same' };
  const diff = s.total - base;
  if (diff === 0) return { text: `เท่ากับ ${period}`, direction: 'same' };
  const pct = Math.round((Math.abs(diff) / base) * 100);
  return diff < 0
    ? { text: `น้อยกว่า ${period} ${formatBaht(-diff)} (−${pct}%)`, direction: 'down' }
    : { text: `มากกว่า ${period} ${formatBaht(diff)} (+${pct}%)`, direction: 'up' };
}

const COMPARE_ICON = {
  down: { name: 'trending-down', color: Colors.success },
  up: { name: 'trending-up', color: Colors.danger },
  same: { name: 'remove', color: Colors.textSecondary },
} as const;

export default function SummaryScreen() {
  const thisMonth = addMonths(new Date(), 0);
  const [month, setMonth] = useState(thisMonth);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestSeq = useRef(0); // เปลี่ยนเดือนเร็วๆ → ทิ้งคำตอบของเดือนเก่าที่มาช้า

  const load = useCallback(() => {
    const seq = ++requestSeq.current;
    getSummary(monthKey(month))
      .then((s) => {
        if (seq !== requestSeq.current) return;
        setSummary(s);
        setError(null);
      })
      .catch((e) => {
        if (seq === requestSeq.current) setError(describeError(e, 'โหลดสรุป'));
      })
      .finally(() => {
        if (seq === requestSeq.current) setRefreshing(false);
      });
  }, [month]);

  // โหลดใหม่ทุกครั้งที่กลับมาหน้านี้ (เช่นหลังบันทึกรายการ) และเมื่อเปลี่ยนเดือน
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openCategory(categoryId: number) {
    // ไปแท็บประวัติ พร้อมกรองหมวดนี้ในเดือนเดียวกัน
    router.navigate({ pathname: '/history', params: { category: String(categoryId), month: monthKey(month) } });
  }

  // แสดงข้อมูลเดือนนี้เฉพาะเมื่อคำตอบตรงกับเดือนที่เลือก (กันตัวเลขเดือนเก่าค้างตอนกำลังโหลด)
  const s = summary?.month === monthKey(month) ? summary : null;
  const compare = s ? compareWithPrev(s, month) : null;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[Colors.primary]}
          />
        }>
        <View style={styles.header}>
          <Text style={styles.title}>สรุป</Text>
          <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel="ตั้งค่า">
            <Ionicons name="settings-outline" size={24} color={Colors.text} />
          </Pressable>
        </View>

        <ConnectionBadge />

        <MonthTotalCard
          month={month}
          canGoNext={monthKey(month) < monthKey(thisMonth)}
          onPrev={() => setMonth((m) => addMonths(m, -1))}
          onNext={() => setMonth((m) => addMonths(m, 1))}
          caption={s && !s.is_current ? 'ใช้ไปทั้งเดือน' : 'ใช้ไปแล้ว'}
          total={s?.total ?? 0}>
          {compare && (
            <View style={styles.pill}>
              <Ionicons name={COMPARE_ICON[compare.direction].name} size={16} color={COMPARE_ICON[compare.direction].color} />
              <Text style={styles.pillText}>{compare.text}</Text>
            </View>
          )}
        </MonthTotalCard>

        {error && <Text style={styles.error}>{error}</Text>}

        {!s ? (
          !error && <ActivityIndicator color={Colors.primary} style={styles.loading} />
        ) : (
          <>
            <View style={styles.tiles}>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>เฉลี่ยต่อวัน</Text>
                <Text style={styles.tileValue}>{formatBaht(Math.round(s.total / Math.max(s.days, 1)))}</Text>
              </View>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>จำนวนรายการ</Text>
                <Text style={styles.tileValue}>{s.count}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>แยกตามหมวด</Text>
              {s.by_category.length > 0 ? (
                <CategoryBars items={s.by_category} monthTotal={s.total} onPressCategory={openCategory} />
              ) : (
                <Text style={styles.empty}>ยังไม่มีรายจ่ายเดือนนี้ — กด ＋ เพื่อบันทึก</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>6 เดือนล่าสุด</Text>
              <MonthBars key={s.month} months={s.months} lastIsPartial={s.is_current} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.one,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginTop: Spacing.two,
  },
  pillText: { fontSize: FontSize.caption, color: Colors.text },
  error: { backgroundColor: Colors.butter, borderRadius: Radius.sm, padding: Spacing.two, color: Colors.text },
  loading: { marginTop: Spacing.five },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lemon,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 2,
  },
  tileLabel: { fontSize: FontSize.caption, color: Colors.textSecondary },
  tileValue: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  section: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.three },
  sectionTitle: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text },
  empty: { fontSize: FontSize.caption, color: Colors.textSecondary },
});
