import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, ToastAndroid, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { createBackupFile, pickBackupFile, restoreBackup, shareBackupFile, type ParsedBackup } from '@/lib/backup';
import { dateTimeLabel } from '@/lib/date';
import { countExpenses } from '@/lib/db';
import { localError } from '@/lib/errors';
import { listReceiptFiles } from '@/lib/local-images';
import { getLastBackupAt, setLastBackupAt } from '@/lib/prefs';

const REMIND_AFTER_DAYS = 7;

type Stats = { expenses: number; images: number; imageMb: number; lastBackupAt: Date | null };

function daysSince(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export default function BackupScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);

  const loadStats = useCallback(() => {
    Promise.all([countExpenses(), getLastBackupAt()]).then(
      ([expenses, lastBackupAt]) => {
        const files = listReceiptFiles();
        const bytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
        setStats({ expenses, images: files.length, imageMb: bytes / 1024 / 1024, lastBackupAt });
      },
      (e) => ToastAndroid.show(localError('โหลดข้อมูล', e), ToastAndroid.LONG),
    );
  }, []);

  useFocusEffect(loadStats);

  async function onBackup() {
    setBusy('backup');
    try {
      const { uri } = await createBackupFile();
      await setLastBackupAt(new Date());
      await shareBackupFile(uri); // ผู้ใช้เลือกที่เก็บเองในหน้าแชร์ของ Android
      loadStats();
    } catch (e) {
      ToastAndroid.show(localError('สำรองข้อมูล', e), ToastAndroid.LONG);
    } finally {
      setBusy(null);
    }
  }

  async function onRestore() {
    let backup: ParsedBackup | null;
    setBusy('restore');
    try {
      backup = await pickBackupFile();
    } catch (e) {
      ToastAndroid.show(localError('เปิดไฟล์สำรอง', e), ToastAndroid.LONG);
      setBusy(null);
      return;
    }
    setBusy(null);
    if (!backup) return;

    const { manifest } = backup;
    Alert.alert(
      'กู้คืนข้อมูลจากไฟล์นี้?',
      `สำรองเมื่อ ${dateTimeLabel(new Date(manifest.created_at))}\n${manifest.expenses} รายการ · ${manifest.images} รูป\n\n` +
        'ข้อมูลที่อยู่ในเครื่องตอนนี้จะถูกแทนที่ทั้งหมด (กู้คืนไม่ได้)',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'กู้คืน',
          style: 'destructive',
          onPress: async () => {
            setBusy('restore');
            try {
              const n = await restoreBackup(backup);
              ToastAndroid.show(`กู้คืนแล้ว ${n} รายการ`, ToastAndroid.LONG);
              loadStats();
            } catch (e) {
              ToastAndroid.show(localError('กู้คืน', e), ToastAndroid.LONG);
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  const last = stats?.lastBackupAt ?? null;
  const overdue = !last || daysSince(last) >= REMIND_AFTER_DAYS;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>ข้อมูลในเครื่อง</Text>
        {stats ? (
          <>
            <Row label="รายการรายจ่าย" value={`${stats.expenses}`} />
            <Row label="รูปสลิป / บิล" value={`${stats.images} รูป`} />
            <Row label="ขนาดรูปทั้งหมด" value={`~${stats.imageMb.toFixed(1)} MB`} />
          </>
        ) : (
          <ActivityIndicator color={Colors.primary} />
        )}
      </View>

      {stats && (
        <View style={[styles.card, overdue && styles.cardWarn]}>
          <View style={styles.inline}>
            <Ionicons name={overdue ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={20} color={Colors.text} />
            <View style={styles.flex}>
              <Text style={styles.strong}>
                {last ? `สำรองล่าสุด ${daysSince(last) === 0 ? 'วันนี้' : `${daysSince(last)} วันก่อน`}` : 'ยังไม่เคยสำรองข้อมูล'}
              </Text>
              <Text style={styles.small}>
                {overdue ? 'ข้อมูลอยู่ในมือถือเครื่องเดียว ควรสำรองสัปดาห์ละครั้ง' : 'เยี่ยม! สำรองไว้ไม่เกิน 7 วัน'}
              </Text>
            </View>
          </View>
        </View>
      )}

      <Pressable
        onPress={onBackup}
        disabled={busy !== null}
        style={({ pressed }) => [styles.button, styles.primary, (pressed || busy) && styles.pressed]}>
        {busy === 'backup' ? (
          <ActivityIndicator color={Colors.text} />
        ) : (
          <Ionicons name="archive-outline" size={20} color={Colors.text} />
        )}
        <Text style={styles.buttonText}>{busy === 'backup' ? 'กำลังรวมไฟล์…' : 'สำรองข้อมูลตอนนี้'}</Text>
      </Pressable>
      <Text style={styles.caption}>ได้ไฟล์ .zip 1 ไฟล์ เลือกส่งไป Google Drive, LINE Keep หรือที่อื่นได้</Text>

      <Pressable
        onPress={onRestore}
        disabled={busy !== null}
        style={({ pressed }) => [styles.button, styles.secondary, (pressed || busy) && styles.pressed]}>
        {busy === 'restore' ? (
          <ActivityIndicator color={Colors.text} />
        ) : (
          <Ionicons name="refresh-outline" size={20} color={Colors.text} />
        )}
        <Text style={styles.buttonText}>{busy === 'restore' ? 'กำลังกู้คืน…' : 'กู้คืนจากไฟล์สำรอง'}</Text>
      </Pressable>
      <Text style={styles.caption}>ใช้ตอนเปลี่ยนมือถือ หรือติดตั้งแอปใหม่</Text>

      <Text style={styles.note}>
        ⚠️ ไฟล์สำรองไม่ได้เข้ารหัส และมีรูปสลิปทั้งหมดอยู่ข้างใน — เก็บในที่ส่วนตัว อย่าส่งให้คนอื่น
      </Text>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.strong}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.two, backgroundColor: Colors.background, flexGrow: 1 },
  flex: { flex: 1 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lemon,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardWarn: { backgroundColor: '#FFF6D6', borderColor: Colors.honey },
  cardLabel: { fontSize: FontSize.caption, color: Colors.textSecondary, marginBottom: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: FontSize.body, color: Colors.text },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  strong: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text },
  small: { fontSize: FontSize.caption, color: Colors.text },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 56,
    borderRadius: Radius.lg,
    marginTop: Spacing.two,
  },
  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.lemon },
  pressed: { opacity: 0.7 },
  buttonText: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text },
  caption: { fontSize: FontSize.caption, color: Colors.textSecondary, textAlign: 'center' },
  note: { fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: Spacing.four, lineHeight: 18 },
});
