import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * เก็บรูปสลิป/บิลในโฟลเดอร์ของแอปเอง (Paths.document/receipts)
 * เขียนไฟล์ใหม่จาก bytes ที่ได้จาก ImagePicker — ไม่เปิดไฟล์ของโมดูลอื่นด้วย path
 * (บทเรียนจากบทที่ 6: ใน Expo Go ไฟล์นอกโฟลเดอร์แอปอ่านไม่ได้)
 * รูปอยู่ในเครื่อง → ถอนแอป = รูปหาย (ใช้หน้าสำรองข้อมูลเก็บไว้ที่อื่น)
 */

function receiptsDir(): Directory {
  const dir = new Directory(Paths.document, 'receipts');
  dir.create({ intermediates: true, idempotent: true }); // มีอยู่แล้วก็ไม่ error
  return dir;
}

/** เขียนรูปลงเครื่อง คืน uri ถาวรไว้เก็บใน expenses.image_uri */
export async function saveReceiptImage(bytes: Uint8Array): Promise<string> {
  return writeReceiptFile(`${randomUUID()}.jpg`, bytes);
}

/** เขียนรูปตามชื่อที่กำหนด (ใช้ตอนกู้คืน — คงชื่อไฟล์เดิมจากไฟล์สำรอง) */
export async function writeReceiptFile(name: string, bytes: Uint8Array): Promise<string> {
  const file = new File(receiptsDir(), name);
  if (file.exists) file.delete(); // กู้คืนไฟล์เดิมซ้ำ → เขียนทับ
  await file.write(bytes);
  return file.uri;
}

/** รูปทั้งหมดในเครื่อง (ไว้สำรอง/นับ/เก็บกวาด) */
export function listReceiptFiles(): File[] {
  return receiptsDir()
    .list()
    .filter((item): item is File => item instanceof File);
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
