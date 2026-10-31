// รันเทสต์ทุกไฟล์ *.test.mjs — แยก process ต่อไฟล์ เพราะแต่ละไฟล์ต้องเริ่มจากฐานข้อมูลว่าง
// (db.ts เปิดฐานข้อมูลครั้งเดียวต่อ process) — รันด้วย: npm test
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
let failed = 0;
for (const f of files) {
  console.log(`\n=== ${f} ===`);
  const r = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', '--import', './register.mjs', f],
    { cwd: dir, stdio: 'inherit', env: { ...process.env, TZ: process.env.TZ || 'Asia/Bangkok' } },
  );
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n❌ ${failed}/${files.length} ไฟล์ไม่ผ่าน` : `\n✅ ผ่านครบ ${files.length} ไฟล์`);
process.exit(failed ? 1 : 0);
