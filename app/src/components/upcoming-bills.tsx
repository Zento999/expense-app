import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { formatBaht } from '@/lib/amount';
import type { DueBill } from '@/lib/bills';
import { THAI_MONTHS_SHORT } from '@/lib/date';

function dueLabel(b: DueBill): { text: string; urgent: boolean } {
  if (b.daysLeft < 0) return { text: `เลยกำหนด ${-b.daysLeft} วัน`, urgent: true };
  if (b.daysLeft === 0) return { text: 'วันนี้', urgent: true };
  if (b.daysLeft <= 3) return { text: `อีก ${b.daysLeft} วัน`, urgent: true };
  return { text: `${b.dueDate.getDate()} ${THAI_MONTHS_SHORT[b.dueDate.getMonth()]}`, urgent: false };
}

type Props = { bills: DueBill[]; onPay: (bill: DueBill) => void; busyId: number | null };

/** บิลที่ค้าง/ใกล้ถึง พร้อมปุ่ม "จ่ายแล้ว" */
export function UpcomingBills({ bills, onPay, busyId }: Props) {
  return (
    <View style={styles.list}>
      {bills.map((b) => {
        const due = dueLabel(b);
        return (
          <View key={b.id} style={styles.row}>
            <Text style={styles.icon}>{b.category.icon}</Text>
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {b.name}
              </Text>
              <Text style={[styles.due, due.urgent && styles.urgent]}>
                {formatBaht(b.amount)} · {due.text}
              </Text>
            </View>
            <Pressable
              onPress={() => onPay(b)}
              disabled={busyId !== null}
              style={({ pressed }) => [styles.pay, (pressed || busyId === b.id) && styles.pressed]}>
              <Text style={styles.payText}>จ่ายแล้ว</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  icon: { fontSize: 22 },
  flex: { flex: 1 },
  name: { fontSize: FontSize.body, color: Colors.text, fontWeight: '600' },
  due: { fontSize: FontSize.caption, color: Colors.textSecondary },
  urgent: { color: Colors.danger, fontWeight: '600' },
  pay: { backgroundColor: Colors.butter, borderRadius: Radius.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  payText: { fontSize: FontSize.caption, fontWeight: '700', color: Colors.text },
  pressed: { opacity: 0.6 },
});
