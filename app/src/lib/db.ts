import * as SQLite from 'expo-sqlite';

import type { Category, Expense, ExpenseList, ExpenseQuery, Source } from '@/lib/types';

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
};

/** บันทึกรายจ่าย คืน id ของแถวใหม่ */
export async function addExpense(e: NewExpense): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO expenses (amount_satang, spent_at, source, category_id, payee, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    // ใช้ ? แทนการต่อ string เสมอ — กัน SQL injection และปัญหาเครื่องหมาย ' ในชื่อร้าน
    toSatang(e.amount),
    e.spentAt.toISOString(),
    e.source,
    e.categoryId,
    e.payee ?? null,
    e.note ?? null,
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

/** ลบรายการ (ขั้นถัดไปที่มีรูปในเครื่อง จะลบไฟล์รูปตามไปด้วย) */
export async function deleteExpense(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
}

/** ช่วงเดือนตามเวลาในมือถือ → ISO UTC สำหรับเทียบกับ spent_at ('2026-10' → 1 ต.ค. 00:00 ถึง 1 พ.ย. 00:00) */
function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  return [new Date(y, m - 1, 1).toISOString(), new Date(y, m, 1).toISOString()];
}

/** รายการตามเดือน/คำค้น/หมวด พร้อมจำนวนและยอดรวมของทั้งหมดที่ตรงเงื่อนไข (ไม่ใช่แค่หน้านี้) */
export async function listExpenses({ month, q, categoryId, limit = 50, offset = 0 }: ExpenseQuery): Promise<ExpenseList> {
  const db = await getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (month) {
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

export async function countExpenses(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM expenses');
  return row?.n ?? 0;
}
