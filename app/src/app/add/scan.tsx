import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountSheet } from '@/components/amount-sheet';
import { CategoryGrid } from '@/components/category-grid';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatTyped, isValidAmount, toApiAmount } from '@/lib/amount';
import { ApiError, createExpense, getCategories, readUpload, uploadImage } from '@/lib/api';
import { dateTimeLabel } from '@/lib/date';
import { pickImage, type ImageSource } from '@/lib/images';
import { getLastCategoryId, setLastCategoryId } from '@/lib/prefs';
import type { Category, ReadResult, ScanKind } from '@/lib/types';

type Phase = 'pick' | 'reading' | 'review';

const TEXT: Record<ScanKind, { title: string; payee: string }> = {
  slip: { title: 'สลิปโอนเงิน', payee: 'จ่ายให้' },
  receipt: { title: 'บิล / ใบเสร็จ', payee: 'ร้านค้า' },
};

function toast(message: string) {
  ToastAndroid.show(message, ToastAndroid.LONG);
}

function readErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 503) return 'ยังไม่ได้ตั้งค่า AI บนเซิร์ฟเวอร์ — กรอกเองได้เลย';
    if (e.status === 422) return 'AI อ่านรูปนี้ไม่ออก — กรอกเองได้เลย';
    if (e.status === 429) return 'AI ยุ่งอยู่ — กรอกเองได้เลย';
  }
  return 'AI อ่านไม่สำเร็จ — กรอกเองได้เลย';
}

/** ✨ บอกว่าช่องนี้ AI กรอกให้ */
function AiMark({ show }: { show: boolean }) {
  return show ? <Ionicons name="sparkles" size={14} color={Colors.primary} /> : null;
}

export default function ScanScreen() {
  // uri = รูปที่เลือกมาแล้วจาก bottom sheet (ถ้าไม่มี จะเริ่มที่หน้าเลือกรูป)
  const params = useLocalSearchParams<{ kind?: string; uri?: string }>();
  const kind: ScanKind = params.kind === 'receipt' ? 'receipt' : 'slip';
  const initialUri = typeof params.uri === 'string' && params.uri ? params.uri : null;
  const text = TEXT[kind];

  const [phase, setPhase] = useState<Phase>(initialUri ? 'reading' : 'pick');
  const [imageUri, setImageUri] = useState<string | null>(initialUri);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [ai, setAi] = useState<ReadResult | null>(null);
  const skipAi = useRef(false);

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [note, setNote] = useState('');
  const [spentAt, setSpentAt] = useState(new Date());

  const [amountOpen, setAmountOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /** อัปโหลด → ให้ AI อ่าน → ไปหน้าตรวจ (setState ทั้งหมดอยู่ใน callback หลังงานเสร็จ) */
  function processImage(uri: string) {
    skipAi.current = false;
    uploadImage(uri).then(
      async (id) => {
        setUploadId(id);
        if (skipAi.current) return; // ผู้ใช้กด "กรอกเองแทน" ไปแล้ว
        try {
          const result = await readUpload(id, kind);
          if (!skipAi.current) applyAi(result);
        } catch (e) {
          if (!skipAi.current) toast(readErrorMessage(e));
        }
        setPhase('review');
      },
      () => {
        toast('อัปโหลดรูปไม่สำเร็จ — เช็คการเชื่อมต่อแล้วลองใหม่');
        setImageUri(null);
        setPhase('pick');
      },
    );
  }

  /** ปุ่มในหน้าเลือกรูป (กรณีเปิดหน้านี้มาโดยยังไม่มีรูป หรืออัปโหลดพลาดแล้วเลือกใหม่) */
  async function start(source: ImageSource) {
    let uri: string | null;
    try {
      uri = await pickImage(source);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'เปิดรูปไม่ได้');
      return;
    }
    if (!uri) return; // ยกเลิก → อยู่หน้าเลือกรูปต่อ
    setImageUri(uri);
    setPhase('reading');
    processImage(uri);
  }

  function applyAi(r: ReadResult) {
    setAi(r);
    if (r.amount) setAmount(String(r.amount));
    if (r.payee) setPayee(r.payee);
    if (r.note) setNote(r.note);
    if (r.spent_at) setSpentAt(new Date(r.spent_at));
    if (r.category_id) setCategoryId(r.category_id);
  }

  function enterManually() {
    // รูปยังอัปโหลดต่อเบื้องหลัง (ต้องใช้แนบตอนบันทึก) แค่ไม่รอ AI
    skipAi.current = true;
    setPhase('review');
  }

  useEffect(() => {
    Promise.all([getCategories(), getLastCategoryId()]).then(
      ([cats, lastId]) => {
        setCategories(cats);
        const fallback = cats.some((c) => c.id === lastId) ? lastId : (cats[0]?.id ?? null);
        setCategoryId((current) => current ?? fallback); // ถ้า AI เลือกหมวดมาก่อนแล้ว ไม่ทับ
      },
      () => toast('โหลดหมวดหมู่ไม่ได้'),
    );
    if (initialUri) processImage(initialUri);
    // ทำครั้งเดียวตอนเปิดหน้า
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickDateTime() {
    DateTimePickerAndroid.open({
      value: spentAt,
      mode: 'date',
      maximumDate: new Date(),
      onChange: (event, day) => {
        if (event.type !== 'set' || !day) return;
        DateTimePickerAndroid.open({
          value: day,
          mode: 'time',
          is24Hour: true,
          onChange: (e, time) => {
            if (e.type === 'set' && time) setSpentAt(time);
          },
        });
      },
    });
  }

  async function onSave() {
    if (!isValidAmount(amount)) {
      toast('ใส่จำนวนเงินก่อน');
      setAmountOpen(true);
      return;
    }
    if (!uploadId) {
      toast('รอรูปอัปโหลดเสร็จก่อน');
      return;
    }
    if (categoryId === null) return;
    setSaving(true);
    try {
      await createExpense({
        amount: toApiAmount(amount),
        category_id: categoryId,
        source: kind,
        spent_at: spentAt.toISOString(),
        payee: payee.trim() || null,
        note: note.trim() || null,
        upload_id: uploadId,
      });
      await setLastCategoryId(categoryId);
      ToastAndroid.show(`บันทึก ฿${formatTyped(toApiAmount(amount))} แล้ว`, ToastAndroid.SHORT);
      router.back();
    } catch {
      toast('บันทึกไม่สำเร็จ — เช็คการเชื่อมต่อแล้วลองใหม่');
      setSaving(false);
    }
  }

  const header = <Stack.Screen options={{ title: phase === 'review' ? 'ตรวจก่อนบันทึก' : text.title }} />;

  if (phase === 'pick') {
    return (
      <View style={styles.center}>
        {header}
        <Ionicons name={kind === 'slip' ? 'receipt-outline' : 'document-text-outline'} size={56} color={Colors.primarySoft} />
        <Text style={styles.pickTitle}>เลือกรูป{text.title}</Text>
        <Pressable onPress={() => start('library')} style={({ pressed }) => [styles.bigButton, pressed && styles.pressed]}>
          <Ionicons name="images-outline" size={22} color={Colors.text} />
          <Text style={styles.bigButtonText}>เลือกจากรูปในเครื่อง</Text>
        </Pressable>
        <Pressable
          onPress={() => start('camera')}
          style={({ pressed }) => [styles.bigButton, styles.bigButtonAlt, pressed && styles.pressed]}>
          <Ionicons name="camera-outline" size={22} color={Colors.text} />
          <Text style={styles.bigButtonText}>ถ่ายรูป</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'reading') {
    return (
      <View style={styles.flex}>
        {header}
        {imageUri && <Image source={{ uri: imageUri }} style={styles.readingImage} contentFit="contain" />}
        <View style={styles.readingCard}>
          <View style={styles.sparkleCircle}>
            <Ionicons name="sparkles" size={24} color={Colors.text} />
          </View>
          <Text style={styles.readingTitle}>AI กำลังอ่าน{kind === 'slip' ? 'สลิป' : 'บิล'}…</Text>
          <Text style={styles.readingHint}>ประมาณ 3–10 วินาที</Text>
          <Pressable onPress={enterManually} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
            <Text style={styles.skipText}>กรอกเองแทน</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const confident = ai?.confidence === 'high';
  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      {header}
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable onPress={() => setZoomOpen(true)} accessibilityLabel="ดูรูปเต็ม">
            {imageUri && <Image source={{ uri: imageUri }} style={styles.thumb} contentFit="cover" />}
            <View style={styles.zoomBadge}>
              <Ionicons name="expand-outline" size={14} color={Colors.text} />
            </View>
          </Pressable>
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

        {ai?.doc_type === 'other' && (
          <Text style={styles.warning}>รูปนี้ไม่เหมือน{kind === 'slip' ? 'สลิปโอนเงิน' : 'บิล'} — ตรวจข้อมูลให้ดีก่อนบันทึก</Text>
        )}

        <View style={styles.labelRow}>
          <Text style={styles.label}>{text.payee}</Text>
          <AiMark show={ai?.payee != null} />
        </View>
        <TextInput
          style={styles.input}
          value={payee}
          onChangeText={setPayee}
          placeholder={kind === 'slip' ? 'ชื่อผู้รับ / ร้าน' : 'ชื่อร้าน'}
          placeholderTextColor={Colors.textSecondary}
          maxLength={200}
        />

        <View style={styles.labelRow}>
          <Text style={styles.label}>หมวด</Text>
          <AiMark show={ai?.category_id != null} />
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
          onPress={onSave}
          disabled={saving}
          style={({ pressed }) => [styles.save, !isValidAmount(amount) && styles.saveDim, (pressed || saving) && styles.pressed]}>
          {saving ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <Text style={styles.saveText}>
              {!uploadId ? 'กำลังอัปโหลดรูป…' : isValidAmount(amount) ? `บันทึก ฿${formatTyped(toApiAmount(amount))}` : 'บันทึก'}
            </Text>
          )}
        </Pressable>
      </View>

      <AmountSheet visible={amountOpen} value={amount} onChange={setAmount} onClose={() => setAmountOpen(false)} />

      <Modal visible={zoomOpen} transparent animationType="fade" onRequestClose={() => setZoomOpen(false)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoomOpen(false)} accessibilityLabel="ปิดรูป">
          {imageUri && <Image source={{ uri: imageUri }} style={styles.zoomImage} contentFit="contain" />}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  pickTitle: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text, marginBottom: Spacing.two },
  bigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    alignSelf: 'stretch',
    height: 60,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
  },
  bigButtonAlt: { backgroundColor: Colors.butter },
  bigButtonText: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text },

  readingImage: { flex: 1, margin: Spacing.four, opacity: 0.45 },
  readingCard: { alignItems: 'center', paddingBottom: Spacing.five, gap: Spacing.one },
  sparkleCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.butter,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  readingTitle: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  readingHint: { fontSize: FontSize.caption, color: Colors.textSecondary },
  skip: {
    marginTop: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.lemon,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  skipText: { color: Colors.text, fontSize: FontSize.body },

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

  zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center' },
  zoomImage: { flex: 1 },
});
