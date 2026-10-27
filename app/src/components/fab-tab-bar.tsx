import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AddSheet } from '@/components/add-sheet';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { on: IconName; off: IconName }> = {
  index: { on: 'pie-chart', off: 'pie-chart-outline' },
  history: { on: 'list', off: 'list-outline' },
};

/** แถบแท็บ: [สรุป] [＋] [ประวัติ] — ปุ่ม ＋ อยู่กลางจอ นิ้วโป้งเอื้อมถึงทั้งมือซ้ายและขวา */
export function FabTabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const tabs = state.routes.map((route, index) => {
    const focused = state.index === index;
    const icon = ICONS[route.name];
    const color = focused ? Colors.text : Colors.textSecondary;
    return (
      <Pressable
        key={route.key}
        style={styles.tab}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        onPress={() => {
          if (!focused) navigateToTab(route.key);
        }}>
        {icon && <Ionicons name={focused ? icon.on : icon.off} size={24} color={color} />}
        <Text style={[styles.label, { color }]}>{descriptors[route.key].options.title}</Text>
      </Pressable>
    );
  });

  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
        {tabs[0]}
        <View style={styles.tab}>
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityLabel="บันทึกรายจ่าย"
            style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
            <Ionicons name="add" size={32} color={Colors.text} />
          </Pressable>
        </View>
        {tabs.slice(1)}
      </View>
      <AddSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.lemon,
    paddingTop: Spacing.two,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.half },
  label: { fontSize: FontSize.caption },
  fab: {
    width: 64,
    height: 64,
    marginTop: -36, // ลอยขึ้นเหนือแถบ
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    borderWidth: 5,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.94 }] },
});
