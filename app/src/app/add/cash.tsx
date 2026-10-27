import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryGrid } from '@/components/category-grid';
import { Numpad } from '@/components/numpad';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatTyped, isValidAmount, pressKey, toApiAmount, type NumpadKey } from '@/lib/amount';
import { createExpense, getCategories } from '@/lib/api';
import { dayLabel, withCurrentTime } from '@/lib/date';
import { getLastCategoryId, setLastCategoryId } from '@/lib/prefs';
import type { Category } from '@/lib/types';

export default function CashScreen() {
  const [amount, setAmount] = useState('');
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [payee, setPayee] = useState('');
  const [day, setDay] = useState(new Date());
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  function loadCategories() {
    Promise.all([getCategories(), getLastCategoryId()]).then(
      ([cats, lastId]) => {
        setCategories(cats);
        // หมวดล่าสุดที่เคยใช้ ถ้าไม่มี (หรือถูกลบไปแล้ว) ใช้หมวดแรก
        setCategoryId(cats.some((c) => c.id === lastId) ? lastId : (cats[0]?.id ?? null));
      },
      () => setLoadError(true),
    );
  }

  // setState เกิดใน callback หลังโหลดเสร็จ ไม่ใช่ทันทีใน effect (กันการ render ซ้อน)
  useEffect(loadCategories, []);

  function retryLoad() {
    setLoadError(false);
    loadCategories();
  }

  function onKey(key: NumpadKey) {
    setAmount((current) => pressKey(current, key));
  }

  function pickDay() {
    DateTimePickerAndroid.open({
      value: day,
      mode: 'date',
      maximumDate: new Date(), // บันทึกรายจ่ายล่วงหน้าไม่ได้
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) setDay(selected);
      },
    });
  }

  async function onSave() {
    if (!isValidAmount(amount)) {
      ToastAndroid.show('ใส่จำนวนเงินก่อน', ToastAndroid.SHORT);
      return;
    }
    if (categoryId === null) return;
    setSaving(true);
    try {
      await createExpense({
        amount: toApiAmount(amount),
        category_id: categoryId,
        source: 'cash',
        spent_at: withCurrentTime(day).toISOString(),
        payee: payee.trim() || null,
      });
      await setLastCategoryId(categoryId);
      ToastAndroid.show(`บันทึก ฿${formatTyped(toApiAmount(amount))} แล้ว`, ToastAndroid.SHORT);
      router.back();
    } catch {
      ToastAndroid.show('บันทึกไม่สำเร็จ — เช็คการเชื่อมต่อแล้วลองใหม่', ToastAndroid.LONG);
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <View style={styles.top}>
        <Text style={styles.amountLabel}>จำนวนเงิน</Text>
        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          ฿{formatTyped(amount)}
        </Text>

        {categories ? (
          <CategoryGrid categories={categories} selectedId={categoryId} onSelect={setCategoryId} />
        ) : loadError ? (
          <Pressable onPress={retryLoad} style={styles.error}>
            <Ionicons name="refresh" size={18} color={Colors.text} />
            <Text style={styles.errorText}>โหลดหมวดหมู่ไม่ได้ — แตะเพื่อลองใหม่</Text>
          </Pressable>
        ) : (
          <ActivityIndicator color={Colors.primary} style={styles.loading} />
        )}

        <View style={styles.inputs}>
          <View style={styles.payee}>
            <Ionicons name="pencil" size={16} color={Colors.textSecondary} />
            <TextInput
              style={styles.payeeInput}
              value={payee}
              onChangeText={setPayee}
              placeholder="ข้าวมันไก่"
              placeholderTextColor={Colors.textSecondary}
              maxLength={200}
              returnKeyType="done"
            />
          </View>
          <Pressable onPress={pickDay} style={styles.dateChip} accessibilityLabel="เลือกวันที่">
            <Ionicons name="calendar-outline" size={16} color={Colors.text} />
            <Text style={styles.dateText}>{dayLabel(day)}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.bottom}>
        <Numpad onKey={onKey} />
        <Pressable
          onPress={onSave}
          disabled={saving || !categories}
          style={({ pressed }) => [
            styles.save,
            !isValidAmount(amount) && styles.saveDim,
            (pressed || saving) && styles.pressed,
          ]}>
          {saving ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <Text style={styles.saveText}>
              {isValidAmount(amount) ? `บันทึก ฿${formatTyped(toApiAmount(amount))}` : 'บันทึก'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  top: { flex: 1, paddingHorizontal: Spacing.three, gap: Spacing.three },
  amountLabel: { textAlign: 'center', fontSize: FontSize.caption, color: Colors.textSecondary },
  amount: { textAlign: 'center', fontSize: 48, fontWeight: '800', color: Colors.text, marginTop: -Spacing.three },
  loading: { marginVertical: Spacing.five },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.butter,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  errorText: { color: Colors.text, fontSize: FontSize.body },
  inputs: { flexDirection: 'row', gap: Spacing.two },
  payee: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lemon,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  payeeInput: { flex: 1, paddingVertical: 10, fontSize: FontSize.body, color: Colors.text },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: Colors.butter,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  dateText: { fontSize: FontSize.body, color: Colors.text, fontWeight: '600' },
  bottom: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.lemon,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  save: {
    height: 58,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDim: { backgroundColor: Colors.lemon },
  pressed: { opacity: 0.7 },
  saveText: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
});
