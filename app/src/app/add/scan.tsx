import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseForm, type FormValues } from '@/components/expense-form';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatTyped } from '@/lib/amount';
import { addExpense } from '@/lib/db';
import { localError } from '@/lib/errors';
import { pickImage, type ImageSource } from '@/lib/images';
import { deleteReceiptImage, saveReceiptImage } from '@/lib/local-images';
import { setLastCategoryId } from '@/lib/prefs';
import type { ScanKind } from '@/lib/types';

const TEXT: Record<ScanKind, { title: string; payee: string; placeholder: string; source: ImageSource }> = {
  // สลิปส่วนใหญ่เซฟอยู่ในแกลเลอรีแล้ว / บิลกระดาษต้องถ่ายใหม่
  slip: { title: 'สลิปโอนเงิน', payee: 'จ่ายให้', placeholder: 'ชื่อผู้รับ / ร้าน', source: 'library' },
  receipt: { title: 'บิล / ใบเสร็จ', payee: 'ร้านค้า', placeholder: 'ชื่อร้าน', source: 'camera' },
};

function toast(message: string) {
  ToastAndroid.show(message, ToastAndroid.LONG);
}

/** แนบรูปสลิป/บิล แล้วกรอกรายละเอียดเอง — รูปเก็บในเครื่อง (แอปแบบ offline ไม่มี AI อ่านให้) */
export default function ScanScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: ScanKind = params.kind === 'receipt' ? 'receipt' : 'slip';
  const text = TEXT[kind];

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const imageRef = useRef<string | null>(null); // ไว้ลบไฟล์ตอนออกจากหน้าโดยไม่บันทึก
  const saved = useRef(false);

  /** เลือก/ถ่ายรูป → เขียนลงโฟลเดอร์ของแอปทันที (setState อยู่ใน callback หลังเสร็จ) */
  function start(source: ImageSource, { closeOnCancel = false } = {}) {
    pickImage(source)
      .then(async (picked) => {
        if (!picked) {
          if (closeOnCancel) router.back(); // เปิดอัตโนมัติแล้วกดยกเลิก = ไม่อยากบันทึกแล้ว
          return;
        }
        const uri = await saveReceiptImage(picked.bytes);
        deleteReceiptImage(imageRef.current); // เลือกรูปใหม่ → ลบรูปเก่าที่ยังไม่ได้ใช้
        imageRef.current = uri;
        setImageUri(uri);
      })
      .catch((e) => toast(localError('เปิดรูป', e)));
  }

  useEffect(() => {
    start(text.source, { closeOnCancel: true });
    // ออกจากหน้านี้โดยไม่ได้บันทึก → ลบรูปที่เขียนไว้ ไม่ให้ค้างกินพื้นที่
    return () => {
      if (!saved.current) deleteReceiptImage(imageRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(values: FormValues) {
    if (!imageUri) return;
    setSaving(true);
    try {
      await addExpense({ ...values, source: kind, imageUri });
      saved.current = true;
      await setLastCategoryId(values.categoryId);
      ToastAndroid.show(`บันทึก ฿${formatTyped(values.amount)} แล้ว`, ToastAndroid.SHORT);
      router.back();
    } catch (e) {
      toast(localError('บันทึก', e));
      setSaving(false);
    }
  }

  if (!imageUri) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: text.title }} />
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

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <Stack.Screen options={{ title: `กรอก${text.title}` }} />
      <ExpenseForm
        initial={{}}
        image={{ uri: imageUri }}
        payeeLabel={text.payee}
        payeePlaceholder={text.placeholder}
        saving={saving}
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
  pressed: { opacity: 0.7 },
});
