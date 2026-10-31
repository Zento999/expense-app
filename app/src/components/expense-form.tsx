import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Image, type ImageSource } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, ToastAndroid, View } from 'react-native';

import { AmountSheet } from '@/components/amount-sheet';
import { CategoryGrid } from '@/components/category-grid';
import { ImageViewer } from '@/components/image-viewer';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatTyped, isValidAmount, toApiAmount } from '@/lib/amount';
import { dateTimeLabel } from '@/lib/date';
import { getCategories } from '@/lib/db';
import { getLastCategoryId } from '@/lib/prefs';
import type { Category } from '@/lib/types';

export type FormValues = {
  amount: string; // ทศนิยม 2 ตำแหน่งเสมอ เช่น "65.50"
  categoryId: number;
  payee: string | null;
  note: string | null;
  spentAt: Date;
};

type Props = {
  initial: {
    amount?: string;
    categoryId?: number | null;
    payee?: string | null;
    note?: string | null;
    spentAt?: Date;
  };
  image?: ImageSource | null;
  payeeLabel: string;
  payeePlaceholder: string;
  saving: boolean;
  onSubmit: (values: FormValues) => void;
};

/** ฟอร์มกรอก/แก้รายจ่าย — ใช้ทั้งหน้าแนบสลิป/บิล และหน้าแก้ไขรายการเก่า */
export function ExpenseForm({ initial, image, payeeLabel, payeePlaceholder, saving, onSubmit }: Props) {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(initial.categoryId ?? null);
  const [amount, setAmount] = useState(initial.amount ?? '');
  const [payee, setPayee] = useState(initial.payee ?? '');
  const [note, setNote] = useState(initial.note ?? '');
  const [spentAt, setSpentAt] = useState(initial.spentAt ?? new Date());
  const [amountOpen, setAmountOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    Promise.all([getCategories(), getLastCategoryId()]).then(
      ([cats, lastId]) => {
        setCategories(cats);
        const fallback = cats.some((c) => c.id === lastId) ? lastId : (cats[0]?.id ?? null);
        setCategoryId((current) => current ?? fallback); // ค่าเดิมของรายการมาก่อนเสมอ
      },
      () => ToastAndroid.show('โหลดหมวดหมู่ไม่ได้', ToastAndroid.LONG),
    );
  }, []);

  function pickDateTime() {
    DateTimePickerAndroid.open({
      value: spentAt,
      mode: 'date',
      maximumDate: new Date(),
      // เลือกวันเสร็จ → เปิดตัวเลือกเวลาต่อ (กดยกเลิก = ไม่เปลี่ยนอะไร)
      onValueChange: (_event, day) => {
        DateTimePickerAndroid.open({
          value: day,
          mode: 'time',
          is24Hour: true,
          onValueChange: (_e, time) => setSpentAt(time),
        });
      },
    });
  }

  function submit() {
    if (!isValidAmount(amount)) {
      ToastAndroid.show('ใส่จำนวนเงินก่อน', ToastAndroid.SHORT);
      setAmountOpen(true);
      return;
    }
    if (categoryId === null) return;
    onSubmit({
      amount: toApiAmount(amount),
      categoryId,
      payee: payee.trim() || null,
      note: note.trim() || null,
      spentAt,
    });
  }

  const valid = isValidAmount(amount);
  return (
    <>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          {image && (
            <Pressable onPress={() => setZoomOpen(true)} accessibilityLabel="ดูรูปเต็ม">
              <Image source={image} style={styles.thumb} contentFit="cover" />
              <View style={styles.zoomBadge}>
                <Ionicons name="expand-outline" size={14} color={Colors.text} />
              </View>
            </Pressable>
          )}
          <View style={styles.flex}>
            <Text style={[styles.label, styles.labelTop]}>จำนวนเงิน</Text>
            <Pressable onPress={() => setAmountOpen(true)} accessibilityLabel="แก้จำนวนเงิน">
              <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                ฿{amount ? formatTyped(toApiAmount(amount)) : '0'}
              </Text>
            </Pressable>
            {!amount && <Text style={styles.hint}>แตะเพื่อใส่ยอดเงิน</Text>}
          </View>
        </View>

        <Text style={styles.label}>{payeeLabel}</Text>
        <TextInput
          style={styles.input}
          value={payee}
          onChangeText={setPayee}
          placeholder={payeePlaceholder}
          placeholderTextColor={Colors.textSecondary}
          maxLength={200}
        />

        <Text style={styles.label}>หมวด</Text>
        {categories ? (
          <CategoryGrid categories={categories} selectedId={categoryId} onSelect={setCategoryId} />
        ) : (
          <ActivityIndicator color={Colors.primary} />
        )}

        <Text style={styles.label}>วันเวลา</Text>
        <Pressable onPress={pickDateTime} style={styles.input}>
          <View style={styles.inline}>
            <Ionicons name="calendar-outline" size={16} color={Colors.text} />
            <Text style={styles.inputText}>{dateTimeLabel(spentAt)}</Text>
          </View>
        </Pressable>

        <Text style={styles.label}>โน้ต</Text>
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder="เพิ่มโน้ต"
          placeholderTextColor={Colors.textSecondary}
          maxLength={1000}
        />
      </ScrollView>

      <View style={styles.bottom}>
        <Pressable
          onPress={submit}
          disabled={saving}
          style={({ pressed }) => [styles.save, !valid && styles.saveDim, (pressed || saving) && styles.pressed]}>
          {saving ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <Text style={styles.saveText}>{valid ? `บันทึก ฿${formatTyped(toApiAmount(amount))}` : 'บันทึก'}</Text>
          )}
        </Pressable>
      </View>

      <AmountSheet visible={amountOpen} value={amount} onChange={setAmount} onClose={() => setAmountOpen(false)} />
      <ImageViewer source={image ?? null} visible={zoomOpen} onClose={() => setZoomOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { padding: Spacing.three, gap: Spacing.two },
  topRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  thumb: { width: 72, height: 96, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.lemon },
  zoomBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    padding: 3,
  },
  label: { fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: Spacing.two },
  labelTop: { marginTop: 0 },
  amount: { fontSize: 34, fontWeight: '800', color: Colors.text },
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
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  inputText: { fontSize: FontSize.body, color: Colors.text },
  bottom: { backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.lemon, padding: Spacing.three },
  save: { height: 58, borderRadius: Radius.lg, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveDim: { backgroundColor: Colors.lemon },
  saveText: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  pressed: { opacity: 0.7 },
});
