import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { Category } from '@/lib/types';

type Props = {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

/** ปุ่มหมวด 5 คอลัมน์ — แตะเดียวเลือกได้ อันที่เลือกเป็นสีของหมวด + ขอบเข้ม */
export function CategoryGrid({ categories, selectedId, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {categories.map((c) => {
        const selected = c.id === selectedId;
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={c.name}
            style={[styles.cell, selected && { backgroundColor: c.color, borderColor: Colors.text }]}>
            <Text style={styles.icon}>{c.icon}</Text>
            <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.two },
  cell: {
    width: '20%',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.half,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  icon: { fontSize: 24 },
  name: { fontSize: FontSize.caption - 1, color: Colors.text, marginTop: Spacing.half },
});
