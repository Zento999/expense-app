import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatBaht } from '@/lib/amount';
import { timeLabel } from '@/lib/date';
import type { Expense, Source } from '@/lib/types';

export const SOURCE_LABEL: Record<Source, string> = { cash: 'เงินสด', slip: 'สลิป', receipt: 'บิล' };

type Props = { expense: Expense; onPress: () => void };

/** 1 แถวในหน้าประวัติ: [ไอคอนหมวด] ชื่อร้าน / ที่มา · เวลา   ฿ยอด */
export function ExpenseRow({ expense, onPress }: Props) {
  const { category } = expense;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.icon, { backgroundColor: category.color }]}>
        <Text style={styles.emoji}>{category.icon}</Text>
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {expense.payee || expense.note || category.name}
        </Text>
        <View style={styles.sub}>
          <Ionicons name={expense.has_image ? 'image-outline' : 'cash-outline'} size={12} color={Colors.textSecondary} />
          <Text style={styles.subText}>
            {SOURCE_LABEL[expense.source]} · {timeLabel(new Date(expense.spent_at))}
          </Text>
        </View>
      </View>
      <Text style={styles.amount}>{formatBaht(expense.amount)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#FFF3CC',
  },
  pressed: { opacity: 0.6 },
  icon: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20 },
  middle: { flex: 1, gap: 2 },
  title: { fontSize: FontSize.body, color: Colors.text, fontWeight: '600' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  subText: { fontSize: FontSize.caption, color: Colors.textSecondary },
  amount: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text },
});
