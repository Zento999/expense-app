import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { checkConnection, type ConnectionStatus } from '@/lib/api';

const LABELS: Record<ConnectionStatus | 'checking', string> = {
  checking: 'กำลังเชื่อมต่อ…',
  ok: 'เชื่อมต่อแล้ว',
  'not-configured': 'แตะเพื่อตั้งค่าเซิร์ฟเวอร์',
  unreachable: 'ติดต่อเซิร์ฟเวอร์ไม่ได้ — เปิด Tailscale/คอมหรือยัง',
  'bad-token': 'Token ไม่ถูกต้อง — แตะเพื่อแก้',
};

/** บอกสถานะการเชื่อมต่อ เช็คใหม่ทุกครั้งที่กลับมาหน้านี้ (เช่นหลังกลับจากหน้าตั้งค่า) */
export function ConnectionBadge() {
  const [status, setStatus] = useState<ConnectionStatus | 'checking'>('checking');

  useFocusEffect(
    useCallback(() => {
      checkConnection().then(setStatus);
    }, []),
  );

  // โชว์เฉพาะตอนมีปัญหา — เชื่อมต่อปกติไม่ต้องรกหน้าจอ
  if (status === 'ok' || status === 'checking') return null;
  return (
    <Pressable onPress={() => router.push('/settings')} style={styles.badge}>
      <Ionicons name="alert-circle" size={16} color={Colors.text} />
      <Text style={styles.text}>{LABELS[status]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderWidth: 1,
    borderColor: Colors.lemon,
    backgroundColor: Colors.butter,
  },
  text: { fontSize: FontSize.caption, color: Colors.text },
});
