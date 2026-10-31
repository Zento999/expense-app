import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { dayKey, timeLabel } from '@/lib/date';
import { listExpenses } from '@/lib/db';
import type { Expense } from '@/lib/types';

const BOM = String.fromCharCode(0xfeff);
const SOURCE_LABEL = { cash: 'เงินสด', slip: 'สลิป', receipt: 'ใบเสร็จ' } as const;

/** ใส่ "..." ถ้ามี , " หรือขึ้นบรรทัดใหม่ และ " ข้างในเป็น "" (ตามมาตรฐาน CSV) */
function cell(v: string | number | null): string {
  const s = v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(items: Expense[]): string {
  const header = ['วันที่', 'เวลา', 'ยอด', 'หมวด', 'ร้าน/ผู้รับ', 'โน้ต', 'ที่มา'];
  const rows = items.map((e) => {
    const d = new Date(e.spent_at);
    return [dayKey(d), timeLabel(d), e.amount.toFixed(2), e.category.name, e.payee, e.note, SOURCE_LABEL[e.source]];
  });
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

/** สร้างไฟล์ CSV ของทุกรายการ แล้วเปิดหน้าแชร์ — คืนจำนวนรายการ */
export async function exportCsv(): Promise<number> {
  const { items } = await listExpenses({ limit: Number.MAX_SAFE_INTEGER });
  const file = new File(Paths.cache, `expense-${dayKey(new Date())}.csv`);
  if (file.exists) file.delete();
  // BOM (﻿) ทำให้ Excel รู้ว่าเป็น UTF-8 — ไม่งั้นภาษาไทยจะเป็นตัวต่างดาว
  await file.write(BOM + buildCsv(items));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'ส่งไฟล์ CSV ไปที่...' });
  return items.length;
}
