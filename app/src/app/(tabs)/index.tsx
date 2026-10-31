import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryBars } from '@/components/category-bars';
import { ExpenseRow } from '@/components/expense-row';
import { MonthBars } from '@/components/month-bars';
import { MonthTotalCard } from '@/components/month-total-card';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatBaht } from '@/lib/amount';
import { addMonths, greeting, monthKey, shortDate, THAI_MONTHS_SHORT } from '@/lib/date';
import { getSummary, listExpenses } from '@/lib/db';
import { localError } from '@/lib/errors';
import type { Expense, Summary } from '@/lib/types';

const RECENT_COUNT = 3;
const MIN_MONTHS_FOR_CHART = 2; // ข้อมูลน้อยกว่านี้ กราฟจะมีแต่แท่งว่าง — แสดงการ์ดให้กำลังใจแทน

type Compare = { text: string; icon: keyof typeof Ionicons.glyphMap; color: string };

/** "น้อยกว่า 1–27 ก.ย. ฿1,150 (−12%)" — เทียบกับช่วงเดียวกันของเดือนก่อน */
function compareWithPrev(s: Summary, month: Date): Compare {
  // ไม่มีข้อมูลก่อนเดือนนี้เลย = เดือนแรก → บอกแบบเป็นมิตร แทน "ไม่มีรายจ่ายให้เทียบ" ที่ฟังเหมือน error
  if (s.months.slice(0, -1).every((m) => m.total === 0)) {
    return { text: 'เดือนแรกของคุณ ✨ เดือนหน้าจะเริ่มเทียบได้', icon: 'sparkles', color: Colors.primary };
  }
  const prev = addMonths(month, -1);
  const prevName = THAI_MONTHS_SHORT[prev.getMonth()];
  const daysInPrev = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
  const period =
    s.compare_day && s.compare_day < daysInPrev ? `1–${s.compare_day} ${prevName}` : `${prevName} ทั้งเดือน`;

  const base = s.prev_same_period_total;
  if (base === 0) return { text: `${period} ไม่ได้ใช้จ่ายเลย`, icon: 'remove', color: Colors.textSecondary };
  const diff = s.total - base;
  if (diff === 0) return { text: `เท่ากับ ${period}`, icon: 'remove', color: Colors.textSecondary };
  const pct = Math.round((Math.abs(diff) / base) * 100);
  return diff < 0
    ? { text: `น้อยกว่า ${period} ${formatBaht(-diff)} (−${pct}%)`, icon: 'trending-down', color: Colors.success }
    : { text: `มากกว่า ${period} ${formatBaht(diff)} (+${pct}%)`, icon: 'trending-up', color: Colors.danger };
}

export default function SummaryScreen() {
  const now = new Date();
  const thisMonth = addMonths(now, 0);
  const [month, setMonth] = useState(thisMonth);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestSeq = useRef(0); // เปลี่ยนเดือนเร็วๆ → ทิ้งคำตอบของเดือนเก่าที่มาช้า

  const load = useCallback(() => {
    const seq = ++requestSeq.current;
    const key = monthKey(month);
    Promise.all([getSummary(key), listExpenses({ month: key, limit: RECENT_COUNT })])
      .then(([s, list]) => {
        if (seq !== requestSeq.current) return;
        setSummary(s);
        setRecent(list.items);
        setError(null);
      })
      .catch((e) => {
        if (seq === requestSeq.current) setError(localError('โหลดสรุป', e));
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

  function openHistory(params: { category?: string } = {}) {
    router.navigate({ pathname: '/history', params: { month: monthKey(month), ...params } });
  }

  // แสดงข้อมูลเฉพาะเมื่อคำตอบตรงกับเดือนที่เลือก (กันตัวเลขเดือนเก่าค้างตอนกำลังโหลด)
  const s = summary?.month === monthKey(month) ? summary : null;
  const compare = s ? compareWithPrev(s, month) : null;
  const monthsWithData = s ? s.months.filter((m) => m.total > 0).length : 0;

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
          <View style={styles.flex1}>
            <Text style={styles.greeting}>{greeting(now)}</Text>
            <Text style={styles.subline}>
              {shortDate(now)}
              {summary && ` · วันนี้ใช้ไป ${formatBaht(summary.today_total)}`}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/backup')} hitSlop={12} accessibilityLabel="สำรองข้อมูล">
            <Ionicons name="archive-outline" size={24} color={Colors.text} />
          </Pressable>
        </View>

        <MonthTotalCard
          month={month}
          canGoNext={monthKey(month) < monthKey(thisMonth)}
          onPrev={() => setMonth((m) => addMonths(m, -1))}
          onNext={() => setMonth((m) => addMonths(m, 1))}
          caption={s && !s.is_current ? 'ใช้ไปทั้งเดือน' : 'ใช้ไปแล้ว'}
          total={s?.total ?? 0}>
          {s && (
            <Text style={styles.cardStats}>
              เฉลี่ย {formatBaht(Math.round(s.total / Math.max(s.days, 1)))}/วัน · {s.count} รายการ
            </Text>
          )}
          {compare && (
            <View style={styles.pill}>
              <Ionicons name={compare.icon} size={16} color={compare.color} />
              <Text style={styles.pillText}>{compare.text}</Text>
            </View>
          )}
        </MonthTotalCard>

        {error && <Text style={styles.error}>{error}</Text>}

        {!s ? (
          !error && <ActivityIndicator color={Colors.primary} style={styles.loading} />
        ) : (
          <>
            {recent.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>รายการล่าสุด</Text>
                  <Pressable onPress={() => openHistory()} hitSlop={8}>
                    <Text style={styles.link}>ดูทั้งหมด ›</Text>
                  </Pressable>
                </View>
                <View>
                  {recent.map((e) => (
                    <ExpenseRow
                      key={e.id}
                      expense={e}
                      onPress={() => router.push({ pathname: '/expense/[id]', params: { id: String(e.id) } })}
                    />
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>แยกตามหมวด</Text>
              {s.by_category.length > 0 ? (
                <CategoryBars
                  items={s.by_category}
                  monthTotal={s.total}
                  onPressCategory={(id) => openHistory({ category: String(id) })}
                />
              ) : (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyEmoji}>🧾</Text>
                  <Text style={styles.empty}>ยังไม่มีรายจ่ายเดือนนี้ — กด ＋ เพื่อบันทึกรายการแรก</Text>
                </View>
              )}
            </View>

            {monthsWithData >= MIN_MONTHS_FOR_CHART ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>6 เดือนล่าสุด</Text>
                <MonthBars key={s.month} months={s.months} lastIsPartial={s.is_current} />
              </View>
            ) : (
              <View style={[styles.section, styles.emptyRow]}>
                <Text style={styles.emptyEmoji}>📈</Text>
                <View style={styles.flex1}>
                  <Text style={styles.sectionTitle}>กราฟ 6 เดือนจะมาเมื่อมีข้อมูล 2 เดือนขึ้นไป</Text>
                  <Text style={styles.empty}>บันทึกต่อไปเรื่อยๆ นะ เดือนนี้ {s.count} รายการแล้ว</Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  flex1: { flex: 1 },
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  greeting: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  subline: { fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 2 },
  cardStats: { textAlign: 'center', fontSize: FontSize.caption, color: Colors.text },
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
  section: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text },
  link: { fontSize: FontSize.caption, color: Colors.textSecondary },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  emptyEmoji: { fontSize: 30 },
  empty: { flex: 1, fontSize: FontSize.caption, color: Colors.textSecondary },
});
