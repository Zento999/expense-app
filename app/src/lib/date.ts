export const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** "ตุลาคม 2569" */
export function monthLabel(d: Date): string {
  return `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "วันนี้" / "เมื่อวาน" / "25 ต.ค." */
export function dayLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return 'วันนี้';
  if (sameDay(d, yesterday)) return 'เมื่อวาน';
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]}`;
}

/** วันที่จากปฏิทิน + เวลาตอนนี้ — บันทึกย้อนหลังจะได้เรียงตามลำดับที่กดในวันนั้น */
export function withCurrentTime(day: Date): Date {
  const now = new Date();
  const d = new Date(day);
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  return d;
}
