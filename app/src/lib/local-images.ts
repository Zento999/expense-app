import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * เก็บรูปสลิป/บิลในโฟลเดอร์ของแอปเอง (Paths.document/receipts)
 * เขียนไฟล์ใหม่จาก bytes ที่ได้จาก ImagePicker — ไม่เปิดไฟล์ของโมดูลอื่นด้วย path
 * (บทเรียนจากบทที่ 6: ใน Expo Go ไฟล์นอกโฟลเดอร์แอปอ่านไม่ได้)
 * รูปอยู่ในเครื่อง → ถอนแอป = รูปหาย (ต่อไปควรมีปุ่มสำรองข้อมูล)
 */

function receiptsDir(): Directory {
  const dir = new Directory(Paths.document, 'receipts');
  dir.create({ intermediates: true, idempotent: true }); // มีอยู่แล้วก็ไม่ error
  return dir;
}

/** เขียนรูปลงเครื่อง คืน uri ถาวรไว้เก็บใน expenses.image_uri */
export async function saveReceiptImage(bytes: Uint8Array): Promise<string> {
  const file = new File(receiptsDir(), `${randomUUID()}.jpg`);
  await file.write(bytes);
  return file.uri;
}

/** ลบไฟล์รูป (ไม่มีไฟล์ก็ไม่เป็นไร) — พังก็แค่ log ไว้ ไม่ให้การลบรายการล้มเพราะรูป */
export function deleteReceiptImage(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (e) {
    console.warn('[local-images] delete', e);
  }
}
