import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectionBadge } from '@/components/connection-badge';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export default function SummaryScreen() {
  const now = new Date();
  const monthLabel = `${THAI_MONTHS[now.getMonth()]} ${now.getFullYear() + 543}`;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.month}>{monthLabel}</Text>
          <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel="ตั้งค่า">
            <Ionicons name="settings-outline" size={24} color={Colors.text} />
          </Pressable>
        </View>

        <ConnectionBadge />

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>ใช้ไปเดือนนี้</Text>
          <Text style={styles.totalAmount}>฿0</Text>
          <Text style={styles.placeholder}>ยอดจริงจะมาในบทที่ 9</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>แยกตามหมวด</Text>
          <Text style={styles.placeholder}>กราฟโดนัทจะมาในบทที่ 9</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  month: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  totalCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  totalLabel: { fontSize: FontSize.body, color: Colors.text },
  totalAmount: { fontSize: FontSize.big, fontWeight: '800', color: Colors.text },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two },
  cardTitle: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text },
  placeholder: { fontSize: FontSize.caption, color: Colors.text, opacity: 0.6 },
});
