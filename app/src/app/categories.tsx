import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, ToastAndroid, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { getCategories, moveCategory } from '@/lib/db';
import { localError } from '@/lib/errors';
import type { Category } from '@/lib/types';

/** รายการหมวด: เลื่อนขึ้นลงเพื่อเรียง, แตะเพื่อแก้ */
export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);

  const load = useCallback(() => {
    getCategories().then(setCategories, (e) => ToastAndroid.show(localError('โหลดหมวด', e), ToastAndroid.LONG));
  }, []);

  useFocusEffect(load);

  function move(id: number, direction: -1 | 1) {
    moveCategory(id, direction).then(load, (e) => ToastAndroid.show(localError('เรียงหมวด', e), ToastAndroid.LONG));
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        {categories.map((c, i) => (
          <View key={c.id} style={styles.row}>
            <Pressable
              style={styles.main}
              onPress={() => router.push({ pathname: '/category/[id]', params: { id: String(c.id) } })}>
              <View style={[styles.icon, { backgroundColor: c.color }]}>
                <Text style={styles.iconText}>{c.icon}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {c.name}
              </Text>
            </Pressable>
            <Pressable onPress={() => move(c.id, -1)} disabled={i === 0} hitSlop={6} accessibilityLabel={`เลื่อน ${c.name} ขึ้น`}>
              <Ionicons name="chevron-up" size={22} color={Colors.text} style={i === 0 && styles.dim} />
            </Pressable>
            <Pressable
              onPress={() => move(c.id, 1)}
              disabled={i === categories.length - 1}
              hitSlop={6}
              accessibilityLabel={`เลื่อน ${c.name} ลง`}>
              <Ionicons name="chevron-down" size={22} color={Colors.text} style={i === categories.length - 1 && styles.dim} />
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.row} onPress={() => router.push({ pathname: '/category/[id]', params: { id: 'new' } })}>
          <Text style={styles.add}>＋ เพิ่มหมวด</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>ลำดับนี้ใช้ทั้งในหน้าบันทึกและตัวกรองในหน้าประวัติ</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 52 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  icon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20 },
  name: { flex: 1, fontSize: FontSize.body, color: Colors.text },
  dim: { opacity: 0.2 },
  add: { fontSize: FontSize.body, color: Colors.chart, fontWeight: '600' },
  hint: { fontSize: FontSize.caption, color: Colors.textSecondary, textAlign: 'center' },
});
