/**
 * ตรรกะช่องจำนวนเงิน — เก็บเป็น string ตามที่กด (เช่น "65.5") ไม่แปลงเป็น number ระหว่างพิมพ์
 * เพราะ number ทิ้งเลขท้ายอย่าง "65.50" หรือ "65." ไป ผู้ใช้จะเห็นตัวเลขกระโดด
 */

export type NumpadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back';

const MAX_INT_DIGITS = 7; // ไม่เกิน 9,999,999 บาท
const MAX_DECIMALS = 2; // ตรงกับ Numeric(12,2) ใน DB

export function pressKey(current: string, key: NumpadKey): string {
  if (key === 'back') return current.slice(0, -1);

  const [int, dec] = current.split('.');
  if (key === '.') {
    if (dec !== undefined) return current; // มีจุดแล้ว
    return (current || '0') + '.';
  }
  if (dec !== undefined) {
    return dec.length >= MAX_DECIMALS ? current : current + key;
  }
  if (current === '0') return key; // ไม่เอา 0 นำหน้า เช่น "05"
  return int.length >= MAX_INT_DIGITS ? current : current + key;
}

export function isValidAmount(value: string): boolean {
  return Number(value) > 0;
}

/** "1234.5" → "1,234.5" (ใส่คอมมาเฉพาะส่วนจำนวนเต็ม ทศนิยมคงตามที่พิมพ์) */
export function formatTyped(value: string): string {
  if (!value) return '0';
  const [int, dec] = value.split('.');
  const withCommas = Number(int || '0').toLocaleString('en-US');
  return dec === undefined ? withCommas : `${withCommas}.${dec}`;
}

/** สำหรับส่ง API: "65.5" → "65.50", "65." → "65.00" */
export function toApiAmount(value: string): string {
  return Number(value).toFixed(2);
}
