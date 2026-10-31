# 💛 Expense Tracker

แอป Android บันทึกรายจ่ายรายเดือน ใช้ส่วนตัว — **ทำงาน offline ทั้งหมด ไม่มีเซิร์ฟเวอร์**
ข้อมูลและรูปสลิปเก็บในมือถือเครื่องเดียว สำรองเป็นไฟล์ .zip ไปเก็บเอง (Google Drive / LINE Keep)

## โครงสร้าง
- `app/` — Expo (React Native) build เป็น APK ด้วย EAS
  - `src/lib/db.ts` — SQLite ในเครื่อง (expo-sqlite) + migration ด้วย `PRAGMA user_version`
  - `src/lib/stats.ts`, `bills.ts`, `recap.ts` — งบ, วันต่อเนื่อง, ปฏิทิน, บิลประจำ, สรุปเดือน
  - `src/lib/backup.ts` — สำรอง/กู้คืน (zip: `manifest.json` + `expense.db` + `receipts/`)
  - `src/lib/reminders.ts` — แจ้งเตือนในเครื่อง (ไม่ใช้ push)
  - `src/lib/lock.ts` — ล็อกแอปด้วยลายนิ้วมือ / PIN มือถือ
  - `tests/` — เทสต์ตรรกะข้อมูลบนคอม (Node + `node:sqlite` แทน expo-sqlite)
- `data/` — ข้อมูลจากยุคเซิร์ฟเวอร์เดิม (**ไม่ขึ้น Git**)

## คำสั่ง (PowerShell ในโฟลเดอร์ `app`)
```powershell
npx expo start --clear     # dev ด้วย Expo Go (ติดตั้งไลบรารีใหม่แล้วต้อง --clear)
npm test                   # เทสต์ทั้งหมด
npx tsc --noEmit           # typecheck
npx expo lint              # lint
npx --yes eas-cli@latest build -p android --profile preview   # build APK
```

## ประวัติ
เวอร์ชันแรกใช้ FastAPI + PostgreSQL บนคอม เชื่อมผ่าน Tailscale และใช้ AI อ่านสลิป
เปลี่ยนเป็นแอป offline เมื่อ 2026-10-31 เพราะต้องเปิดคอมและ Tailscale ตลอด — โค้ดเดิมยังดูได้ใน git history
