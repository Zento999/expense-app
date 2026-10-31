import * as Notifications from 'expo-notifications';
import { router, Stack, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';

// แจ้งเตือนเด้งตอนเปิดแอปอยู่ก็ยังโชว์ (ค่าเริ่มต้นคือซ่อน)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** แตะแจ้งเตือน → ไปหน้าที่แนบมากับแจ้งเตือน (เช่น /add/cash) */
function openFromNotification(response: Notifications.NotificationResponse | null) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string' && url !== '/') router.push(url as Href);
}

export default function RootLayout() {
  useEffect(() => {
    // แอปถูกเปิดขึ้นมาจากการแตะแจ้งเตือน (ตอนแอปปิดอยู่)
    openFromNotification(Notifications.getLastNotificationResponse());
    Notifications.clearLastNotificationResponse();
    // แตะแจ้งเตือนตอนแอปเปิดค้างอยู่เบื้องหลัง
    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, []);

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
        <Stack.Screen name="settings" options={{ title: 'ตั้งค่า' }} />
        <Stack.Screen name="backup" options={{ title: 'สำรองข้อมูล' }} />
        <Stack.Screen name="bill/[id]" options={{ title: 'บิล' }} />
        <Stack.Screen name="categories" options={{ title: 'หมวดหมู่' }} />
        <Stack.Screen name="category/[id]" options={{ title: 'หมวด' }} />
        <Stack.Screen name="add/cash" options={{ title: 'เงินสด', presentation: 'modal' }} />
        <Stack.Screen name="add/scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="expense/[id]" options={{ title: 'รายละเอียด' }} />
        <Stack.Screen name="expense/edit/[id]" options={{ title: 'แก้ไขรายการ' }} />
      </Stack>
    </>
  );
}
