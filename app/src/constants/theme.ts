/**
 * สีและขนาดทั้งแอปอยู่ที่ไฟล์นี้ที่เดียว — อยากเปลี่ยนโทนก็แก้ตรงนี้
 * พาเลตเหลืองทอง: #E7B10A #FFDD83 #F0EB8D #F7C04A #FDD36A #FFEA20
 */

export const Colors = {
  // เหลือง
  primary: '#E7B10A', // ปุ่ม ＋, ปุ่มหลัก
  primarySoft: '#F7C04A', // การ์ดยอดรวม
  honey: '#FDD36A',
  butter: '#FFDD83',
  lemon: '#F0EB8D', // เส้นขอบ, พื้น input
  pop: '#FFEA20', // จุดเล็กๆ เท่านั้น (สดมาก)

  // พื้นหลัง
  background: '#FFFBEF', // ครีมอ่อน
  surface: '#FFFFFF', // การ์ด, แถบแท็บ

  // ตัวอักษร: น้ำตาลเข้มแทนดำ — อ่านชัดบนพื้นเหลือง และนุ่มกว่า
  text: '#4A3A00',
  textSecondary: '#B39A4A',

  // กราฟ: ทองเข้มผ่านตัวตรวจสีกราฟ (contrast ≥ 3:1 บนพื้นขาว) — พาสเทลของหมวดอ่อนเกินใช้เป็นแท่ง
  chart: '#B07F00',
  chartMuted: '#E8CF7F', // แท่งเดือนอื่นที่ไม่ได้เลือก (มีป้ายเดือนกำกับเสมอ)
  chartOther: '#B4B2A9', // "อื่นๆ" ที่รวมหลายหมวด
  chartTrack: '#FFF3CC',

  overlay: 'rgba(74, 58, 0, 0.35)', // ฉากหลังตอนเปิด bottom sheet
  danger: '#D9534F',
  success: '#5BA36B',
} as const;

export const Radius = {
  sm: 10,
  md: 16,
  lg: 22,
  full: 999,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const FontSize = {
  caption: 12,
  body: 15,
  title: 18,
  big: 32,
} as const;
