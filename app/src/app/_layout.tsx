import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="backup" options={{ title: 'สำรองข้อมูล' }} />
        <Stack.Screen name="add/cash" options={{ title: 'เงินสด', presentation: 'modal' }} />
        <Stack.Screen name="add/scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="expense/[id]" options={{ title: 'รายละเอียด' }} />
        <Stack.Screen name="expense/edit/[id]" options={{ title: 'แก้ไขรายการ' }} />
      </Stack>
    </>
  );
}
