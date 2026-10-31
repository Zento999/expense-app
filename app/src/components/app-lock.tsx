import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { authenticate, isLockEnabled, LOCK_AFTER_MS } from '@/lib/lock';

type State = 'checking' | 'locked' | 'open';

/**
 * ม่านล็อกทับทั้งแอป — วางไว้ใน root layout ต่อจาก <Stack>
 * ทับไว้แทนการเปลี่ยนหน้า: ปลดล็อกแล้วผู้ใช้อยู่หน้าเดิม ฟอร์มที่พิมพ์ค้างไม่หาย
 */
export function AppLock() {
  // เริ่มที่ 'checking' (ม่านปิดไว้ก่อน) — กันตัวเลขโผล่แวบหนึ่งก่อนรู้ว่าต้องล็อกไหม
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);
  const leftAt = useRef<number | null>(null);

  const unlock = useCallback(() => {
    setBusy(true);
    authenticate()
      .then((ok) => ok && setState('open'), (e) => console.warn('[lock] authenticate', e))
      .finally(() => setBusy(false));
  }, []);

  const lockIfEnabled = useCallback(() => {
    isLockEnabled().then(
      (on) => {
        if (!on) return setState('open');
        setState('locked');
        unlock(); // เด้งสแกนนิ้วให้เลย ไม่ต้องแตะก่อน
      },
      (e) => {
        console.warn('[lock] read setting', e);
        setState('open');
      },
    );
  }, [unlock]);

  useEffect(() => {
    lockIfEnabled();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') leftAt.current = Date.now();
      if (next === 'active' && leftAt.current !== null) {
        const away = Date.now() - leftAt.current;
        leftAt.current = null;
        if (away > LOCK_AFTER_MS) lockIfEnabled();
      }
    });
    return () => sub.remove();
  }, [lockIfEnabled]);

  if (state === 'open') return null;

  return (
    <View style={styles.cover}>
      {state === 'locked' && (
        <>
          <View style={styles.logo}>
            <Text style={styles.logoText}>🧾</Text>
          </View>
          <Text style={styles.title}>Expense ล็อกอยู่</Text>
          <Text style={styles.sub}>ข้อมูลการเงินของคุณปลอดภัย</Text>
          <Pressable
            onPress={unlock}
            disabled={busy}
            style={({ pressed }) => [styles.button, (pressed || busy) && styles.pressed]}
            accessibilityLabel="ปลดล็อก">
            <Ionicons name="finger-print" size={40} color={Colors.text} />
          </Pressable>
          <Text style={styles.title2}>แตะเพื่อปลดล็อก</Text>
          <Text style={styles.sub}>ใช้ PIN มือถือแทนได้</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    zIndex: 100,
    elevation: 100,
  },
  logo: { width: 88, height: 88, borderRadius: Radius.lg, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 48 },
  title: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text, marginTop: Spacing.two },
  title2: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text },
  sub: { fontSize: FontSize.caption, color: Colors.text },
  button: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.five,
  },
  pressed: { opacity: 0.6 },
});
