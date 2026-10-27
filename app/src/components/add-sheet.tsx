import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type Option = {
  key: 'slip' | 'receipt' | 'cash';
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const OPTIONS: Option[] = [
  { key: 'slip', title: 'สลิปโอนเงิน', subtitle: 'AI อ่านยอดให้', icon: 'receipt-outline', color: Colors.butter },
  { key: 'receipt', title: 'บิล / ใบเสร็จ', subtitle: 'ถ่ายรูปบิล', icon: 'document-text-outline', color: Colors.lemon },
  { key: 'cash', title: 'เงินสด', subtitle: 'พิมพ์ยอดเอง', icon: 'cash-outline', color: Colors.honey },
];

type Props = { visible: boolean; onClose: () => void };

/** Bottom sheet เลือกประเภทรายจ่าย — เลื่อนขึ้นจากล่าง ปุ่มอยู่ในระยะนิ้วโป้ง */
export function AddSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();

  function onPick(option: Option) {
    onClose();
    // แค่เปิดหน้า — หน้าอ่านสลิปจะเปิดแกลเลอรี/กล้องเองหลังขึ้นจอเสร็จ
    // (เปิดตัวเลือกรูปตอน bottom sheet กำลังปิด ทำให้ Android ทิ้งรูปที่เลือกครั้งแรก)
    if (option.key === 'cash') {
      router.push('/add/cash');
    } else {
      router.push({ pathname: '/add/scan', params: { kind: option.key } });
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="ปิด" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.handle} />
        <Text style={styles.heading}>บันทึกรายจ่าย</Text>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => onPick(o)}
            style={({ pressed }) => [styles.option, { backgroundColor: o.color }, pressed && styles.pressed]}>
            <View style={styles.iconWrap}>
              <Ionicons name={o.icon} size={26} color={Colors.text} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{o.title}</Text>
              <Text style={styles.optionSubtitle}>{o.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text} />
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.lemon,
    marginBottom: Spacing.two,
  },
  heading: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text, marginBottom: Spacing.one },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.md,
    padding: Spacing.three,
    minHeight: 72, // ปุ่มใหญ่ กดง่ายด้วยนิ้วโป้ง
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1 },
  optionTitle: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text },
  optionSubtitle: { fontSize: FontSize.caption, color: Colors.text, opacity: 0.75 },
  pressed: { opacity: 0.8 },
});
