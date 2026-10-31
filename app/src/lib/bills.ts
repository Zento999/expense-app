import { addExpense, getCategories, getDb, toSatang } from '@/lib/db';
import { monthKey } from '@/lib/date';
import type { Category } from '@/lib/types';

/**
 * บิลประจำเดือน (ค่าเน็ต ค่าโทรศัพท์ ...) — จ่ายวันเดิมทุกเดือน
 * เก็บแค่ "จ่ายถึงเดือนไหนแล้ว" (paid_through) แล้วคำนวณงวดถัดไปเอง ไม่ต้องสร้างแถวล่วงหน้าทุกเดือน
 */

export type Bill = {
  id: number;
  name: string;
  amount: number;
  dayOfMonth: number; // 1–31 (เดือนที่สั้นกว่า = วันสุดท้ายของเดือน)
  category: Category;
  paidThrough: string | null; // 'YYYY-MM'
};

type BillRow = {
  id: number;
  name: string;
  amount_satang: number;
  day_of_month: number;
  category_id: number;
  paid_through: string | null;
};

async function toBills(rows: BillRow[]): Promise<Bill[]> {
  const categories = new Map((await getCategories()).map((c) => [c.id, c]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount_satang / 100,
    dayOfMonth: r.day_of_month,
    category: categories.get(r.category_id) as Category,
    paidThrough: r.paid_through,
  }));
}

const SELECT_BILL = 'SELECT id, name, amount_satang, day_of_month, category_id, paid_through FROM bills';

export async function listBills(): Promise<Bill[]> {
  const db = await getDb();
  return toBills(await db.getAllAsync<BillRow>(`${SELECT_BILL} ORDER BY day_of_month, id`));
}

export async function getBill(id: number): Promise<Bill | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<BillRow>(`${SELECT_BILL} WHERE id = ?`, id);
  return row ? (await toBills([row]))[0] : null;
}

/** วันครบกำหนดของบิลในเดือนนั้น (31 ในเดือน ก.พ. → 28/29) */
function dueDateIn(year: number, monthIndex: number, dayOfMonth: number): Date {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(dayOfMonth, last));
}

/**
 * บิลใหม่: ถือว่างวดที่เลยมาแล้วในเดือนนี้จ่ายไปแล้ว (เพิ่มบิลค่าเน็ตวันที่ 3 ตอนวันที่ 20 ไม่ควรขึ้นว่าค้างจ่าย)
 */
function initialPaidThrough(dayOfMonth: number, now: Date): string {
  const thisDue = dueDateIn(now.getFullYear(), now.getMonth(), dayOfMonth);
  return thisDue.getDate() < now.getDate()
    ? monthKey(now)
    : monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

export type BillInput = { name: string; amount: string; dayOfMonth: number; categoryId: number };

export async function saveBill(id: number | null, b: BillInput, now = new Date()): Promise<void> {
  const db = await getDb();
  if (id === null) {
    await db.runAsync(
      'INSERT INTO bills (name, amount_satang, day_of_month, category_id, paid_through) VALUES (?, ?, ?, ?, ?)',
      b.name,
      toSatang(b.amount),
      b.dayOfMonth,
      b.categoryId,
      initialPaidThrough(b.dayOfMonth, now),
    );
  } else {
    await db.runAsync(
      'UPDATE bills SET name = ?, amount_satang = ?, day_of_month = ?, category_id = ? WHERE id = ?',
      b.name,
      toSatang(b.amount),
      b.dayOfMonth,
      b.categoryId,
      id,
    );
  }
}

export async function deleteBill(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM bills WHERE id = ?', id);
}

export type DueBill = Bill & { dueDate: Date; dueMonth: string; daysLeft: number };

/** งวดถัดไปที่ยังไม่จ่าย (daysLeft ติดลบ = เลยกำหนดแล้ว) */
export function nextDue(bill: Bill, now: Date): DueBill {
  const [y, m] = (bill.paidThrough ?? monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))).split('-').map(Number);
  const dueDate = dueDateIn(y, m, bill.dayOfMonth); // m (1–12) = index ของเดือนถัดไปพอดี
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    ...bill,
    dueDate,
    dueMonth: monthKey(dueDate),
    daysLeft: Math.round((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
  };
}

const UPCOMING_DAYS = 7;

/** บิลที่ค้างจ่าย หรือจะถึงกำหนดใน 7 วัน — ไว้โชว์บนหน้าสรุป */
export async function getUpcomingBills(now: Date): Promise<DueBill[]> {
  return (await listBills())
    .map((b) => nextDue(b, now))
    .filter((b) => b.daysLeft <= UPCOMING_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** กด "จ่ายแล้ว": บันทึกเป็นรายจ่าย 1 รายการ แล้วเลื่อนงวดไปเดือนถัดไป */
export async function payBill(bill: DueBill, now = new Date()): Promise<void> {
  const db = await getDb();
  await addExpense({
    amount: bill.amount.toFixed(2),
    categoryId: bill.category.id,
    source: 'cash',
    spentAt: now,
    payee: bill.name,
    note: 'บิลประจำเดือน',
  });
  await db.runAsync('UPDATE bills SET paid_through = ? WHERE id = ?', bill.dueMonth, bill.id);
}
