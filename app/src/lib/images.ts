import * as ImagePicker from 'expo-image-picker';

export type ImageSource = 'library' | 'camera';

/** รูปที่เลือกแล้ว: uri ไว้แสดงตัวอย่าง, bytes ไว้อัปโหลด */
export type PickedImage = { uri: string; bytes: Uint8Array };

/**
 * เลือก/ถ่ายรูป (null = ผู้ใช้ยกเลิก)
 *
 * ขอ bytes จาก ImagePicker ตรงๆ (base64) แทนการเปิดไฟล์จาก uri ทีหลัง — ใน Expo Go
 * path ของไฟล์มีโฟลเดอร์ชื่อ "%40anonymous%2F..." ที่ทำให้โมดูลอื่นเปิดไฟล์ไม่ได้
 * (expo-file-system: Missing 'READ' permission / ImageManipulator: Loading bitmap failed)
 */
export async function pickImage(source: ImageSource): Promise<PickedImage | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('ไม่ได้รับอนุญาตให้ใช้กล้อง');
  }
  // quality 0.7: รูปกล้อง 12MP เหลือ ~1–2MB ตัวเลขในสลิปยังคมชัด (backend ย่อเหลือ 2000px อีกรอบ)
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, base64: true };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;

  const { uri, base64 } = result.assets[0];
  if (!base64) throw new Error('อ่านรูปไม่สำเร็จ');
  return { uri, bytes: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)) };
}
