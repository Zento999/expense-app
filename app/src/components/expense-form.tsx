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
import { getCategories } from '@/lib/db';
import { dateTimeLabel } from '@/lib/date';
import { getLastCategoryId } from '@/lib/prefs';
import type { Category, ReadResult } from '@/lib/types';

export type FormValues = {
  amount: string; // พร้อมส่ง API แล้ว เช่น "65.50"
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
  ai?: ReadResult | null; // มี = แสดง ✨ ตรงช่องที่ AI กรอก
  payeeLabel: string;
  payeePlaceholder: string;
  warning?: string | null;
  saving: boolean;
  blockedText?: string | null; // ข้อความบนปุ่มตอนยังบันทึกไม่ได้ เช่น "กำลังอัปโหลดรูป…"
  onSubmit: (values: FormValues) => void;
};

/** ✨ บอกว่าช่องนี้ AI กรอกให้ */
function AiMark({ show }: { show: boolean }) {
  return show ? <Ionicons name="sparkles" size={14} color={Colors.primary} /> : null;
}

/** ฟอร์มตรวจ/แก้รายจ่าย — ใช้ทั้งหน้าตรวจหลัง AI อ่าน (บทที่ 6) และหน้าแก้ไขรายการเก่า (บทที่ 8) */
export function ExpenseForm({
  initial,
  image,
  ai,
  payeeLabel,
  payeePlaceholder,
  warning,
  saving,
  blockedText,
  onSubmit,
}: Props) {
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
        setCategoryId((current) => current ?? fallback); // ค่าที่ส่งมา (AI/ของเดิม) มาก่อนเสมอ
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
    if (blockedText) {
      ToastAndroid.show(blockedText, ToastAndroid.SHORT);
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

  const confident = ai?.confidence === 'high';
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
            <View style={styles.labelRow}>
              <Text style={styles.label}>จำนวนเงิน</Text>
              <AiMark show={ai?.amount != null} />
            </View>
            <Pressable onPress={() => setAmountOpen(true)} accessibilityLabel="แก้จำนวนเงิน">
              <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                ฿{amount ? formatTyped(toApiAmount(amount)) : '0'}
              </Text>
            </Pressable>
            {ai && (
              <View style={[styles.badge, { backgroundColor: confident ? '#E8F3EA' : Colors.butter }]}>
                <Ionicons
                  name={confident ? 'checkmark-circle' : 'alert-circle'}
                  size={14}
                  color={confident ? Colors.success : Colors.text}
                />
                <Text style={styles.badgeText}>{confident ? 'AI มั่นใจ' : 'ตรวจยอดอีกครั้ง'}</Text>
              </View>
            )}
          </View>
        </View>

        {warning && <Text style={styles.warning}>{warning}</Text>}

        <View style={styles.labelRow}>
          <Text style={styles.label}>{payeeLabel}</Text>
          <AiMark show={ai?.payee != null} />
        </View>
        <TextInput
          style={styles.input}
          value={payee}
          onChangeText={setPayee}
          placeholder={payeePlaceholder}
          placeholderTextColor={Colors.textSecondary}
          maxLength={200}
        />

        <View style={styles.labelRow}>
          <Text style={styles.label}>หมวด</Text>
          {ai?.category_source === 'history' ? (
            <>
              <Ionicons name="time-outline" size={14} color={Colors.primary} />
              <Text style={styles.label}>ตามที่เคยบันทึกร้านนี้</Text>
            </>
          ) : (
            <AiMark show={ai?.category_id != null} />
          )}
        </View>
        {categories ? (
          <CategoryGrid categories={categories} selectedId={categoryId} onSelect={setCategoryId} />
        ) : (
          <ActivityIndicator color={Colors.primary} />
        )}

        <View style={styles.labelRow}>
          <Text style={styles.label}>วันเวลา</Text>
          <AiMark show={ai?.spent_at != null} />
        </View>
        <Pressable onPress={pickDateTime} style={styles.input}>
          <View style={styles.inline}>
            <Ionicons name="calendar-outline" size={16} color={Colors.text} />
            <Text style={styles.inputText}>{dateTimeLabel(spentAt)}</Text>
          </View>
        </Pressable>

        <View style={styles.labelRow}>
          <Text style={styles.label}>โน้ต</Text>
          <AiMark show={ai?.note != null} />
        </View>
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
            <Text style={styles.saveText}>
              {blockedText ?? (valid ? `บันทึก ฿${formatTyped(toApiAmount(amount))}` : 'บันทึก')}
            </Text>
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.two },
  label: { fontSize: FontSize.caption, color: Colors.textSecondary },
  amount: { fontSize: 34, fontWeight: '800', color: Colors.text },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  badgeText: { fontSize: FontSize.caption, color: Colors.text },
  warning: {
    backgroundColor: Colors.butter,
    borderRadius: Radius.sm,
    padding: Spacing.two,
    color: Colors.text,
    fontSize: FontSize.caption,
  },
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
