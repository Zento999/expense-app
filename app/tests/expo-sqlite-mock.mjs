// ตัวแทน expo-sqlite สำหรับทดสอบบนคอม: ใช้ SQLite ในตัว Node (node:sqlite) แต่ API หน้าตาเหมือน expo-sqlite
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const flat = (args) => (args.length === 1 && Array.isArray(args[0]) ? args[0] : args);
let seq = 0;
const tmpFile = () => join(tmpdir(), `expo-sqlite-mock-${process.pid}-${seq++}.db`);

function wrap(d) {
  return {
    execAsync: async (sql) => d.exec(sql),
    runAsync: async (sql, ...a) => {
      const r = d.prepare(sql).run(...flat(a));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    getFirstAsync: async (sql, ...a) => d.prepare(sql).get(...flat(a)) ?? null,
    getAllAsync: async (sql, ...a) => d.prepare(sql).all(...flat(a)),
    withTransactionAsync: async (fn) => {
      d.exec('BEGIN');
      try {
        await fn();
        d.exec('COMMIT');
      } catch (e) {
        d.exec('ROLLBACK');
        throw e;
      }
    },
    // serialize ด้วย VACUUM INTO ไฟล์ชั่วคราว แล้วอ่าน bytes (ผลเหมือน sqlite3_serialize)
    serializeAsync: async () => {
      const f = tmpFile();
      d.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`);
      const bytes = new Uint8Array(readFileSync(f));
      rmSync(f);
      return bytes;
    },
    closeAsync: async () => d.close(),
  };
}

export async function openDatabaseAsync() {
  return wrap(new DatabaseSync(':memory:'));
}

export async function deserializeDatabaseAsync(bytes) {
  const f = tmpFile();
  writeFileSync(f, bytes);
  const db = wrap(new DatabaseSync(f));
  const close = db.closeAsync;
  db.closeAsync = async () => {
    await close();
    rmSync(f, { force: true });
  };
  return db;
}
