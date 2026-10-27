import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { NumpadKey } from '@/lib/amount';

const ROWS: NumpadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
];

type Props = { onKey: (key: NumpadKey) => void };

/** แป้นตัวเลขของแอปเอง: ตำแหน่งคงที่ ไม่บังจอแบบคีย์บอร์ดระบบ และพิมพ์ได้เฉพาะค่าที่ถูกต้อง */
export function Numpad({ onKey }: Props) {
  return (
    <View style={styles.grid}>
      {ROWS.map((row) => (
        <View key={row.join()} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              onPress={() => onKey(key)}
              accessibilityLabel={key === 'back' ? 'ลบ' : key}
              style={({ pressed }) => [styles.key, pressed && styles.pressed]}>
              {key === 'back' ? (
                <Ionicons name="backspace-outline" size={26} color={Colors.text} />
              ) : (
                <Text style={styles.keyText}>{key}</Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  key: {
    flex: 1,
    height: 54,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lemon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: Colors.butter },
  keyText: { fontSize: 24, fontWeight: '600', color: Colors.text },
});
