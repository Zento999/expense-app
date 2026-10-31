/** ข้อความ error สำหรับงานในเครื่อง (ฐานข้อมูล/ไฟล์) — log เต็มไว้ดูใน Metro, โชว์ผู้ใช้แบบสั้น */
export function localError(action: string, e: unknown): string {
  console.warn(`[${action}]`, e);
  return `${action}ไม่สำเร็จ — ${e instanceof Error ? e.message : String(e)}`;
}
