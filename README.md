# 💛 Expense Tracker

แอป Android บันทึกรายจ่ายรายเดือน ใช้ส่วนตัว ข้อมูลเก็บในเครื่องตัวเอง

## โครงสร้าง
- `backend/` — FastAPI + PostgreSQL (Docker) + AI อ่านสลิป
- `app/` — Expo (React Native) build เป็น APK
- `data/` — รูปสลิป/บิล, ข้อมูล DB, backup (**ไม่ขึ้น Git**)

## การเชื่อมต่อ
มือถือ → Tailscale → FastAPI บนคอม Windows
