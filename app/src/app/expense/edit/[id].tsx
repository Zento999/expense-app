import { type ImageSource } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseForm, type FormValues } from '@/components/expense-form';
import { Colors, Spacing } from '@/constants/theme';
import { getExpense, updateExpense } from '@/lib/db';
import { localError } from '@/lib/errors';
import type { Expense, Source } from '@/lib/types';

const PAYEE: Record<Source, { label: string; placeholder: string }> = {
  cash: { label: 'รายการ', placeholder: 'ข้าวมันไก่' },
  slip: { label: 'จ่ายให้', placeholder: 'ชื่อผู้รับ / ร้าน' },
  receipt: { label: 'ร้านค้า', placeholder: 'ชื่อร้าน' },
};

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [image, setImage] = useState<ImageSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getExpense(expenseId).then(
      (e) => {
        if (!e) {
          setError('ไม่พบรายการนี้ — อาจถูกลบไปแล้ว');
          return;
        }
        setExpense(e);
        setImage(e.image_uri ? { uri: e.image_uri } : null);
      },
      (e) => setError(localError('โหลดรายการ', e)),
    );
  }, [expenseId]);

  async function save(values: FormValues) {
    setSaving(true);
    try {
      // FormValues ตรงกับ ExpenseChanges อยู่แล้ว (amount เป็น "65.50", spentAt เป็น Date)
      await updateExpense(expenseId, values);
      ToastAndroid.show('บันทึกการแก้ไขแล้ว', ToastAndroid.SHORT);
      router.back();
    } catch (e) {
      ToastAndroid.show(localError('บันทึก', e), ToastAndroid.LONG);
      setSaving(false);
    }
  }

  if (!expense) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={Colors.primary} />}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <ExpenseForm
        initial={{
          amount: String(expense.amount),
          categoryId: expense.category.id,
          payee: expense.payee,
          note: expense.note,
          spentAt: new Date(expense.spent_at),
        }}
        image={image}
        payeeLabel={PAYEE[expense.source].label}
        payeePlaceholder={PAYEE[expense.source].placeholder}
        saving={saving}
        onSubmit={save}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: Spacing.four },
  error: { color: Colors.text, textAlign: 'center' },
});
