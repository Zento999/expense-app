import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type ImageSource = 'library' | 'camera';

// ย่อบนมือถือก่อนส่ง: รูปกล้อง 12MP (~4MB) → ~300KB อัปโหลดผ่าน Tailscale เร็วขึ้นมาก
// 1600px ยังอ่านตัวเลขในสลิปได้ชัด (backend ย่ออีกรอบเหลือ 2000px อยู่แล้ว จึงไม่เสียอะไร)
const MAX_SIDE = 1600;

/** เลือก/ถ่ายรูป แล้วย่อ คืน uri ของไฟล์ jpg ในเครื่อง (null = ผู้ใช้ยกเลิก) */
export async function pickImage(source: ImageSource): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('ไม่ได้รับอนุญาตให้ใช้กล้อง');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;

  const { uri, width, height } = result.assets[0];
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_SIDE) {
    ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return saved.uri;
}
