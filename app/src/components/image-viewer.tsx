import { Image, type ImageSource } from 'expo-image';
import { Modal, Pressable, StyleSheet } from 'react-native';

type Props = { source: ImageSource | null; visible: boolean; onClose: () => void };

/** ดูรูปสลิป/บิลเต็มจอ — แตะที่ไหนก็ได้เพื่อปิด */
export function ImageViewer({ source, visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="ปิดรูป">
        {source && <Image source={source} style={styles.image} contentFit="contain" />}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center' },
  image: { flex: 1 },
});
