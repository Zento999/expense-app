// รันโค้ด app/src/lib/db.ts จริงทั้งไฟล์ (migration, insert, list, summary, update, delete)
import assert from 'node:assert/strict';

const db = await import(new URL('../src/lib/db.ts', import.meta.url).href);
let pass = 0;
const check = (name, fn) => {
  fn();
  pass++;
  console.log(`PASS ${name}`);
};

const cats = await db.getCategories();
check('migration seeds 10 categories', () => assert.equal(cats.length, 10));

const now = new Date();
const y = now.getFullYear();
const m = now.getMonth(); // เดือนนี้ (0-based)
const day = now.getDate();
const key = (yy, mm) => `${new Date(yy, mm, 1).getFullYear()}-${String(new Date(yy, mm, 1).getMonth() + 1).padStart(2, '0')}`;
const thisMonth = key(y, m);
const lastMonth = key(y, m - 1);

// เดือนนี้: วันนี้ 65.50 (อาหาร) + วันที่ 1 0.10 (เดินทาง)
await db.addExpense({ amount: '65.5', categoryId: 1, source: 'cash', spentAt: new Date(y, m, day, 9), payee: 'ข้าวมันไก่' });
await db.addExpense({ amount: '0.10', categoryId: 3, source: 'cash', spentAt: new Date(y, m, 1, 0, 10), payee: 'เช้าวันที่ 1' });
// เดือนก่อน: วันที่ 1 (ในช่วงเดียวกัน) 100 อาหาร + วันที่ 28 (หลังวันนี้ ถ้าวันนี้ < 28) 200 อาหาร
await db.addExpense({ amount: '100', categoryId: 1, source: 'cash', spentAt: new Date(y, m - 1, 1, 12), payee: 'prev-early' });
await db.addExpense({ amount: '0.20', categoryId: 1, source: 'cash', spentAt: new Date(y, m - 1, 2, 12), payee: "ร้านป้า'ส้ม" });
const lateDay = Math.min(28, new Date(y, m, 0).getDate());
await db.addExpense({ amount: '200', categoryId: 1, source: 'cash', spentAt: new Date(y, m - 1, lateDay, 23), payee: 'prev-late' });

check('count = 5', async () => {});
assert.equal(await db.countExpenses(), 5);

const list = await db.listExpenses({ month: thisMonth });
check('list this month: 2 items, newest first, total 65.60', () => {
  assert.deepEqual(list.items.map((e) => e.payee), ['ข้าวมันไก่', 'เช้าวันที่ 1']);
  assert.equal(list.total_count, 2);
  assert.equal(list.total_amount, 65.6);
});
const search = await db.listExpenses({ q: 'ส้ม' });
check("search with quote in name ร้านป้า'ส้ม", () => assert.equal(search.items[0]?.payee, "ร้านป้า'ส้ม"));

const s = await db.getSummary(thisMonth);
check('summary total/count/today', () => {
  assert.equal(s.total, 65.6);
  assert.equal(s.count, 2);
  assert.equal(s.today_total, day === 1 ? 65.6 : 65.5); // วันที่ 1: รายการ "เช้าวันที่ 1" ก็เป็นของวันนี้ด้วย
  assert.equal(s.is_current, true);
  assert.equal(s.compare_day, day);
});
check('summary same-period compare excludes later days of last month', () => {
  // "ช่วงเดียวกัน" นับถึงเวลาเดียวกันของเดือนก่อน (ละเอียดถึงนาที ไม่ใช่แค่วันที่) — คิดคำตอบจากเวลาที่รันจริง
  const prevCutoff = new Date(y, m - 1, 1).getTime() + (Date.now() - new Date(y, m, 1).getTime());
  const prevItems = [
    [new Date(y, m - 1, 1, 12), 100],
    [new Date(y, m - 1, 2, 12), 0.2],
    [new Date(y, m - 1, lateDay, 23), 200],
  ];
  const want = Math.round(prevItems.filter(([d]) => d.getTime() < prevCutoff).reduce((sum, [, a]) => sum + a, 0) * 100) / 100;
  assert.equal(Math.round(s.prev_same_period_total * 100) / 100, want);
  assert.equal(Math.round(s.prev_month_total * 100) / 100, 300.2);
});
check('summary by_category sorted, with prev totals', () => {
  assert.equal(s.by_category[0].category.name, 'อาหาร');
  assert.equal(s.by_category[0].total, 65.5);
  assert.equal(s.by_category[1].category.name, 'เดินทาง');
});
check('summary 6 months ending this month', () => {
  assert.equal(s.months.length, 6);
  assert.equal(s.months[5].month, thisMonth);
  assert.equal(s.months[4].month, lastMonth);
  assert.equal(Math.round(s.months[4].total * 100) / 100, 300.2);
});
const past = await db.getSummary(lastMonth);
check('past month: not current, full-month compare', () => {
  assert.equal(past.is_current, false);
  assert.equal(past.compare_day, null);
  assert.equal(past.days, new Date(y, m, 0).getDate());
});

const first = list.items[0];
await db.updateExpense(first.id, { amount: '70.25', categoryId: 2, spentAt: new Date(y, m, day, 10), payee: null, note: 'แก้แล้ว' });
const edited = await db.getExpense(first.id);
check('update', () => {
  assert.equal(edited.amount, 70.25);
  assert.equal(edited.category.name, 'เครื่องดื่ม/คาเฟ่');
  assert.equal(edited.payee, null);
  assert.equal(edited.note, 'แก้แล้ว');
});
await db.deleteExpense(first.id);
check('delete', async () => {});
assert.equal(await db.getExpense(first.id), null);
assert.equal(await db.countExpenses(), 4);

const imgId = await db.addExpense({ amount: '142', categoryId: 3, source: 'slip', spentAt: new Date(), payee: 'GRAB', imageUri: 'file:///data/receipts/abc.jpg' });
const withImg = await db.getExpense(imgId);
check('slip with image: has_image + image_uri', () => {
  assert.equal(withImg.has_image, true);
  assert.equal(withImg.image_uri, 'file:///data/receipts/abc.jpg');
  assert.equal(withImg.source, 'slip');
});
const removedUri = await db.deleteExpense(imgId);
check('delete returns image uri for file cleanup', () => assert.equal(removedUri, 'file:///data/receipts/abc.jpg'));
const cashId = (await db.listExpenses({ q: 'prev-early' })).items[0].id;
check('delete cash (no image) returns null', async () => {});
assert.equal(await db.deleteExpense(cashId), null);

console.log(`\nALL ${pass} CHECKS PASSED (today=${now.toDateString()}, TZ offset=${-now.getTimezoneOffset() / 60}h)`);
