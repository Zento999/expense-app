import * as SQLite from 'expo-sqlite';

import type { Category, Expense, ExpenseList, ExpenseQuery, Source, Summary } from '@/lib/types';

/**
 * ฐานข้อมูลในมือถือ (SQLite) — แอปทำงานได้เองโดยไม่ต้องมีเซิร์ฟเวอร์
 *
 * ยอดเงินเก็บเป็น "สตางค์" (จำนวนเต็ม) เพราะ SQLite ไม่มีชนิดทศนิยมแบบแม่นยำ
 * ถ้าเก็บเป็น REAL (float) จะเจอปัญหา 0.1 + 0.2 = 0.30000000000000004 แบบบทที่ 2
 */

// แต่ละช่องคือการเปลี่ยน schema 1 ครั้ง — เพิ่มต่อท้ายเท่านั้น ห้ามแก้ของเดิม (เหมือน Alembic)
const MIGRATIONS = [
  `
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount_satang INTEGER NOT NULL CHECK (amount_satang > 0),
    spent_at TEXT NOT NULL,                -- ISO เวลา UTC เช่น 2026-10-31T05:12:00.000Z (เรียงตามตัวอักษร = เรียงตามเวลา)
    source TEXT NOT NULL CHECK (source IN ('cash', 'slip', 'receipt')),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    payee TEXT,
    note TEXT,
    image_uri TEXT,                        -- รูปสลิป/บิลในเครื่อง (ขั้นถัดไป)
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX ix_expenses_spent_at ON expenses(spent_at);
  INSERT INTO categories (id, name, icon, color, sort_order) VALUES
    (1, 'อาหาร', '🍜', '#F7C04A', 1),
    (2, 'เครื่องดื่ม/คาเฟ่', '🧋', '#C8A27A', 2),
    (3, 'เดินทาง', '🚗', '#8EC5E8', 3),
    (4, 'ช้อปปิ้ง', '🛍️', '#F4A7B9', 4),
    (5, 'ของใช้ในบ้าน', '🏠', '#A8D5BA', 5),
    (6, 'บิล/ค่าน้ำไฟ', '💡', '#FFB38A', 6),
    (7, 'สุขภาพ', '💊', '#B9A7E8', 7),
    (8, 'บันเทิง', '🎮', '#FFDD83', 8),
    (9, 'การศึกษา', '📚', '#9FD8D3', 9),
    (10, 'อื่นๆ', '📦', '#C9C2B0', 99);
  `,
  // 2: ค่าตั้งค่า (งบ, เวลาเตือน) + บิลประจำเดือน — เก็บใน db จะได้ติดไปกับไฟล์สำรองด้วย
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount_satang INTEGER NOT NULL CHECK (amount_satang > 0),
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    paid_through TEXT                      -- 'YYYY-MM' เดือนล่าสุดที่จ่ายแล้ว
  );
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** เปิดฐานข้อมูลครั้งเดียวทั้งแอป (เรียกซ้ำได้ ได้ตัวเดิม) */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync('expense.db');
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    await migrate(db);
    return db;
  })();
  return dbPromise;
}

/** PRAGMA user_version = เลขเวอร์ชัน schema ที่ไฟล์นี้อยู่ — รันเฉพาะ migration ที่ยังไม่เคยรัน */
async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version++) {
    // ทำใน transaction: ถ้าพังกลางทาง จะไม่เหลือตารางครึ่งๆ กลางๆ
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

/** "65.5" → 6550 สตางค์ (แปลงจากข้อความตรงๆ ไม่ผ่าน float) */
export function toSatang(amount: string): number {
  const [baht, dec = ''] = amount.split('.');
  return Number(baht || '0') * 100 + Number(dec.padEnd(2, '0').slice(0, 2));
}

export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.getAllAsync<Category>('SELECT id, name, icon, color FROM categories ORDER BY sort_order, id');
}

export type NewExpense = {
  amount: string; // ตามที่พิมพ์ เช่น "65.50"
  categoryId: number;
  source: Source;
  spentAt: Date;
  payee?: string | null;
  note?: string | null;
  imageUri?: string | null; // จาก saveReceiptImage()
};

/** บันทึกรายจ่าย คืน id ของแถวใหม่ */
export async function addExpense(e: NewExpense): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO expenses (amount_satang, spent_at, source, category_id, payee, note, image_uri)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    // ใช้ ? แทนการต่อ string เสมอ — กัน SQL injection และปัญหาเครื่องหมาย ' ในชื่อร้าน
    toSatang(e.amount),
    e.spentAt.toISOString(),
    e.source,
    e.categoryId,
    e.payee ?? null,
    e.note ?? null,
    e.imageUri ?? null,
  );
  return result.lastInsertRowId;
}

type ExpenseRow = {
  id: number;
  amount_satang: number;
  spent_at: string;
  source: Source;
  payee: string | null;
  note: string | null;
  image_uri: string | null;
  created_at: string;
  c_id: number;
  c_name: string;
  c_icon: string;
  c_color: string;
};

/** แถวจาก SQL → รูปแบบ Expense เดิมที่หน้าจอใช้อยู่แล้ว (หน้าจอไม่ต้องแก้มาก) */
function toExpense(r: ExpenseRow): Expense {
  return {
    id: r.id,
    amount: r.amount_satang / 100,
    spent_at: r.spent_at,
    source: r.source,
    category: { id: r.c_id, name: r.c_name, icon: r.c_icon, color: r.c_color },
    payee: r.payee,
    note: r.note,
    created_at: r.created_at,
    has_image: r.image_uri !== null,
    image_uri: r.image_uri,
  };
}

const SELECT_EXPENSE = `
  SELECT e.id, e.amount_satang, e.spent_at, e.source, e.payee, e.note, e.image_uri, e.created_at,
         c.id AS c_id, c.name AS c_name, c.icon AS c_icon, c.color AS c_color
  FROM expenses e JOIN categories c ON c.id = e.category_id`;

export async function getExpense(id: number): Promise<Expense | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ExpenseRow>(`${SELECT_EXPENSE} WHERE e.id = ?`, id);
  return row ? toExpense(row) : null;
}

export type ExpenseChanges = {
  amount: string; // "65.50"
  categoryId: number;
  spentAt: Date;
  payee: string | null;
  note: string | null;
};

/** แก้ทุกช่องที่ฟอร์มแก้ได้ในครั้งเดียว (ที่มา/รูป ไม่เปลี่ยน) */
export async function updateExpense(id: number, c: ExpenseChanges): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE expenses SET amount_satang = ?, category_id = ?, spent_at = ?, payee = ?, note = ? WHERE id = ?`,
    toSatang(c.amount),
    c.categoryId,
    c.spentAt.toISOString(),
    c.payee,
    c.note,
    id,
  );
}

/** ลบรายการ คืน uri ของรูปที่เคยแนบ (ให้คนเรียกลบไฟล์ต่อ — db.ts ไม่ยุ่งกับไฟล์ จะได้ทดสอบแยกได้) */
export async function deleteExpense(id: number): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ image_uri: string | null }>('SELECT image_uri FROM expenses WHERE id = ?', id);
  await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
  return row?.image_uri ?? null;
}

/** ช่วงเดือนตามเวลาในมือถือ → ISO UTC สำหรับเทียบกับ spent_at ('2026-10' → 1 ต.ค. 00:00 ถึง 1 พ.ย. 00:00) */
function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  return [new Date(y, m - 1, 1).toISOString(), new Date(y, m, 1).toISOString()];
}

/** '2026-10-27' → 27 ต.ค. 00:00 ถึง 28 ต.ค. 00:00 (เวลาในมือถือ) เป็น ISO UTC */
function dayRange(day: string): [string, string] {
  const [y, m, d] = day.split('-').map(Number);
  return [new Date(y, m - 1, d).toISOString(), new Date(y, m - 1, d + 1).toISOString()];
}

/** รายการตามเดือน/วัน/คำค้น/หมวด พร้อมจำนวนและยอดรวมของทั้งหมดที่ตรงเงื่อนไข (ไม่ใช่แค่หน้านี้) */
export async function listExpenses({ month, day, q, categoryId, limit = 50, offset = 0 }: ExpenseQuery): Promise<ExpenseList> {
  const db = await getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (day) {
    where.push('e.spent_at >= ? AND e.spent_at < ?');
    params.push(...dayRange(day));
  } else if (month) {
    where.push('e.spent_at >= ? AND e.spent_at < ?');
    params.push(...monthRange(month));
  }
  if (q) {
    where.push('(e.payee LIKE ? OR e.note LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (categoryId != null) {
    where.push('e.category_id = ?');
    params.push(categoryId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await db.getAllAsync<ExpenseRow>(
    `${SELECT_EXPENSE} ${whereSql} ORDER BY e.spent_at DESC, e.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  // รวมเป็นสตางค์ (จำนวนเต็ม) ก่อน แล้วค่อยหาร 100 ครั้งเดียว — ยอดรวมไม่เพี้ยน
  const totals = await db.getFirstAsync<{ n: number; total: number }>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(e.amount_satang), 0) AS total FROM expenses e ${whereSql}`,
    params,
  );
  return { items: rows.map(toExpense), total_count: totals?.n ?? 0, total_amount: (totals?.total ?? 0) / 100 };
}

const HISTORY_MONTHS = 6;

/**
 * สรุปเดือน (ย้ายตรรกะจาก backend/summary.py มาไว้ในเครื่อง)
 * เดือนที่ยังไม่จบ เทียบกับ "ช่วงเดียวกัน" ของเดือนก่อน — วันที่ 27 เทียบกับวันที่ 1–27 ไม่ใช่ทั้งเดือน
 */
export async function getSummary(month: string): Promise<Summary> {
  const db = await getDb();
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  const now = new Date();
  const isCurrent = start <= now && now < end;
  const prevStart = new Date(y, m - 2, 1);
  const cutoff = isCurrent ? now : end;
  const prevCutoff = new Date(Math.min(prevStart.getTime() + (cutoff.getTime() - start.getTime()), start.getTime()));

  const totals = async (from: Date, to: Date) =>
    (await db.getFirstAsync<{ n: number; total: number }>(
      'SELECT COUNT(*) AS n, COALESCE(SUM(amount_satang), 0) AS total FROM expenses WHERE spent_at >= ? AND spent_at < ?',
      from.toISOString(),
      to.toISOString(),
    )) ?? { n: 0, total: 0 };
  const byCategory = async (from: Date, to: Date) =>
    db.getAllAsync<{ category_id: number; n: number; total: number }>(
      `SELECT category_id, COUNT(*) AS n, SUM(amount_satang) AS total FROM expenses
       WHERE spent_at >= ? AND spent_at < ? GROUP BY category_id`,
      from.toISOString(),
      to.toISOString(),
    );

  const current = await totals(start, end);
  const prevSame = await totals(prevStart, prevCutoff);
  const prevFull = await totals(prevStart, start);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const today = await totals(todayStart, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  const categories = new Map((await getCategories()).map((c) => [c.id, c]));
  const prevByCat = new Map((await byCategory(prevStart, prevCutoff)).map((r) => [r.category_id, r.total]));
  const by_category = (await byCategory(start, end))
    .map((r) => ({
      category: categories.get(r.category_id)!,
      total: r.total / 100,
      count: r.n,
      prev_total: (prevByCat.get(r.category_id) ?? 0) / 100,
    }))
    .sort((a, b) => b.total - a.total);

  const months = [];
  for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
    const from = new Date(y, m - 1 - i, 1);
    const key = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;
    months.push({ month: key, total: (await totals(from, new Date(y, m - i, 1))).total / 100 });
  }

  return {
    month,
    total: current.total / 100,
    count: current.n,
    is_current: isCurrent,
    days: isCurrent ? now.getDate() : new Date(y, m, 0).getDate(),
    compare_day: isCurrent ? now.getDate() : null,
    prev_same_period_total: prevSame.total / 100,
    prev_month_total: prevFull.total / 100,
    today_total: today.total / 100,
    by_category,
    months,
  };
}

/** ฐานข้อมูลทั้งไฟล์เป็น bytes (ข้อมูลครบแม้เพิ่งบันทึก — ไม่ต้องอ่านไฟล์ .db จาก path) */
export async function exportDatabase(): Promise<Uint8Array> {
  const db = await getDb();
  return db.serializeAsync();
}

type CategoryFull = Category & { sort_order: number };
type ExpenseFull = {
  id: number;
  amount_satang: number;
  spent_at: string;
  source: Source;
  category_id: number;
  payee: string | null;
  note: string | null;
  image_uri: string | null;
  created_at: string;
};
type BillFull = {
  id: number;
  name: string;
  amount_satang: number;
  day_of_month: number;
  category_id: number;
  paid_through: string | null;
};

/**
 * กู้คืน: แทนที่ข้อมูลทั้งหมดด้วยข้อมูลจากไฟล์สำรอง
 * mapImageUri: path รูปในเครื่องเดิม → path ใหม่ในเครื่องนี้ (มือถือคนละเครื่องเก็บไฟล์คนละที่)
 */
export async function replaceAllData(backupBytes: Uint8Array, mapImageUri: (oldUri: string) => string | null): Promise<number> {
  // เปิดไฟล์สำรองเป็นฐานข้อมูลชั่วคราวในหน่วยความจำ แล้วอัปเกรด schema ให้เท่าแอปตอนนี้ก่อนอ่าน
  const backup = await SQLite.deserializeDatabaseAsync(backupBytes);
  try {
    const row = await backup.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((row?.user_version ?? 0) > MIGRATIONS.length) {
      throw new Error('ไฟล์สำรองมาจากแอปเวอร์ชันใหม่กว่า — อัปเดตแอปก่อนกู้คืน');
    }
    await migrate(backup);
    const categories = await backup.getAllAsync<CategoryFull>('SELECT id, name, icon, color, sort_order FROM categories');
    const expenses = await backup.getAllAsync<ExpenseFull>(
      'SELECT id, amount_satang, spent_at, source, category_id, payee, note, image_uri, created_at FROM expenses',
    );
    const settings = await backup.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
    const bills = await backup.getAllAsync<BillFull>(
      'SELECT id, name, amount_satang, day_of_month, category_id, paid_through FROM bills',
    );

    const db = await getDb();
    // ทั้งหมดใน transaction เดียว: พังกลางทาง = ข้อมูลเดิมยังอยู่ครบ
    await db.withTransactionAsync(async () => {
      await db.execAsync('DELETE FROM bills; DELETE FROM expenses; DELETE FROM categories; DELETE FROM settings;');
      for (const c of categories) {
        await db.runAsync(
          'INSERT INTO categories (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)',
          c.id,
          c.name,
          c.icon,
          c.color,
          c.sort_order,
        );
      }
      for (const e of expenses) {
        await db.runAsync(
          `INSERT INTO expenses (id, amount_satang, spent_at, source, category_id, payee, note, image_uri, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          e.id,
          e.amount_satang,
          e.spent_at,
          e.source,
          e.category_id,
          e.payee,
          e.note,
          e.image_uri ? mapImageUri(e.image_uri) : null,
          e.created_at,
        );
      }
      for (const b of bills) {
        await db.runAsync(
          'INSERT INTO bills (id, name, amount_satang, day_of_month, category_id, paid_through) VALUES (?, ?, ?, ?, ?, ?)',
          b.id,
          b.name,
          b.amount_satang,
          b.day_of_month,
          b.category_id,
          b.paid_through,
        );
      }
      for (const s of settings) {
        await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', s.key, s.value);
      }
    });
    return expenses.length;
  } finally {
    await backup.closeAsync();
  }
}

export async function countExpenses(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM expenses');
  return row?.n ?? 0;
}

/** ค่าตั้งค่า 1 ค่า (null = ยังไม่เคยตั้ง) */
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

/** ตั้งค่า (null = ลบออก กลับเป็นค่าเริ่มต้น) */
export async function setSetting(key: string, value: string | null): Promise<void> {
  const db = await getDb();
  if (value === null) await db.runAsync('DELETE FROM settings WHERE key = ?', key);
  else await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

// ---------- จัดการหมวดหมู่ ----------

export type CategoryInput = { name: string; icon: string; color: string };

const OTHER_CATEGORY_ID = 10; // "อื่นๆ" — หมวดใหม่จะแทรกก่อนหมวดนี้ ให้ "อื่นๆ" อยู่ท้ายเสมอ

/** เขียน sort_order ใหม่เป็น 1..n ตามลำดับที่ส่งมา */
async function writeOrder(db: SQLite.SQLiteDatabase, ids: number[]) {
  for (const [i, id] of ids.entries()) await db.runAsync('UPDATE categories SET sort_order = ? WHERE id = ?', i + 1, id);
}

/** แปลง error ชื่อซ้ำของ SQLite เป็นภาษาคน */
function friendlyCategoryError(e: unknown, name: string): never {
  if (e instanceof Error && /UNIQUE/i.test(e.message)) throw new Error(`มีหมวดชื่อ "${name}" อยู่แล้ว`);
  throw e;
}

export async function addCategory(c: CategoryInput): Promise<number> {
  const db = await getDb();
  let id = 0;
  try {
    await db.withTransactionAsync(async () => {
      const ids = (await getCategories()).map((x) => x.id);
      const r = await db.runAsync('INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, 0)', c.name, c.icon, c.color);
      id = r.lastInsertRowId;
      const at = ids[ids.length - 1] === OTHER_CATEGORY_ID ? ids.length - 1 : ids.length;
      ids.splice(at, 0, id);
      await writeOrder(db, ids);
    });
  } catch (e) {
    friendlyCategoryError(e, c.name);
  }
  return id;
}

export async function updateCategory(id: number, c: CategoryInput): Promise<void> {
  const db = await getDb();
  try {
    await db.runAsync('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?', c.name, c.icon, c.color, id);
  } catch (e) {
    friendlyCategoryError(e, c.name);
  }
}

/** เลื่อนขึ้น (-1) / ลง (+1) หนึ่งตำแหน่ง */
export async function moveCategory(id: number, direction: -1 | 1): Promise<void> {
  const db = await getDb();
  const ids = (await getCategories()).map((c) => c.id);
  const i = ids.indexOf(id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await db.withTransactionAsync(() => writeOrder(db, ids));
}

/** มีรายจ่าย/บิลใช้หมวดนี้อยู่กี่อัน — ลบได้ทันทีถ้าเป็น 0 */
export async function categoryUsage(id: number): Promise<{ expenses: number; bills: number }> {
  const db = await getDb();
  const e = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM expenses WHERE category_id = ?', id);
  const b = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM bills WHERE category_id = ?', id);
  return { expenses: e?.n ?? 0, bills: b?.n ?? 0 };
}

/** ลบหมวด — ถ้ามีรายการใช้อยู่ ต้องบอกว่าจะย้ายไปหมวดไหน (ย้ายแล้วลบใน transaction เดียว) */
export async function deleteCategory(id: number, moveToId: number | null): Promise<void> {
  const db = await getDb();
  const usage = await categoryUsage(id);
  if (usage.expenses + usage.bills > 0 && (moveToId === null || moveToId === id)) {
    throw new Error('ต้องเลือกหมวดที่จะย้ายรายการไปก่อน');
  }
  if ((await getCategories()).length <= 1) throw new Error('ต้องมีอย่างน้อย 1 หมวด');
  await db.withTransactionAsync(async () => {
    if (moveToId !== null) {
      await db.runAsync('UPDATE expenses SET category_id = ? WHERE category_id = ?', moveToId, id);
      await db.runAsync('UPDATE bills SET category_id = ? WHERE category_id = ?', moveToId, id);
    }
    await db.runAsync('DELETE FROM categories WHERE id = ?', id);
  });
}
