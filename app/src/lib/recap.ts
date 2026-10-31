import { getDb, getSummary } from '@/lib/db';
import { dayKey } from '@/lib/date';
import { getBudget, getDailyTotals } from '@/lib/stats';
import type { Category } from '@/lib/types';

/**
 * สรุปสิ้นเดือน — ใช้ตัวเลขชุดเดียวกับหน้าสรุป (getSummary) จะได้ไม่ขัดกัน
 * แล้วเพิ่มเรื่องที่น่าเล่า: วันที่ใช้หนักสุด, บันทึกต่อเนื่องยาวสุด, เหรียญ
 */

export type Medal = 'gold' | 'silver' | 'bronze' | 'ribbon';

export type MonthRecap = {
  month: string;
  total: number;
  count: number;
  budget: number | null;
  budgetPercent: number | null;
  medal: Medal;
  medalReason: string;
  topCategory: { category: Category; total: number } | null;
  heaviestDay: { date: Date; total: number } | null;
  longestStreak: number; // วันติดกันที่มีบันทึก ภายในเดือนนี้
  loggedDays: number;
  daysInMonth: number;
  prevTotal: number;
  changePercent: number | null; // เทียบเดือนก่อนทั้งเดือน (null = เดือนก่อนไม่มีข้อมูล)
};

/**
 * เกณฑ์เหรียญ — มีงบ: ดูว่าอยู่ในงบไหม / ไม่มีงบ: ดูความสม่ำเสมอในการบันทึก
 * (ใช้งบ "ปัจจุบัน" เทียบย้อนหลัง เพราะแอปเก็บงบไว้ค่าเดียว)
 */
export function pickMedal(budgetPercent: number | null, loggedDays: number, daysInMonth: number): { medal: Medal; reason: string } {
  if (budgetPercent !== null) {
    if (budgetPercent <= 90) return { medal: 'gold', reason: 'อยู่ในงบสบายๆ' };
    if (budgetPercent <= 100) return { medal: 'silver', reason: 'อยู่ในงบพอดี' };
    return { medal: 'ribbon', reason: 'เกินงบไปหน่อย เดือนนี้สู้ใหม่' };
  }
  const ratio = loggedDays / daysInMonth;
  if (ratio >= 0.8) return { medal: 'gold', reason: `บันทึก ${loggedDays} จาก ${daysInMonth} วัน` };
  if (ratio >= 0.5) return { medal: 'silver', reason: `บันทึก ${loggedDays} จาก ${daysInMonth} วัน` };
  return { medal: 'bronze', reason: `บันทึก ${loggedDays} วัน — เดือนนี้ลองให้ถี่ขึ้นนะ` };
}

export async function getMonthRecap(month: string): Promise<MonthRecap> {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const [summary, daily, budget] = await Promise.all([getSummary(month), getDailyTotals(month), getBudget()]);

  let heaviestDay: MonthRecap['heaviestDay'] = null;
  for (const [day, total] of daily) {
    if (!heaviestDay || total > heaviestDay.total) heaviestDay = { date: new Date(y, m - 1, day), total };
  }

  let longestStreak = 0;
  let run = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    run = daily.has(d) ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  }

  const budgetPercent = budget ? Math.round((summary.total / budget) * 100) : null;
  const { medal, reason } = pickMedal(budgetPercent, daily.size, daysInMonth);
  const top = summary.by_category[0];
  const prevTotal = summary.prev_month_total;

  return {
    month,
    total: summary.total,
    count: summary.count,
    budget,
    budgetPercent,
    medal,
    medalReason: reason,
    topCategory: top ? { category: top.category, total: top.total } : null,
    heaviestDay,
    longestStreak,
    loggedDays: daily.size,
    daysInMonth,
    prevTotal,
    changePercent: prevTotal > 0 ? Math.round(((summary.total - prevTotal) / prevTotal) * 100) : null,
  };
}

const RECAP_DAYS = 7;

/** 7 วันแรกของเดือน + เดือนก่อนมีรายการ → คืน 'YYYY-MM' ของเดือนก่อน ให้หน้าสรุปโชว์การ์ดชวนดู */
export async function pendingRecapMonth(now: Date): Promise<string | null> {
  if (now.getDate() > RECAP_DAYS) return null;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM expenses WHERE spent_at >= ? AND spent_at < ?',
    prev.toISOString(),
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
  );
  return row && row.n > 0 ? dayKey(prev).slice(0, 7) : null;
}
