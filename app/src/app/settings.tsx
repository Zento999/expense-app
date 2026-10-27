import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { checkConnection } from '@/lib/api';
import { loadSettings, saveSettings } from '@/lib/settings';

const ERRORS = {
  'not-configured': ['ยังกรอกไม่ครบ', 'ใส่ทั้งที่อยู่เซิร์ฟเวอร์และ token'],
  unreachable: ['ติดต่อเซิร์ฟเวอร์ไม่ได้', 'เช็คที่อยู่เซิร์ฟเวอร์ ดูว่าเปิด Tailscale อยู่ และ Docker บนคอมยังรัน'],
  'bad-token': ['Token ไม่ถูกต้อง', 'ก๊อปค่า APP_TOKEN จากไฟล์ .env บนคอมมาใหม่'],
} as const;

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [appToken, setAppToken] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setServerUrl(s.serverUrl);
      setAppToken(s.appToken);
    });
  }, []);

  async function onSave() {
    setTesting(true);
    await saveSettings({ serverUrl, appToken });
    const status = await checkConnection();
    setTesting(false);
    if (status === 'ok') {
      router.back();
    } else {
      const [title, body] = ERRORS[status];
      Alert.alert(`บันทึกแล้ว แต่${title}`, body);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>ที่อยู่เซิร์ฟเวอร์</Text>
      <TextInput
        style={styles.input}
        value={serverUrl}
        onChangeText={setServerUrl}
        placeholder="http://100.x.x.x:8790"
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <Text style={styles.hint}>ใช้ IP ของ Tailscale (ขึ้นต้นด้วย 100.) ตามด้วยพอร์ต 8790</Text>

      <Text style={styles.label}>App token</Text>
      <TextInput
        style={styles.input}
        value={appToken}
        onChangeText={setAppToken}
        placeholder="ค่า APP_TOKEN ในไฟล์ .env"
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      <Pressable
        onPress={onSave}
        disabled={testing}
        style={({ pressed }) => [styles.button, (pressed || testing) && styles.pressed]}>
        <Text style={styles.buttonText}>{testing ? 'กำลังทดสอบ…' : 'บันทึกและทดสอบ'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.two },
  label: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text, marginTop: Spacing.two },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lemon,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  hint: { fontSize: FontSize.caption, color: Colors.textSecondary },
  button: {
    marginTop: Spacing.four,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
  // ตัวอักษรน้ำตาลเข้มบนปุ่มเหลือง (ขาวบนเหลือง contrast ต่ำ อ่านยากกลางแดด)
  buttonText: { color: Colors.text, fontWeight: '700', fontSize: FontSize.body },
});
