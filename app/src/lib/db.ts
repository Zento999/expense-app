import * as SQLite from 'expo-sqlite';

import type { Category, Source } from '@/lib/types';

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

export async function countExpenses(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM expenses');
  return row?.n ?? 0;
}
