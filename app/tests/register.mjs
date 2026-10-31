// ตั้งเวลาเป็นไทยก่อนโค้ดใดๆ ใช้ Date — เทสต์เรื่อง "วันไหน" ขึ้นกับเขตเวลา (UTC vs เวลาเครื่อง)
process.env.TZ ||= 'Asia/Bangkok';
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);
