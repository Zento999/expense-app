import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, ToastAndroid, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { addCategory, categoryUsage, deleteCategory, getCategories, updateCategory } from '@/lib/db';
import { localError } from '@/lib/errors';
import type { Category } from '@/lib/types';

// พาเลตพาสเทลเดียวกับหมวดเริ่มต้น — สีหมวดใช้เป็นพื้นหลังไอคอนเท่านั้น ไม่ใช้กับตัวหนังสือ
const PALETTE = ['#F7C04A', '#C8A27A', '#8EC5E8', '#F4A7B9', '#A8D5BA', '#FFB38A', '#B9A7E8', '#FFDD83', '#9FD8D3', '#C9C2B0'];
const EMOJI_IDEAS = ['🐱', '🐶', '📱', '💄', '🎁', '🍺', '⛽', '🏋️', '✈️', '👶', '🧾', '💸'];

/** เพิ่ม (id = "new") หรือแก้หมวด */
export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = id === 'new' ? null : Number(id);
  const [all, setAll] = useState<Category[] | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [usage, setUsage] = useState({ expenses: 0, bills: 0 });
  const [saving, setSaving] = useState(false);
  const [pickingTarget, setPickingTarget] = useState(false); // กำลังเลือกหมวดปลายทางก่อนลบ

  useEffect(() => {
    Promise.all([getCategories(), categoryId === null ? null : categoryUsage(categoryId)]).then(
      ([cats, used]) => {
        setAll(cats);
        const c = cats.find((x) => x.id === categoryId);
        if (c) {
          setName(c.name);
          setIcon(c.icon);
          setColor(c.color);
        } else {
          setIcon(EMOJI_IDEAS[0]);
        }
        if (used) setUsage(used);
      },
      (e) => ToastAndroid.show(localError('โหลดหมวด', e), ToastAndroid.LONG),
    );
  }, [categoryId]);

  const valid = name.trim() !== '' && icon.trim() !== '';

  async function onSave() {
    if (!valid) {
      ToastAndroid.show('ใส่ชื่อและอีโมจิก่อน', ToastAndroid.SHORT);
      return;
    }
    setSaving(true);
    const input = { name: name.trim(), icon: icon.trim(), color };
    try {
      if (categoryId === null) await addCategory(input);
      else await updateCategory(categoryId, input);
      router.back();
    } catch (e) {
      ToastAndroid.show(e instanceof Error ? e.message : String(e), ToastAndroid.LONG);
      setSaving(false);
    }
  }

  function remove(moveToId: number | null) {
    if (categoryId === null) return;
    deleteCategory(categoryId, moveToId).then(
      () => router.back(),
      (e) => ToastAndroid.show(e instanceof Error ? e.message : String(e), ToastAndroid.LONG),
    );
  }

  function onDelete() {
    if (categoryId === null || !all) return;
    const used = usage.expenses + usage.bills;
    if (used === 0) {
      Alert.alert(`ลบหมวด "${name}"?`, undefined, [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'ลบ', style: 'destructive', onPress: () => remove(null) },
      ]);
      return;
    }
    // Alert บน Android มีได้แค่ 3 ปุ่ม — ให้เลือกหมวดปลายทางในหน้านี้แทน
    setPickingTarget(true);
  }

  if (!all) return <ActivityIndicator color={Colors.primary} style={styles.loading} />;
  const others = all.filter((c) => c.id !== categoryId);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: categoryId === null ? 'เพิ่มหมวด' : 'แก้ไขหมวด' }} />

      <View style={styles.preview}>
        <View style={[styles.previewIcon, { backgroundColor: color }]}>
          <Text style={styles.previewEmoji}>{icon || '❔'}</Text>
        </View>
        <Text style={styles.previewName}>{name || 'ชื่อหมวด'}</Text>
      </View>

      <Text style={styles.label}>อีโมจิ (พิมพ์จากคีย์บอร์ด หรือแตะเลือก)</Text>
      <TextInput
        style={[styles.input, styles.emojiInput]}
        value={icon}
        onChangeText={setIcon}
        maxLength={8}
        placeholder="🐱"
        placeholderTextColor={Colors.textSecondary}
      />
      <View style={styles.wrap}>
        {EMOJI_IDEAS.map((e) => (
          <Pressable key={e} onPress={() => setIcon(e)} style={[styles.emojiChip, icon === e && styles.selected]}>
            <Text style={styles.emojiChipText}>{e}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>ชื่อหมวด</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        maxLength={30}
        placeholder="แมว"
        placeholderTextColor={Colors.textSecondary}
      />

      <Text style={styles.label}>สี</Text>
      <View style={styles.wrap}>
        {PALETTE.map((p) => (
          <Pressable
            key={p}
            onPress={() => setColor(p)}
            accessibilityLabel={`สี ${p}`}
            style={[styles.swatch, { backgroundColor: p }, color === p && styles.swatchSelected]}
          />
        ))}
      </View>

      <Pressable
        onPress={onSave}
        disabled={saving}
        style={({ pressed }) => [styles.save, !valid && styles.saveDim, (pressed || saving) && styles.pressed]}>
        {saving ? <ActivityIndicator color={Colors.text} /> : <Text style={styles.saveText}>บันทึกหมวด</Text>}
      </Pressable>

      {categoryId !== null && others.length > 0 && (
        <View style={styles.danger}>
          {!pickingTarget ? (
            <Pressable onPress={onDelete}>
              <Text style={styles.dangerTitle}>ลบหมวดนี้</Text>
              {usage.expenses + usage.bills > 0 && (
                <Text style={styles.hint}>
                  มี {usage.expenses} รายการ{usage.bills > 0 && ` และ ${usage.bills} บิล`} — ต้องย้ายไปหมวดอื่นก่อน
                </Text>
              )}
            </Pressable>
          ) : (
            <>
              <Text style={styles.dangerTitle}>ย้าย {usage.expenses + usage.bills} รายการไปที่…</Text>
              <View style={styles.wrap}>
                {others.map((c) => (
                  <Pressable
                    key={c.id}
                    style={styles.target}
                    onPress={() =>
                      Alert.alert(`ย้ายไป "${c.name}" แล้วลบ "${name}"?`, undefined, [
                        { text: 'ยกเลิก', style: 'cancel' },
                        { text: 'ย้ายและลบ', style: 'destructive', onPress: () => remove(c.id) },
                      ])
                    }>
                    <Text style={styles.targetText}>
                      {c.icon} {c.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={() => setPickingTarget(false)}>
                <Text style={styles.hint}>ยกเลิก</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: Spacing.six },
  container: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  preview: { alignItems: 'center', gap: Spacing.two, marginVertical: Spacing.two },
  previewIcon: { width: 64, height: 64, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  previewEmoji: { fontSize: 34 },
  previewName: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  label: { fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: Spacing.two },
  hint: { fontSize: FontSize.caption, color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lemon,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  emojiInput: { fontSize: 22, width: 90, textAlign: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  emojiChip: { width: 42, height: 42, borderRadius: Radius.sm, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  emojiChipText: { fontSize: 22 },
  selected: { borderWidth: 2, borderColor: Colors.text },
  swatch: { width: 34, height: 34, borderRadius: Radius.full },
  swatchSelected: { borderWidth: 3, borderColor: Colors.text },
  save: {
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  saveDim: { backgroundColor: Colors.lemon },
  pressed: { opacity: 0.7 },
  saveText: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  danger: { backgroundColor: '#FFF4F2', borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two, marginTop: Spacing.three },
  dangerTitle: { fontSize: FontSize.body, color: Colors.danger, fontWeight: '600' },
  target: { backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  targetText: { fontSize: FontSize.caption, color: Colors.text },
});
