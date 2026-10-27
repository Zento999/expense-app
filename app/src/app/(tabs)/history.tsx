import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

export default function HistoryScreen() {
  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>ประวัติ</Text>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} />
          <Text style={styles.searchText}>ค้นหาร้าน, โน้ต</Text>
        </View>
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={48} color={Colors.primarySoft} />
          <Text style={styles.emptyTitle}>รายการจะขึ้นที่นี่</Text>
          <Text style={styles.emptyBody}>กดปุ่ม ＋ ด้านล่างเพื่อบันทึกรายจ่ายแรก (เปิดใช้ในบทที่ 4)</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  title: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lemon,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  searchText: { color: Colors.textSecondary, fontSize: FontSize.body },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingBottom: Spacing.six },
  emptyTitle: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text },
  emptyBody: { fontSize: FontSize.caption, color: Colors.textSecondary, textAlign: 'center' },
});
