import Storage from 'expo-sqlite/kv-store';

import { ApiError, createExpense, isNetworkError } from '@/lib/api';
import type { ExpenseCreate } from '@/lib/types';

/**
 * คิวรายจ่ายที่บันทึกตอนออฟไลน์ (คอมปิด / Tailscale หลุด)
 * เก็บใน SQLite บนมือถือ — ปิดแอปแล้วเปิดใหม่ก็ยังอยู่ แล้วค่อยส่งเมื่อเชื่อมต่อได้
 *
 * ทุกรายการมี client_id: ถ้าส่งไปแล้วเซิร์ฟเวอร์บันทึกสำเร็จแต่คำตอบหายระหว่างทาง
 * การส่งซ้ำจะได้แถวเดิมกลับมา ไม่เกิดรายการซ้ำ
 */

export type QueuedExpense = ExpenseCreate & { client_id: string; queued_at: string };

const KEY = 'offline_expense_queue';
let flushing: Promise<FlushResult> | null = null;

export type FlushResult = { sent: number; left: number };

async function read(): Promise<QueuedExpense[]> {
  const raw = await Storage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

async function write(items: QueuedExpense[]) {
  await Storage.setItem(KEY, JSON.stringify(items));
}

export async function enqueue(item: QueuedExpense) {
  await write([...(await read()), item]);
}

export async function pendingCount(): Promise<number> {
  return (await read()).length;
}

/** ส่งคิวทีละรายการตามลำดับ — เจอเน็ตหลุดก็หยุด (ลองใหม่รอบหน้า) */
export function flushQueue(): Promise<FlushResult> {
  // เรียกซ้อนกัน (หลายหน้าเรียกพร้อมกัน) → ใช้รอบที่กำลังส่งอยู่ ไม่ส่งซ้ำ
  flushing ??= (async () => {
    const queue = await read();
    const left: QueuedExpense[] = [];
    let sent = 0;
    for (let i = 0; i < queue.length; i++) {
      const { queued_at: _, ...body } = queue[i];
      try {
        await createExpense(body);
        sent++;
      } catch (e) {
        if (isNetworkError(e)) {
          left.push(...queue.slice(i)); // ยังออฟไลน์ เก็บที่เหลือไว้ทั้งหมด
          break;
        }
        // เซิร์ฟเวอร์ปฏิเสธ (เช่นหมวดถูกลบไปแล้ว) — เก็บไว้ ไม่ทิ้งข้อมูลผู้ใช้ แต่ส่งรายการอื่นต่อ
        console.warn('[offline queue] rejected', e instanceof ApiError ? e.detail : e);
        left.push(queue[i]);
      }
    }
    await write(left);
    return { sent, left: left.length };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
