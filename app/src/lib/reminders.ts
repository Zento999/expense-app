import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import { formatBaht } from '@/lib/amount';
import { listBills, nextDue } from '@/lib/bills';
import { getSetting, setSetting } from '@/lib/db';
import { getStreak } from '@/lib/stats';

/**
 * แจ้งเตือนในเครื่อง (ไม่ใช้เซิร์ฟเวอร์ ไม่ใช้ push) — Android ปลุกแอปตามเวลาที่จองไว้
 *
 * ทำไมไม่ใช้ "เตือนทุกวัน 21:00" แบบซ้ำอัตโนมัติ: เราอยากเตือนเฉพาะวันที่ยังไม่ได้บันทึก
 * แต่ตอนแจ้งเตือนเด้ง แอปไม่ได้รันอยู่ ตัดสินใจไม่ได้ — จึงจองเป็นรายวันล่วงหน้า 14 วัน
 * แล้วจองใหม่ทุกครั้งที่เปิดแอป/บันทึก (ถ้าวันนี้บันทึกแล้ว ก็ข้ามคืนนี้ไป)
 */

const CHANNEL_ID = 'reminders';
const DAYS_AHEAD = 14;
const BILL_DAYS_AHEAD = 60;
const BILL_HOUR = 9;

const KEYS = { daily: 'reminder_daily', time: 'reminder_time', bills: 'reminder_bills' } as const;

export type ReminderSettings = { daily: boolean; time: string; bills: boolean }; // time = "21:00"

export async function getReminderSettings(): Promise<ReminderSettings> {
  return {
    daily: (await getSetting(KEYS.daily)) === '1',
    time: (await getSetting(KEYS.time)) ?? '21:00',
    bills: (await getSetting(KEYS.bills)) === '1',
  };
}

/** ขอสิทธิ์แจ้งเตือน (Android 13+ ถามผู้ใช้ 1 ครั้ง) — คืน false ถ้าผู้ใช้ไม่อนุญาต */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function saveReminderSettings(s: ReminderSettings): Promise<void> {
  await setSetting(KEYS.daily, s.daily ? '1' : '0');
  await setSetting(KEYS.time, s.time);
  await setSetting(KEYS.bills, s.bills ? '1' : '0');
  await refreshReminders();
}

/** ยกเลิกของเก่าทั้งหมด แล้วจองใหม่ตามข้อมูลล่าสุด — เรียกซ้ำได้เรื่อยๆ ไม่มีผลข้างเคียง */
export async function refreshReminders(now = new Date()): Promise<void> {
  const s = await getReminderSettings();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!s.daily && !s.bills) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return; // ไม่ถามที่นี่ ถามตอนเปิดสวิตช์เท่านั้น

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'เตือนบันทึกรายจ่าย',
    importance: AndroidImportance.DEFAULT,
  });
  const at = (date: Date) => ({ type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID }) as const;

  if (s.daily) {
    const [h, m] = s.time.split(':').map(Number);
    const { loggedToday } = await getStreak(now);
    for (let i = loggedToday ? 1 : 0; i < DAYS_AHEAD; i++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m);
      if (date <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: 'วันนี้จ่ายอะไรไปบ้าง? 🧾', body: 'แตะเพื่อบันทึก ใช้ไม่ถึงนาที', data: { url: '/add/cash' } },
        trigger: at(date),
      });
    }
  }

  if (s.bills) {
    for (const bill of (await listBills()).map((b) => nextDue(b, now))) {
      const d = bill.dueDate;
      const date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), BILL_HOUR);
      if (date <= now || bill.daysLeft > BILL_DAYS_AHEAD) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: `ถึงกำหนดจ่าย ${bill.name} ${bill.category.icon}`, body: `${formatBaht(bill.amount)} · เปิดแอปเพื่อกด "จ่ายแล้ว"`, data: { url: '/' } },
        trigger: at(date),
      });
    }
  }
}

/** เรียกจากหน้าจอ: พังก็ไม่เป็นไร (เช่นใน Expo Go บางรุ่น) แค่ไม่ได้เตือน */
export function refreshRemindersQuietly() {
  refreshReminders().catch((e) => console.warn('[reminders] refresh', e));
}
