import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseForm, type FormValues } from '@/components/expense-form';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatTyped } from '@/lib/amount';
import { ApiError, createExpense, describeError, readUpload, uploadImage } from '@/lib/api';
import { pickImage, takePickedImage, type ImageSource, type PickedImage } from '@/lib/images';
import { setLastCategoryId } from '@/lib/prefs';
import type { ReadResult, ScanKind } from '@/lib/types';

type Phase = 'pick' | 'reading' | 'review';

const TEXT: Record<ScanKind, { title: string; payee: string; placeholder: string; docName: string }> = {
  slip: { title: 'สลิปโอนเงิน', payee: 'จ่ายให้', placeholder: 'ชื่อผู้รับ / ร้าน', docName: 'สลิป' },
  receipt: { title: 'บิล / ใบเสร็จ', payee: 'ร้านค้า', placeholder: 'ชื่อร้าน', docName: 'บิล' },
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
  console.warn('[AI read]', e);
  return 'AI อ่านไม่สำเร็จ — กรอกเองได้เลย';
}

export default function ScanScreen() {
  // uri = รูปที่เลือกมาแล้วจาก bottom sheet (bytes ฝากไว้ใน images.ts)
  // ถ้าไม่มี (หรือหาย เช่นหลัง reload แอป) จะเริ่มที่หน้าเลือกรูป
  const params = useLocalSearchParams<{ kind?: string; uri?: string }>();
  const kind: ScanKind = params.kind === 'receipt' ? 'receipt' : 'slip';
  const text = TEXT[kind];
  const [initialImage] = useState(() => (typeof params.uri === 'string' ? takePickedImage(params.uri) : null));

  const [phase, setPhase] = useState<Phase>(initialImage ? 'reading' : 'pick');
  const [imageUri, setImageUri] = useState<string | null>(initialImage?.uri ?? null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [ai, setAi] = useState<ReadResult | null>(null);
  const [saving, setSaving] = useState(false);
  const skipAi = useRef(false);

  /** อัปโหลด → ให้ AI อ่าน → ไปหน้าตรวจ (setState ทั้งหมดอยู่ใน callback หลังงานเสร็จ) */
  function processImage(image: PickedImage) {
    skipAi.current = false;
    uploadImage(image.bytes).then(
      async (id) => {
        setUploadId(id);
        if (skipAi.current) return; // ผู้ใช้กด "กรอกเองแทน" ไปแล้ว
        try {
          const result = await readUpload(id, kind);
          if (!skipAi.current) setAi(result);
        } catch (e) {
          if (!skipAi.current) toast(readErrorMessage(e));
        }
        setPhase('review');
      },
      (e) => {
        toast(describeError(e, 'อัปโหลดรูป'));
        setImageUri(null);
        setPhase('pick');
      },
    );
  }

  /** ปุ่มในหน้าเลือกรูป (กรณีเปิดหน้านี้มาโดยยังไม่มีรูป หรืออัปโหลดพลาดแล้วเลือกใหม่) */
  async function start(source: ImageSource) {
    let image: PickedImage | null;
    try {
      image = await pickImage(source);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'เปิดรูปไม่ได้');
      return;
    }
    if (!image) return; // ยกเลิก → อยู่หน้าเลือกรูปต่อ
    setImageUri(image.uri);
    setPhase('reading');
    processImage(image);
  }

  function enterManually() {
    // รูปยังอัปโหลดต่อเบื้องหลัง (ต้องใช้แนบตอนบันทึก) แค่ไม่รอ AI
    skipAi.current = true;
    setPhase('review');
  }

  useEffect(() => {
    if (initialImage) processImage(initialImage);
    // ทำครั้งเดียวตอนเปิดหน้า
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(values: FormValues) {
    if (!uploadId) return;
    setSaving(true);
    try {
      await createExpense({
        amount: values.amount,
        category_id: values.categoryId,
        source: kind,
        spent_at: values.spentAt.toISOString(),
        payee: values.payee,
        note: values.note,
        upload_id: uploadId,
      });
      await setLastCategoryId(values.categoryId);
      ToastAndroid.show(`บันทึก ฿${formatTyped(values.amount)} แล้ว`, ToastAndroid.SHORT);
      router.back();
    } catch (e) {
      toast(describeError(e, 'บันทึก'));
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
          <Text style={styles.readingTitle}>AI กำลังอ่าน{text.docName}…</Text>
          <Text style={styles.readingHint}>ประมาณ 3–10 วินาที</Text>
          <Pressable onPress={enterManually} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
            <Text style={styles.skipText}>กรอกเองแทน</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      {header}
      <ExpenseForm
        initial={{
          amount: ai?.amount ? String(ai.amount) : undefined,
          categoryId: ai?.category_id,
          payee: ai?.payee,
          note: ai?.note,
          spentAt: ai?.spent_at ? new Date(ai.spent_at) : undefined,
        }}
        image={imageUri ? { uri: imageUri } : null}
        ai={ai}
        payeeLabel={text.payee}
        payeePlaceholder={text.placeholder}
        warning={ai?.doc_type === 'other' ? `รูปนี้ไม่เหมือน${text.title} — ตรวจข้อมูลให้ดีก่อนบันทึก` : null}
        saving={saving}
        blockedText={uploadId ? null : 'กำลังอัปโหลดรูป…'}
        onSubmit={save}
      />
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
  pressed: { opacity: 0.7 },
});
