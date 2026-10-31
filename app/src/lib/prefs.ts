import * as SecureStore from 'expo-secure-store';

// ค่าเล็กๆ ที่แอปจำไว้ให้ (ใช้ SecureStore ที่มีอยู่แล้ว ไม่ต้องลงไลบรารีเก็บข้อมูลเพิ่ม)
const LAST_CATEGORY_KEY = 'last_category_id';

export async function getLastCategoryId(): Promise<number | null> {
  const v = await SecureStore.getItemAsync(LAST_CATEGORY_KEY);
  return v ? Number(v) : null;
}

export function setLastCategoryId(id: number) {
  return SecureStore.setItemAsync(LAST_CATEGORY_KEY, String(id));
}

const LAST_BACKUP_KEY = 'last_backup_at';

/** เวลาที่สร้างไฟล์สำรองล่าสุด (null = ยังไม่เคย) — ไว้เตือนให้สำรองเป็นระยะ */
export async function getLastBackupAt(): Promise<Date | null> {
  const v = await SecureStore.getItemAsync(LAST_BACKUP_KEY);
  return v ? new Date(v) : null;
}

export function setLastBackupAt(d: Date) {
  return SecureStore.setItemAsync(LAST_BACKUP_KEY, d.toISOString());
}
