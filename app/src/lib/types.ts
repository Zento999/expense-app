// รูปร่างข้อมูลที่หน้าจอใช้ (db.ts แปลงแถวจาก SQLite มาเป็นรูปแบบนี้)

export type Category = {
  id: number;
  name: string;
  icon: string;
  color: string;
};

export type Source = 'cash' | 'slip' | 'receipt';

export type Expense = {
  id: number;
  amount: number;
  spent_at: string;
  source: Source;
  category: Category;
  payee: string | null;
  note: string | null;
  created_at: string;
  has_image: boolean;
  image_uri?: string | null; // รูปในเครื่อง (แอปแบบ offline)
};

export type ExpenseList = {
  items: Expense[];
  total_count: number; // จำนวนทั้งหมดที่ตรงเงื่อนไข (ไม่ใช่แค่หน้านี้)
  total_amount: number;
};

export type ExpenseQuery = {
  month?: string; // "2026-10"
  day?: string; // "2026-10-27" (ถ้ามี ใช้แทน month)
  q?: string;
  categoryId?: number;
  limit?: number;
  offset?: number;
};

export type CategoryTotal = {
  category: Category;
  total: number;
  count: number;
  prev_total: number; // ช่วงเดียวกันของเดือนก่อน
};

export type MonthTotal = { month: string; total: number };

export type Summary = {
  month: string;
  total: number;
  count: number;
  is_current: boolean; // เดือนที่ยังไม่จบ
  days: number; // วันที่ผ่านไปแล้ว (เดือนที่จบแล้ว = ทั้งเดือน)
  compare_day: number | null; // เทียบกับวันที่ 1..N ของเดือนก่อน (null = เทียบทั้งเดือน)
  prev_same_period_total: number;
  prev_month_total: number;
  today_total: number; // ยอดวันนี้ (ไม่ขึ้นกับเดือนที่ดู)
  by_category: CategoryTotal[];
  months: MonthTotal[];
};

export type ScanKind = 'slip' | 'receipt';
