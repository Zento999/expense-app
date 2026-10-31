import assert from 'node:assert/strict';
const { buildCsv } = await import(new URL('../src/lib/csv.ts', import.meta.url).href);
const csv = buildCsv([{ id: 1, amount: 65.5, spent_at: new Date(2026, 10, 1, 0, 5).toISOString(), source: 'slip',
  category: { id: 1, name: 'อาหาร', icon: '🍜', color: '' }, payee: 'ร้าน "ป้า", สาขา 1', note: 'บรรทัด1\nบรรทัด2', created_at: '', has_image: false }]);
const lines = csv.split('\r\n');
assert.equal(lines[0], 'วันที่,เวลา,ยอด,หมวด,ร้าน/ผู้รับ,โน้ต,ที่มา');
assert.equal(lines[1], '2026-11-01,00:05,65.50,อาหาร,"ร้าน ""ป้า"", สาขา 1","บรรทัด1\nบรรทัด2",สลิป'.split('\r\n')[0]);
console.log('CSV OK');
