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
