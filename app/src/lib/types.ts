// รูปร่างข้อมูลให้ตรงกับ schemas.py ฝั่ง backend

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
};

export type ExpenseCreate = {
  // ส่งเป็น string เช่น "65.50" — Decimal ฝั่ง Python แปลงจาก string ได้เป๊ะ ไม่ผ่าน float
  amount: string;
  category_id: number;
  source?: Source;
  spent_at?: string;
  payee?: string | null;
  note?: string | null;
  upload_id?: string; // จาก POST /api/uploads — แนบรูปไปกับรายการ
  client_id?: string; // UUID จากมือถือ: ส่งซ้ำได้โดยไม่เกิดรายการซ้ำ (ใช้กับคิวออฟไลน์)
};

/** PATCH: ส่งเฉพาะช่องที่จะแก้ */
export type ExpenseUpdate = Partial<Pick<ExpenseCreate, 'amount' | 'category_id' | 'spent_at' | 'payee' | 'note'>>;

export type ExpenseList = {
  items: Expense[];
  total_count: number; // จำนวนทั้งหมดที่ตรงเงื่อนไข (ไม่ใช่แค่หน้านี้)
  total_amount: number;
};

export type ExpenseQuery = {
  month?: string; // "2026-10"
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
  by_category: CategoryTotal[];
  months: MonthTotal[];
};

export type ScanKind = 'slip' | 'receipt';

/** ผลที่ AI อ่านจากรูป (ทุกช่องเป็น null ได้) */
export type ReadResult = {
  doc_type: 'transfer_slip' | 'receipt' | 'other';
  amount: number | null;
  spent_at: string | null;
  payee: string | null;
  category_id: number | null;
  // history = หมวดเดียวกับที่เคยบันทึกให้ร้านนี้ / ai = AI เดาเอง
  category_source: 'history' | 'ai' | null;
  note: string | null;
  confidence: 'high' | 'medium' | 'low';
};
