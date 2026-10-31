import * as LocalAuthentication from 'expo-local-authentication';
import { SecurityLevel } from 'expo-local-authentication';

import { getSetting, setSetting } from '@/lib/db';

/**
 * ล็อกแอปด้วยลายนิ้วมือ/สแกนหน้า — ถ้าไม่ผ่าน ใช้ PIN/รหัสของมือถือแทนได้ (ไม่ทำให้ตัวเองเข้าแอปไม่ได้)
 * แอปไม่ได้เห็นหรือเก็บลายนิ้วมือ — Android ตรวจเองแล้วบอกแค่ "ผ่าน/ไม่ผ่าน"
 */

const KEY = 'app_lock';
export const LOCK_AFTER_MS = 60_000; // ออกจากแอปเกิน 1 นาทีถึงล็อก — สลับไปแชร์ไฟล์แป๊บเดียวไม่ต้องสแกนใหม่

export async function isLockEnabled(): Promise<boolean> {
  return (await getSetting(KEY)) === '1';
}

export function setLockEnabled(on: boolean) {
  return setSetting(KEY, on ? '1' : null);
}

/** มือถือตั้งล็อกหน้าจอไว้ไหม (ลายนิ้วมือ หรืออย่างน้อย PIN) — ไม่มีก็เปิดล็อกแอปไม่ได้ */
export async function canLock(): Promise<boolean> {
  return (await LocalAuthentication.getEnrolledLevelAsync()) !== SecurityLevel.NONE;
}

export async function authenticate(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'ปลดล็อก Expense',
    cancelLabel: 'ยกเลิก',
    disableDeviceFallback: false, // ให้ใช้ PIN แทนได้
  });
  return result.success;
}
