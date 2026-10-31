import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, type ImageSource } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ImageViewer } from '@/components/image-viewer';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatBaht } from '@/lib/amount';
import { dateTimeLabel, THAI_WEEKDAYS_SHORT } from '@/lib/date';
import { deleteExpense, getExpense } from '@/lib/db';
import { localError } from '@/lib/errors';
import { deleteReceiptImage } from '@/lib/local-images';
import type { Expense, Source } from '@/lib/types';

const SOURCE_TEXT: Record<Source, { type: string; payee: string; icon: keyof typeof Ionicons.glyphMap }> = {
  cash: { type: 'เงินสด', payee: 'รายการ', icon: 'cash-outline' },
  slip: { type: 'สลิปโอนเงิน', payee: 'จ่ายให้', icon: 'receipt-outline' },
  receipt: { type: 'บิล / ใบเสร็จ', payee: 'ร้านค้า', icon: 'document-text-outline' },
};

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [image, setImage] = useState<ImageSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // โหลดใหม่ทุกครั้งที่กลับมาหน้านี้ — กลับจากหน้าแก้ไขจะเห็นค่าใหม่ทันที
  useFocusEffect(
    useCallback(() => {
      getExpense(expenseId).then(
        (e) => {
          if (!e) {
            setError('ไม่พบรายการนี้ — อาจถูกลบไปแล้ว');
            return;
          }
          setExpense(e);
          // รูปอยู่ในเครื่องแล้ว ใช้ path ตรงๆ ได้เลย ไม่ต้องแนบ token แบบตอนดึงจากเซิร์ฟเวอร์
          setImage(e.image_uri ? { uri: e.image_uri } : null);
        },
        (e) => setError(localError('โหลดรายการ', e)),
      );
    }, [expenseId]),
  );

  function confirmDelete() {
    Alert.alert('ลบรายการนี้?', 'ลบแล้วกู้คืนไม่ได้ รวมถึงรูปที่แนบไว้ด้วย', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            // ลบแถวก่อน แล้วค่อยลบไฟล์รูป — ถ้าลบไฟล์ก่อนแล้วลบแถวพัง รายการจะชี้ไปรูปที่หายไปแล้ว
            const imageUri = await deleteExpense(expenseId);
            deleteReceiptImage(imageUri);
            ToastAndroid.show('ลบแล้ว', ToastAndroid.SHORT);
            router.back();
          } catch (e) {
            ToastAndroid.show(localError('ลบ', e), ToastAndroid.LONG);
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (!expense) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={Colors.primary} />}
      </View>
    );
  }

  const text = SOURCE_TEXT[expense.source];
  const spentAt = new Date(expense.spent_at);
  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.amount}>{formatBaht(expense.amount)}</Text>
        <View style={[styles.categoryChip, { backgroundColor: expense.category.color }]}>
          <Text style={styles.categoryText}>
            {expense.category.icon} {expense.category.name}
          </Text>
        </View>

        {image && (
          <Pressable onPress={() => setZoomOpen(true)} style={styles.imageWrap} accessibilityLabel="ดูรูปเต็ม">
            <Image source={image} style={styles.image} contentFit="cover" />
            <View style={styles.zoomBadge}>
              <Ionicons name="expand-outline" size={16} color={Colors.text} />
            </View>
          </Pressable>
        )}

        <View style={styles.fields}>
          <Field label={text.payee} value={expense.payee || '—'} />
          <Field label="วันเวลา" value={`${THAI_WEEKDAYS_SHORT[spentAt.getDay()]} ${dateTimeLabel(spentAt)}`} />
          <Field label="ประเภท" value={text.type} icon={text.icon} />
          {expense.note && <Field label="โน้ต" value={expense.note} />}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          onPress={confirmDelete}
          disabled={deleting}
          style={({ pressed }) => [styles.deleteButton, (pressed || deleting) && styles.pressed]}>
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          <Text style={styles.deleteText}>ลบ</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/expense/edit/[id]', params: { id: String(expenseId) } })}
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
          <Ionicons name="pencil" size={18} color={Colors.text} />
          <Text style={styles.editText}>แก้ไข</Text>
        </Pressable>
      </View>

      <ImageViewer source={image} visible={zoomOpen} onClose={() => setZoomOpen(false)} />
    </SafeAreaView>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValueRow}>
        {icon && <Ionicons name={icon} size={16} color={Colors.text} />}
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: Spacing.four },
  error: { color: Colors.text, textAlign: 'center' },
  content: { padding: Spacing.three, alignItems: 'center', gap: Spacing.three },
  amount: { fontSize: 40, fontWeight: '800', color: Colors.text },
  categoryChip: { borderRadius: Radius.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, marginTop: -Spacing.two },
  categoryText: { fontSize: FontSize.body, color: Colors.text },
  imageWrap: { borderRadius: Radius.md, overflow: 'hidden', borderWidth: 1, borderColor: Colors.lemon },
  image: { width: 180, height: 260 },
  zoomBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    padding: 5,
  },
  fields: { alignSelf: 'stretch', gap: Spacing.three, marginTop: Spacing.two },
  field: { gap: 2 },
  fieldLabel: { fontSize: FontSize.caption, color: Colors.textSecondary },
  fieldValueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  fieldValue: { fontSize: FontSize.body, color: Colors.text },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.lemon,
  },
  // ปุ่มลบเล็กกว่า อยู่ซ้าย สีไม่เด่น — กันกดพลาด (และยังมีถามยืนยันอีกชั้น)
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    height: 54,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.lemon,
    backgroundColor: Colors.surface,
  },
  deleteText: { fontSize: FontSize.body, color: Colors.danger, fontWeight: '600' },
  editButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
  },
  editText: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  pressed: { opacity: 0.7 },
});
