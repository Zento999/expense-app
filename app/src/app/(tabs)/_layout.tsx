import { Tabs } from 'expo-router/js-tabs';

import { FabTabBar } from '@/components/fab-tab-bar';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      // ใช้แถบแท็บที่เราวาดเอง เพราะต้องมีปุ่ม ＋ ลอยตรงกลาง (แถบมาตรฐานทำไม่ได้)
      tabBar={(props) => <FabTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'สรุป' }} />
      <Tabs.Screen name="history" options={{ title: 'ประวัติ' }} />
    </Tabs>
  );
}
