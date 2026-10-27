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
};
