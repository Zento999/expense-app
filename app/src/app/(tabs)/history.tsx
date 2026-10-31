import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseRow } from '@/components/expense-row';
import { MonthTotalCard } from '@/components/month-total-card';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatBaht } from '@/lib/amount';
import { getCategories, listExpenses } from '@/lib/db'; // อ่านจากฐานข้อมูลในเครื่อง (ไม่ใช้เซิร์ฟเวอร์แล้ว)
import { addMonths, dayHeader, dayKey, monthKey, THAI_MONTHS_SHORT } from '@/lib/date';
import type { Category, Expense } from '@/lib/types';

const PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 300;

type Section = { key: string; title: string; total: number; data: Expense[] };

/** รายการเรียงใหม่→เก่าอยู่แล้ว (API เรียงให้) แค่ตัดเป็นกลุ่มตามวัน */
function groupByDay(items: Expense[]): Section[] {
  const sections: Section[] = [];
  for (const e of items) {
    const d = new Date(e.spent_at);
    const key = dayKey(d);
    let section = sections[sections.length - 1];
    if (section?.key !== key) {
      section = { key, title: dayHeader(d), total: 0, data: [] };
      sections.push(section);
    }
    section.data.push(e);
    section.total += e.amount;
  }
  return sections;
}

export default function HistoryScreen() {
  // เดือน/วัน/หมวดเก็บใน URL (?month=2026-10&day=2026-10-14&category=1) — หน้าสรุปจึงส่งตัวกรองมาให้ได้ตรงๆ
  const params = useLocalSearchParams<{ month?: string; day?: string; category?: string }>();
  const thisMonthKey = monthKey(new Date());
  const dayStr = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : null;
  const monthStr = dayStr
    ? dayStr.slice(0, 7)
    : params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : thisMonthKey;
  const month = new Date(Number(monthStr.slice(0, 4)), Number(monthStr.slice(5)) - 1, 1);
  const categoryId = params.category ? Number(params.category) : null;
  const setMonth = (d: Date) => router.setParams({ month: monthKey(d), day: '' }); // เปลี่ยนเดือน = เลิกกรองวัน
  const clearDay = () => router.setParams({ day: '' });
  const setCategoryId = (id: number | null) => router.setParams({ category: id === null ? '' : String(id) });

  const [search, setSearch] = useState(''); // สิ่งที่พิมพ์อยู่
  const [query, setQuery] = useState(''); // สิ่งที่ค้นจริง (หลังหยุดพิมพ์)
  const [categories, setCategories] = useState<Category[]>([]);

  const [items, setItems] = useState<Expense[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // นับ request: ถ้าเปลี่ยนตัวกรองเร็วๆ คำตอบเก่าที่มาช้าจะถูกทิ้ง ไม่ทับคำตอบใหม่
  const requestSeq = useRef(0);
  const loadingMore = useRef(false);

  const filtered = query !== '' || categoryId !== null || dayStr !== null;
  const canGoNext = monthStr < thisMonthKey;

  // หน่วงการค้นหา: รอให้หยุดพิมพ์ 0.3 วิ ก่อนยิง API (ไม่ยิงทุกตัวอักษร)
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    getCategories().then(setCategories, () => {});
  }, []);

  const fetchPage = useCallback(
    (offset: number) => {
      const seq = ++requestSeq.current;
      const filters = { month: monthStr, day: dayStr ?? undefined, q: query || undefined, categoryId: categoryId ?? undefined };
      Promise.all([
        listExpenses({ ...filters, limit: PAGE_SIZE, offset }),
        // กรองอยู่ → ขอยอดทั้งเดือนแยกอีกครั้ง (limit=1 เพราะต้องการแค่ total ที่ DB รวมให้)
        filtered && offset === 0 ? listExpenses({ month: filters.month, limit: 1 }) : null,
      ])
        .then(([page, whole]) => {
          if (seq !== requestSeq.current) return;
          setItems((prev) => (offset === 0 ? page.items : [...prev, ...page.items]));
          setTotalCount(page.total_count);
          setTotalAmount(page.total_amount);
          if (offset === 0) setMonthTotal(whole ? whole.total_amount : page.total_amount);
          setError(null);
        })
        .catch((e) => {
          console.warn('[history] local db', e);
          if (seq === requestSeq.current) setError(`โหลดรายการไม่สำเร็จ — ${e instanceof Error ? e.message : String(e)}`);
        })
        .finally(() => {
          if (seq !== requestSeq.current) return;
          setLoading(false);
          setRefreshing(false);
          loadingMore.current = false;
        });
    },
    // ใช้ monthStr (string) ไม่ใช่ month (Date) — Date ถูกสร้างใหม่ทุก render จะทำให้โหลดวนไม่หยุด
    [monthStr, dayStr, query, categoryId, filtered],
  );

  // โหลดใหม่ทุกครั้งที่กลับมาหน้านี้ (เช่นหลังบันทึก/แก้/ลบ) และเมื่อเปลี่ยนเดือน/ตัวกรอง
  useFocusEffect(
    useCallback(() => {
      fetchPage(0);
    }, [fetchPage]),
  );

  function onRefresh() {
    setRefreshing(true);
    fetchPage(0);
  }

  function onEndReached() {
    if (loadingMore.current || items.length >= totalCount) return;
    loadingMore.current = true;
    fetchPage(items.length);
  }

  const category = categories.find((c) => c.id === categoryId);
  const dayLabel = dayStr && `วันที่ ${Number(dayStr.slice(8))} ${THAI_MONTHS_SHORT[Number(dayStr.slice(5, 7)) - 1]}`;
  const filterLabel = [dayLabel, category && `เฉพาะ ${category.name}`, query && `ค้น "${query}"`].filter(Boolean).join(' · ');
  const share = monthTotal > 0 ? Math.round((totalAmount / monthTotal) * 100) : 0;

  const header = (
    <View style={styles.header}>
      <MonthTotalCard
        month={month}
        canGoNext={canGoNext}
        onPrev={() => setMonth(addMonths(month, -1))}
        onNext={() => setMonth(addMonths(month, 1))}
        caption={filtered ? filterLabel : 'ใช้ไปทั้งเดือน'}
        total={totalAmount}
        muted={filtered}>
        <Text style={styles.cardCaption}>
          {totalCount} รายการ{filtered && ` · ${share}% ของทั้งเดือน ${formatBaht(monthTotal)}`}
        </Text>
        {filtered && (
          <View style={styles.shareTrack}>
            <View style={[styles.shareBar, { width: `${Math.min(share, 100)}%` }]} />
          </View>
        )}
      </MonthTotalCard>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="ค้นหาร้าน, โน้ต"
          placeholderTextColor={Colors.textSecondary}
          returnKeyType="search"
        />
        {search !== '' && (
          <Pressable onPress={() => setSearch('')} hitSlop={12} accessibilityLabel="ล้างคำค้น">
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {dayLabel && <Chip label={`📅 ${dayLabel}  ✕`} selected onPress={clearDay} />}
        <Chip label="ทั้งหมด" selected={categoryId === null} onPress={() => setCategoryId(null)} />
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={`${c.icon} ${c.name}`}
            selected={categoryId === c.id}
            onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
          />
        ))}
      </ScrollView>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <SectionList
        sections={groupByDay(items)}
        keyExtractor={(e) => String(e.id)}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <View style={styles.dayRow}>
            <Text style={styles.dayText}>{section.title}</Text>
            <Text style={styles.dayText}>{formatBaht(section.total)}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ExpenseRow expense={item} onPress={() => router.push({ pathname: '/expense/[id]', params: { id: String(item.id) } })} />
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loading} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name={filtered ? 'search-outline' : 'receipt-outline'} size={44} color={Colors.primarySoft} />
              <Text style={styles.emptyText}>
                {filtered ? 'ไม่พบรายการที่ตรงกัน' : 'ยังไม่มีรายจ่ายเดือนนี้ — กด ＋ เพื่อบันทึก'}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  header: { gap: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.one },
  cardCaption: { textAlign: 'center', fontSize: FontSize.caption, color: Colors.text },
  shareTrack: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    marginTop: Spacing.two,
    overflow: 'hidden',
  },
  shareBar: { height: 6, borderRadius: Radius.full, backgroundColor: Colors.text },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lemon,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: FontSize.body, color: Colors.text },
  chips: { gap: Spacing.two },
  chip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.lemon,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  chipSelected: { backgroundColor: Colors.primarySoft, borderColor: Colors.primarySoft },
  chipText: { fontSize: FontSize.caption, color: Colors.text },
  error: {
    backgroundColor: Colors.butter,
    borderRadius: Radius.sm,
    padding: Spacing.two,
    fontSize: FontSize.caption,
    color: Colors.text,
  },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.three, marginBottom: Spacing.half },
  dayText: { fontSize: FontSize.caption, color: Colors.textSecondary, fontWeight: '600' },
  loading: { marginTop: Spacing.six },
  empty: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.six },
  emptyText: { fontSize: FontSize.body, color: Colors.textSecondary, textAlign: 'center' },
});
