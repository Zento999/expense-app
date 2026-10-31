// ทดสอบ stats.ts + bills.ts + settings ด้วยโค้ดจริง (วันที่สมมติ 15 พ.ย. 2026)
import assert from 'node:assert/strict';

const db = await import(new URL('../src/lib/db.ts', import.meta.url).href);
const stats = await import(new URL('../src/lib/stats.ts', import.meta.url).href);
const bills = await import(new URL('../src/lib/bills.ts', import.meta.url).href);
let pass = 0;
const ok = (n) => { pass++; console.log(`PASS ${n}`); };
const now = new Date(2026, 10, 15, 20);
const add = (amount, cat, d, payee = null, h = 12) =>
  db.addExpense({ amount, categoryId: cat, source: 'cash', spentAt: new Date(2026, 10, d, h), payee });

// settings
assert.equal(await db.getSetting('x'), null);
await db.setSetting('x', '1'); await db.setSetting('x', '2');
assert.equal(await db.getSetting('x'), '2');
await db.setSetting('x', null);
assert.equal(await db.getSetting('x'), null);
ok('settings get/set/upsert/delete');

// budget pace
const b1 = stats.budgetStatus(12000, 4000, now); // ควรใช้ถึงวันที่15 = 6000
assert.equal(b1.mood, 'happy'); assert.equal(b1.percent, 33); assert.equal(b1.perDayLeft, Math.floor(8000 / 16));
assert.equal(stats.budgetStatus(12000, 6500, now).mood, 'meh');
assert.equal(stats.budgetStatus(12000, 8000, now).mood, 'worried');
const over = stats.budgetStatus(1000, 1200, now);
assert.equal(over.over, 200); assert.equal(over.perDayLeft, 0); assert.equal(over.mood, 'worried');
ok('budget status: pace, per-day left, over budget');

// streak: 13, 14, 15 + 11 (ขาดวันที่ 12)
await add('50', 1, 11); await add('50', 1, 13, 'กาแฟ'); await add('55', 2, 14, 'กาแฟ'); await add('55', 2, 15, 'กาแฟ', 0);
let s = await stats.getStreak(now);
assert.deepEqual(s, { days: 3, loggedToday: true });
s = await stats.getStreak(new Date(2026, 10, 16, 8));
assert.deepEqual(s, { days: 3, loggedToday: false });
assert.equal((await stats.getStreak(new Date(2026, 10, 18))).days, 0);
ok('streak counts back from today or yesterday');

// daily totals: วันที่ 15 เวลา 00:00 ต้องอยู่วันที่ 15 (ไม่ใช่ 14 ตาม UTC)
const daily = await stats.getDailyTotals('2026-11');
assert.equal(daily.get(15), 55); assert.equal(daily.get(14), 55); assert.equal(daily.get(12), undefined);
ok('daily totals grouped by local day');

// day filter
const d14 = await db.listExpenses({ day: '2026-11-14' });
assert.equal(d14.total_count, 1); assert.equal(d14.total_amount, 55);
ok('listExpenses day filter');

// quick picks: กาแฟ 55 หมวด 2 ซ้ำ 2 ครั้ง, กาแฟ 50 หมวด1 ครั้งเดียว → ไม่ติด
const picks = await stats.getQuickPicks(now);
assert.equal(picks.length, 1); assert.equal(picks[0].payee, 'กาแฟ'); assert.equal(picks[0].amount, 55);
ok('quick picks need >= 2 identical entries');

// insight: ฐาน 4 สัปดาห์ก่อน คาเฟ่ (2) สัปดาห์ละ 100 → สัปดาห์นี้ 110 + 400 = 510
for (const d of [-20, -13, -6, 1]) await db.addExpense({ amount: '100', categoryId: 2, source: 'cash', spentAt: new Date(2026, 9, 31 + d, 12) });
await add('400', 2, 12);
const ins = await stats.getInsight(now);
assert.equal(ins.tone, 'warn'); assert.match(ins.text, /เครื่องดื่ม\/คาเฟ่ มากกว่าปกติ \d+%/);
ok(`insight: ${ins.text}`);
assert.equal(await stats.getInsight(new Date(2027, 5, 1)), null);
ok('insight null when no recent data');

// bills
await bills.saveBill(null, { name: 'ค่าเน็ต', amount: '599', dayOfMonth: 3, categoryId: 6 }, now);   // วันที่ 3 เลยมาแล้ว → งวดถัดไป ธ.ค.
await bills.saveBill(null, { name: 'ค่าโทร', amount: '299', dayOfMonth: 20, categoryId: 6 }, now);   // งวด 20 พ.ย.
await bills.saveBill(null, { name: 'ค่าห้อง', amount: '4500', dayOfMonth: 31, categoryId: 5 }, now); // 30 พ.ย.
const all = await bills.listBills();
const due = Object.fromEntries(all.map((b) => [b.name, bills.nextDue(b, now)]));
assert.equal(due['ค่าเน็ต'].dueMonth, '2026-12');
assert.equal(due['ค่าโทร'].daysLeft, 5);
assert.equal(due['ค่าห้อง'].dueDate.getDate(), 30);
ok('next due date: skips passed day, clamps 31 → 30');
let up = await bills.getUpcomingBills(now);
assert.deepEqual(up.map((b) => b.name), ['ค่าโทร']);
await bills.payBill(up[0], now);
up = await bills.getUpcomingBills(now);
assert.equal(up.length, 0);
assert.equal(bills.nextDue((await bills.listBills()).find((b) => b.name === 'ค่าโทร'), now).dueMonth, '2026-12');
const paid = await db.listExpenses({ q: 'ค่าโทร' });
assert.equal(paid.total_amount, 299);
ok('pay bill records expense and moves to next month');
const late = await bills.getUpcomingBills(new Date(2026, 11, 5));
assert.equal(late.find((b) => b.name === 'ค่าเน็ต').daysLeft, -2);
ok('overdue bill shows negative days');

// backup round-trip carries settings + bills
await db.setSetting('budget_satang', '1200000');
const bytes = await db.exportDatabase();
await db.setSetting('budget_satang', null);
await bills.deleteBill(all[0].id);
await db.replaceAllData(bytes, () => null);
assert.equal(await stats.getBudget(), 12000);
assert.equal((await bills.listBills()).length, 3);
ok('restore brings back budget and bills');

console.log(`\nALL ${pass} FEATURE CHECKS PASSED`);
