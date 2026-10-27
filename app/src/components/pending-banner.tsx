import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ToastAndroid } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { flushQueue } from '@/lib/offline-queue';

type Props = { onSynced?: () => void }; // ส่งสำเร็จ → ให้หน้าที่ใช้ banner โหลดตัวเลขใหม่

/** "⏳ รอส่ง N รายการ" — ลองส่งเองทุกครั้งที่กลับมาหน้านี้ แตะเพื่อลองใหม่ทันที (ไม่มีคิว = ไม่แสดง) */
export function PendingBanner({ onSynced }: Props) {
  const [left, setLeft] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(
    (manual: boolean) => {
      flushQueue()
        .then(({ sent, left: remaining }) => {
          setLeft(remaining);
          if (sent > 0) {
            ToastAndroid.show(`ส่งรายการที่ค้างไว้แล้ว ${sent} รายการ`, ToastAndroid.SHORT);
            onSynced?.();
          } else if (manual && remaining > 0) {
            ToastAndroid.show('ยังติดต่อเซิร์ฟเวอร์ไม่ได้ — จะลองใหม่อัตโนมัติ', ToastAndroid.SHORT);
          }
        })
        .finally(() => setSyncing(false));
    },
    [onSynced],
  );

  useFocusEffect(
    useCallback(() => {
      sync(false);
    }, [sync]),
  );

  if (left === 0) return null;
  return (
    <Pressable
      onPress={() => {
        setSyncing(true);
        sync(true);
      }}
      style={styles.banner}
      accessibilityLabel="ส่งรายการที่ค้างอยู่">
      {syncing ? (
        <ActivityIndicator size="small" color={Colors.text} />
      ) : (
        <Ionicons name="cloud-upload-outline" size={18} color={Colors.text} />
      )}
      <Text style={styles.text}>รอส่ง {left} รายการ (บันทึกตอนออฟไลน์) — แตะเพื่อส่งตอนนี้</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.butter,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: { flex: 1, fontSize: FontSize.caption, color: Colors.text },
});
