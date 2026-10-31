import assert from 'node:assert/strict';
const db = await import(new URL('../src/lib/db.ts', import.meta.url).href);
const recap = await import(new URL('../src/lib/recap.ts', import.meta.url).href);
let pass = 0; const ok = (n) => { pass++; console.log(`PASS ${n}`); };
const add = (amount, cat, mo, d) => db.addExpense({ amount, categoryId: cat, source: 'cash', spentAt: new Date(2026, mo, d, 12) });
// ก.ย. 1000 รวม, ต.ค.: วันที่ 1-5 ติดกัน, 10, 18 (หนักสุด)
await add('1000', 1, 8, 15);
for (const d of [1, 2, 3, 4, 5]) await add('100', 1, 9, d);
await add('50', 2, 9, 10);
await add('600', 4, 9, 18);
const r = await recap.getMonthRecap('2026-10');
assert.equal(r.total, 1150); assert.equal(r.count, 7);
assert.equal(r.longestStreak, 5); assert.equal(r.loggedDays, 7); assert.equal(r.daysInMonth, 31);
assert.equal(r.heaviestDay.date.getDate(), 18); assert.equal(r.heaviestDay.total, 600);
assert.equal(r.topCategory.category.name, 'ช้อปปิ้ง'); assert.equal(r.topCategory.total, 600);
assert.equal(r.changePercent, 15); assert.equal(r.medal, 'bronze');
ok('recap numbers: streak 5, heaviest 18th, +15% vs prev, bronze without budget');
await db.setSetting('budget_satang', String(1300 * 100));
assert.equal((await recap.getMonthRecap('2026-10')).medal, 'gold'); // 88%
await db.setSetting('budget_satang', String(1200 * 100));
assert.equal((await recap.getMonthRecap('2026-10')).medal, 'silver'); // 96%
await db.setSetting('budget_satang', String(1000 * 100));
assert.equal((await recap.getMonthRecap('2026-10')).medal, 'ribbon');
ok('medal by budget: gold/silver/ribbon');
assert.equal(recap.pickMedal(null, 25, 31).medal, 'gold');
assert.equal(recap.pickMedal(null, 16, 31).medal, 'silver');
ok('medal by logging days');
assert.equal(await recap.pendingRecapMonth(new Date(2026, 10, 3)), '2026-10');
assert.equal(await recap.pendingRecapMonth(new Date(2026, 10, 8)), null);
assert.equal(await recap.pendingRecapMonth(new Date(2026, 8, 3)), null); // ส.ค. ไม่มีข้อมูล
ok('pending recap only first 7 days and when prev month has data');
console.log(`\nALL ${pass} RECAP CHECKS PASSED`);
