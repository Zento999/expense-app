import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type ImageSource = 'library' | 'camera';

// ย่อบนมือถือก่อนส่ง: รูปกล้อง 12MP (~4MB) → ~300KB อัปโหลดผ่าน Tailscale เร็วขึ้นมาก
// 1600px ยังอ่านตัวเลขในสลิปได้ชัด (backend ย่ออีกรอบเหลือ 2000px อยู่แล้ว จึงไม่เสียอะไร)
const MAX_SIDE = 1600;

/** เลือก/ถ่ายรูป คืน uri ไว้แสดงตัวอย่าง (null = ผู้ใช้ยกเลิก) */
export async function pickImage(source: ImageSource): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('ไม่ได้รับอนุญาตให้ใช้กล้อง');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : result.assets[0].uri;
}

/**
 * ย่อรูปแล้วคืนเป็น bytes ของ JPEG สำหรับอัปโหลด
 * ขอเป็น base64 จาก ImageManipulator ตรงๆ แทนการอ่านไฟล์ เพราะใน Expo Go
 * expo-file-system ไม่มีสิทธิ์อ่านไฟล์ที่ ImageManipulator เซฟไว้ (Missing 'READ' permission)
 */
export async function toJpegBytes(uri: string): Promise<Uint8Array> {
  let image = await ImageManipulator.manipulate(uri).renderAsync();
  if (Math.max(image.width, image.height) > MAX_SIDE) {
    const ctx = ImageManipulator.manipulate(image);
    ctx.resize(image.width >= image.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    image = await ctx.renderAsync();
  }
  const { base64 } = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!base64) throw new Error('แปลงรูปไม่สำเร็จ');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
