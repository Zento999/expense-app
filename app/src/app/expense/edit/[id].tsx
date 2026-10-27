import { type ImageSource } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseForm, type FormValues } from '@/components/expense-form';
import { Colors, Spacing } from '@/constants/theme';
import { describeError, expenseImageSource, getExpense, updateExpense } from '@/lib/api';
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
        setExpense(e);
        if (e.has_image) expenseImageSource(e.id).then(setImage);
      },
      (e) => setError(describeError(e, 'โหลดรายการ')),
    );
  }, [expenseId]);

  async function save(values: FormValues) {
    setSaving(true);
    try {
      await updateExpense(expenseId, {
        amount: values.amount,
        category_id: values.categoryId,
        spent_at: values.spentAt.toISOString(),
        payee: values.payee,
        note: values.note,
      });
      ToastAndroid.show('บันทึกการแก้ไขแล้ว', ToastAndroid.SHORT);
      router.back();
    } catch (e) {
      ToastAndroid.show(describeError(e, 'บันทึก'), ToastAndroid.LONG);
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
