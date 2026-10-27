export const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const THAI_WEEKDAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

/** "ตุลาคม 2569" */
export function monthLabel(d: Date): string {
  return `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** "2026-10" — รูปแบบที่ API ใช้กรองเดือน */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** วันที่ 1 ของเดือน (เลื่อนไปข้างหน้า/ย้อนหลัง n เดือน) */
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function relativeDay(d: Date): string | null {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return 'วันนี้';
  if (sameDay(d, yesterday)) return 'เมื่อวาน';
  return null;
}

/** "วันนี้" / "เมื่อวาน" / "25 ต.ค." */
export function dayLabel(d: Date): string {
  return relativeDay(d) ?? `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]}`;
}

/** หัวกลุ่มในหน้าประวัติ: "วันนี้ · อ. 27 ต.ค." / "ศ. 24 ต.ค." */
export function dayHeader(d: Date): string {
  const base = `${THAI_WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]}`;
  const rel = relativeDay(d);
  return rel ? `${rel} · ${base}` : base;
}

/** "2026-10-27" ไว้จัดกลุ่มรายการตามวัน (เวลาเครื่อง) */
export function dayKey(d: Date): string {
  return `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "14:32" */
export function timeLabel(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "27 ต.ค. 69 · 14:32" — ปี พ.ศ. 2 หลักแบบในสลิป */
export function dateTimeLabel(d: Date): string {
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)} · ${timeLabel(d)}`;
}

/** วันที่จากปฏิทิน + เวลาตอนนี้ — บันทึกย้อนหลังจะได้เรียงตามลำดับที่กดในวันนั้น */
export function withCurrentTime(day: Date): Date {
  const now = new Date();
  const d = new Date(day);
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  return d;
}
