import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Numpad } from '@/components/numpad';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatTyped, pressKey } from '@/lib/amount';

type Props = {
  visible: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
};

/** แก้ยอดเงินด้วย numpad ตัวเดียวกับหน้าเงินสด (เลื่อนขึ้นจากล่าง) */
export function AmountSheet({ visible, value, onChange, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="ปิด" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}>
        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          ฿{formatTyped(value)}
        </Text>
        <Numpad onKey={(key) => onChange(pressKey(value, key))} />
        <Pressable onPress={onClose} style={({ pressed }) => [styles.done, pressed && styles.pressed]}>
          <Text style={styles.doneText}>ตกลง</Text>
        </Pressable>
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
    padding: Spacing.three,
    gap: Spacing.three,
  },
  amount: { textAlign: 'center', fontSize: 40, fontWeight: '800', color: Colors.text },
  done: { height: 54, borderRadius: Radius.lg, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  pressed: { opacity: 0.7 },
});
