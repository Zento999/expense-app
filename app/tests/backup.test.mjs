// ทดสอบวงจรสำรอง/กู้คืน ด้วยโค้ดจริงของ backup.ts + db.ts
import assert from 'node:assert/strict';

const db = await import(new URL('../src/lib/db.ts', import.meta.url).href);
const backup = await import(new URL('../src/lib/backup.ts', import.meta.url).href);
let pass = 0;
const ok = (name) => {
  pass++;
  console.log(`PASS ${name}`);
};

// ข้อมูลก่อนสำรอง: 2 รายการ (1 มีรูป)
await db.addExpense({ amount: '65.50', categoryId: 1, source: 'cash', spentAt: new Date(2026, 10, 1, 12), payee: 'ข้าวมันไก่' });
await db.addExpense({
  amount: '142', categoryId: 3, source: 'slip', spentAt: new Date(2026, 10, 2, 9), payee: 'GRAB',
  imageUri: 'file:///data/user/0/old.phone/files/receipts/aaa.jpg',
});

// 1) สำรอง
const dbBytes = await db.exportDatabase();
assert.equal(new TextDecoder().decode(dbBytes.slice(0, 15)), 'SQLite format 3');
ok('exportDatabase gives a real SQLite file');

const img = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
const zip = backup.buildBackupZip(dbBytes, [{ name: 'aaa.jpg', bytes: img }], await db.countExpenses(), new Date('2026-11-12T10:00:00Z'));
const parsed = backup.parseBackupZip(zip);
assert.equal(parsed.manifest.app, 'expense-app');
assert.equal(parsed.manifest.expenses, 2);
assert.equal(parsed.manifest.images, 1);
assert.deepEqual([...parsed.entries['receipts/aaa.jpg']], [...img]);
ok(`zip round-trip: manifest + db + image (${zip.length} bytes)`);

// 2) หลังสำรอง มีการเปลี่ยนแปลง (เพิ่ม/ลบ) — กู้คืนแล้วต้องกลับเป็นตอนสำรอง
await db.addExpense({ amount: '999', categoryId: 2, source: 'cash', spentAt: new Date(2026, 10, 3), payee: 'หลังสำรอง' });
await db.deleteExpense(1);
assert.equal(await db.countExpenses(), 2);

const n = await db.replaceAllData(parsed.entries['expense.db'], (old) =>
  old.endsWith('/aaa.jpg') ? 'file:///data/user/0/new.phone/files/receipts/aaa.jpg' : null,
);
const after = (await db.listExpenses({})).items;
assert.equal(n, 2);
assert.deepEqual(after.map((e) => e.payee).sort(), ['GRAB', 'ข้าวมันไก่']);
ok('restore replaces data with the backup (added row gone, deleted row back)');

const grab = after.find((e) => e.payee === 'GRAB');
assert.equal(grab.image_uri, 'file:///data/user/0/new.phone/files/receipts/aaa.jpg');
assert.equal(grab.amount, 142);
ok('restore remaps image path to the new phone');

assert.equal((await db.getCategories()).length, 10);
const s = await db.getSummary('2026-11');
assert.equal(s.total, 207.5);
ok('summary works after restore (65.50 + 142 = 207.50)');

// 3) ไฟล์ผิด
assert.throws(() => backup.parseBackupZip(new Uint8Array([1, 2, 3, 4])), /ไม่ใช่ .zip|ไฟล์เสีย/);
ok('random bytes rejected');
const { zipSync, strToU8 } = await import('fflate');
assert.throws(() => backup.parseBackupZip(zipSync({ 'hello.txt': strToU8('hi') })), /ไม่ใช่ไฟล์สำรองของแอปนี้/);
ok('other zip rejected');

// 4) กู้คืนพังกลางทาง → ข้อมูลเดิมต้องไม่หาย (transaction)
const before = await db.countExpenses();
await assert.rejects(db.replaceAllData(new Uint8Array([9, 9, 9]), () => null));
assert.equal(await db.countExpenses(), before);
ok('broken backup leaves current data untouched');

console.log(`\nALL ${pass} BACKUP CHECKS PASSED`);
