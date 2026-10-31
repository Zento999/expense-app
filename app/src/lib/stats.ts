import { getCategories, getDb, getSetting } from '@/lib/db';
import { dayKey } from '@/lib/date';
import type { Category } from '@/lib/types';

/**
 * ตัวเลขเสริมของหน้าสรุป (งบ, วันต่อเนื่อง, ปฏิทิน, ข้อสังเกต, ปุ่มลัด)
 * แยกจาก db.ts ให้ไฟล์หลักไม่ยาวเกิน — ทุกฟังก์ชันอ่านอย่างเดียว ไม่แก้ข้อมูล
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// ---------- งบประมาณ ----------

const BUDGET_KEY = 'budget_satang';

/** งบต่อเดือน (บาท) — null = ยังไม่ตั้ง */
export async function getBudget(): Promise<number | null> {
  const v = await getSetting(BUDGET_KEY);
  return v ? Number(v) / 100 : null;
}

export type BudgetStatus = {
  budget: number;
  spent: number;
  percent: number; // 0–100+ (เกินงบได้)
  perDayLeft: number; // ใช้ได้อีกวันละเท่าไรถึงสิ้นเดือน (รวมวันนี้) — 0 ถ้าเกินงบแล้ว
  over: number; // เกินงบไปเท่าไร (0 = ยังไม่เกิน)
  mood: 'happy' | 'meh' | 'worried';
};

/**
 * เทียบ "ใช้ไปจริง" กับ "ควรใช้ไปถึงวันนี้" (งบ × วันที่ผ่าน ÷ วันทั้งเดือน)
 * วันที่ 10 ใช้ไป 40% ถือว่าเร็วไป แม้ยังไม่เกินงบ — น้องใบเสร็จจะเริ่มกังวล
 */
export function budgetStatus(budget: number, spent: number, now: Date): BudgetStatus {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  const left = budget - spent;
  const pace = spent / ((budget * now.getDate()) / daysInMonth);
  return {
    budget,
    spent,
    percent: Math.round((spent / budget) * 100),
    perDayLeft: left > 0 ? Math.floor(left / daysLeft) : 0,
    over: left < 0 ? -left : 0,
    mood: left < 0 || pace > 1.15 ? 'worried' : pace > 1 ? 'meh' : 'happy',
  };
}

// ---------- ยอดรายวัน (ปฏิทิน) และวันต่อเนื่อง ----------

/** วันที่ในเดือน → ยอดรวมวันนั้น (บาท) จัดกลุ่มตามเวลาในมือถือ ไม่ใช่ UTC */
export async function getDailyTotals(month: string): Promise<Map<number, number>> {
  const db = await getDb();
  const [y, m] = month.split('-').map(Number);
  const rows = await db.getAllAsync<{ spent_at: string; amount_satang: number }>(
    'SELECT spent_at, amount_satang FROM expenses WHERE spent_at >= ? AND spent_at < ?',
    new Date(y, m - 1, 1).toISOString(),
    new Date(y, m, 1).toISOString(),
  );
  const satang = new Map<number, number>();
  for (const r of rows) {
    const d = new Date(r.spent_at).getDate();
    satang.set(d, (satang.get(d) ?? 0) + r.amount_satang);
  }
  return new Map([...satang].map(([d, s]) => [d, s / 100]));
}

const STREAK_LOOKBACK_DAYS = 400;

/**
 * บันทึกติดกันกี่วัน — ถ้าวันนี้ยังไม่ได้บันทึก นับจากเมื่อวาน (ยังไม่ขาด แค่ยังไม่ถึงเวลา)
 * ใช้วันที่ "มีรายการ" ไม่ใช่วันที่กดบันทึก: บันทึกย้อนหลังของเมื่อวานก็ช่วยต่อ streak ได้
 */
export async function getStreak(now: Date): Promise<{ days: number; loggedToday: boolean }> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ spent_at: string }>(
    'SELECT spent_at FROM expenses WHERE spent_at >= ?',
    addDays(now, -STREAK_LOOKBACK_DAYS).toISOString(),
  );
  const days = new Set(rows.map((r) => dayKey(new Date(r.spent_at))));
  const loggedToday = days.has(dayKey(now));
  let count = 0;
  for (let d = loggedToday ? now : addDays(now, -1); days.has(dayKey(d)); d = addDays(d, -1)) count++;
  return { days: count, loggedToday };
}

// ---------- ข้อสังเกตประจำสัปดาห์ ----------

export type Insight = { emoji: string; text: string; tone: 'good' | 'warn' | 'info' };

const MIN_DIFF_BAHT = 100; // ต่างกันน้อยกว่านี้ไม่นับว่า "มากกว่าปกติ" (กัน 20 → 40 บาท = +100%)

/**
 * เทียบ 7 วันล่าสุดกับค่าเฉลี่ยต่อสัปดาห์ของ 4 สัปดาห์ก่อนหน้า
 * เลือกเรื่องที่น่าสนใจที่สุดเรื่องเดียว — หมวดที่พุ่งขึ้น > ใช้น้อยลงโดยรวม > หมวดที่ใช้มากสุด
 */
export async function getInsight(now: Date): Promise<Insight | null> {
  const db = await getDb();
  const weekStart = addDays(startOfDay(now), -6);
  const end = addDays(startOfDay(now), 1);
  const baseStart = addDays(weekStart, -28);
  const byCategory = (from: Date, to: Date) =>
    db.getAllAsync<{ category_id: number; total: number }>(
      `SELECT category_id, SUM(amount_satang) AS total FROM expenses
       WHERE spent_at >= ? AND spent_at < ? GROUP BY category_id`,
      from.toISOString(),
      to.toISOString(),
    );
  const week = await byCategory(weekStart, end);
  if (week.length === 0) return null;
  const base = new Map((await byCategory(baseStart, weekStart)).map((r) => [r.category_id, r.total / 4 / 100]));
  const categories = new Map((await getCategories()).map((c) => [c.id, c]));
  const label = (id: number) => {
    const c = categories.get(id) as Category;
    return `${c.icon} ${c.name}`;
  };

  if (base.size > 0) {
    const jumps = week
      .map((r) => ({ id: r.category_id, now: r.total / 100, avg: base.get(r.category_id) ?? 0 }))
      .filter((r) => r.avg > 0 && r.now - r.avg >= MIN_DIFF_BAHT)
      .map((r) => ({ ...r, pct: Math.round(((r.now - r.avg) / r.avg) * 100) }))
      .sort((a, b) => b.pct - a.pct);
    if (jumps[0]) {
      return { emoji: '💡', text: `สัปดาห์นี้ ${label(jumps[0].id)} มากกว่าปกติ ${jumps[0].pct}%`, tone: 'warn' };
    }
    const weekTotal = week.reduce((s, r) => s + r.total, 0) / 100;
    const avgTotal = [...base.values()].reduce((s, v) => s + v, 0);
    if (avgTotal - weekTotal >= MIN_DIFF_BAHT) {
      const pct = Math.round(((avgTotal - weekTotal) / avgTotal) * 100);
      return { emoji: '👏', text: `7 วันนี้ใช้น้อยกว่าปกติ ${pct}% เก่งมาก`, tone: 'good' };
    }
  }
  const top = [...week].sort((a, b) => b.total - a.total)[0];
  const share = Math.round((top.total / week.reduce((s, r) => s + r.total, 0)) * 100);
  return { emoji: '🔎', text: `7 วันนี้ใช้กับ ${label(top.category_id)} มากที่สุด (${share}%)`, tone: 'info' };
}

// ---------- ปุ่มลัด "จ่ายบ่อย" ----------

export type QuickPick = { payee: string; amount: number; category: Category };

const QUICK_LOOKBACK_DAYS = 90;
const QUICK_MIN_TIMES = 2;
const QUICK_LIMIT = 6;

/** รายการเงินสดที่ชื่อ + ยอด + หมวดซ้ำกัน ≥ 2 ครั้งใน 90 วัน เรียงจากบ่อยสุด */
export async function getQuickPicks(now: Date): Promise<QuickPick[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ payee: string; amount_satang: number; category_id: number }>(
    `SELECT payee, amount_satang, category_id, COUNT(*) AS n, MAX(spent_at) AS last FROM expenses
     WHERE source = 'cash' AND payee IS NOT NULL AND payee <> '' AND spent_at >= ?
     GROUP BY payee, amount_satang, category_id HAVING n >= ?
     ORDER BY n DESC, last DESC LIMIT ?`,
    new Date(now.getTime() - QUICK_LOOKBACK_DAYS * DAY_MS).toISOString(),
    QUICK_MIN_TIMES,
    QUICK_LIMIT,
  );
  const categories = new Map((await getCategories()).map((c) => [c.id, c]));
  return rows.flatMap((r) => {
    const category = categories.get(r.category_id);
    return category ? [{ payee: r.payee, amount: r.amount_satang / 100, category }] : [];
  });
}
