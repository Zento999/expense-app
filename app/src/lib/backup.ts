import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped, type Zippable } from 'fflate';

import { countExpenses, exportDatabase, replaceAllData } from '@/lib/db';
import { listReceiptFiles, writeReceiptFile } from '@/lib/local-images';

/**
 * สำรอง/กู้คืนทั้งแอปเป็นไฟล์ .zip เดียว:
 *   manifest.json  — บอกว่าเป็นไฟล์ของแอปนี้ + สร้างเมื่อไหร่ + มีกี่รายการ
 *   expense.db     — ฐานข้อมูลทั้งก้อน (serializeAsync)
 *   receipts/*.jpg — รูปสลิป/บิล (ชื่อไฟล์เดิม)
 */

const APP_ID = 'expense-app';
const FORMAT = 1;
const DB_ENTRY = 'expense.db';
const MANIFEST_ENTRY = 'manifest.json';
const RECEIPTS_PREFIX = 'receipts/';

export type BackupManifest = {
  app: string;
  format: number;
  created_at: string;
  expenses: number;
  images: number;
};

export type ParsedBackup = { manifest: BackupManifest; entries: Unzipped };

function dateStamp(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** base64 → bytes แบบวนลูปตรงๆ (เร็วกว่า Uint8Array.from(…, callback) มากกับไฟล์หลายสิบ MB) */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** สร้าง zip จาก bytes ที่เตรียมไว้ — แยกออกมาให้ทดสอบบนคอมได้ (ไม่แตะ native module) */
export function buildBackupZip(db: Uint8Array, images: { name: string; bytes: Uint8Array }[], expenses: number, now: Date): Uint8Array {
  const manifest: BackupManifest = {
    app: APP_ID,
    format: FORMAT,
    created_at: now.toISOString(),
    expenses,
    images: images.length,
  };
  const files: Zippable = {
    [MANIFEST_ENTRY]: strToU8(JSON.stringify(manifest, null, 2)),
    [DB_ENTRY]: db,
  };
  // jpg บีบอัดมาแล้ว บีบซ้ำได้ไม่กี่ % แต่เสียเวลามาก → level 0 (เก็บเฉยๆ)
  for (const img of images) files[`${RECEIPTS_PREFIX}${img.name}`] = [img.bytes, { level: 0 }];
  return zipSync(files, { level: 6 });
}

/** แกะ zip + ตรวจว่าเป็นไฟล์สำรองของแอปนี้จริง */
export function parseBackupZip(zip: Uint8Array): ParsedBackup {
  let entries: Unzipped;
  try {
    entries = unzipSync(zip);
  } catch {
    throw new Error('ไฟล์นี้ไม่ใช่ .zip หรือไฟล์เสีย');
  }
  const raw = entries[MANIFEST_ENTRY];
  const manifest = raw ? (JSON.parse(strFromU8(raw)) as BackupManifest) : null;
  if (!manifest || manifest.app !== APP_ID || !entries[DB_ENTRY]) {
    throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอปนี้');
  }
  if (manifest.format > FORMAT) throw new Error('ไฟล์สำรองมาจากแอปเวอร์ชันใหม่กว่า — อัปเดตแอปก่อน');
  return { manifest, entries };
}

/** รวมข้อมูลทั้งหมดเป็น .zip ในโฟลเดอร์ cache แล้วคืน uri ไว้แชร์ */
export async function createBackupFile(): Promise<{ uri: string; manifest: BackupManifest; sizeBytes: number }> {
  const now = new Date();
  const db = await exportDatabase();
  const images = await Promise.all(listReceiptFiles().map(async (f) => ({ name: f.name, bytes: await f.bytes() })));
  const zip = buildBackupZip(db, images, await countExpenses(), now);

  const out = new File(Paths.cache, `expense-backup-${dateStamp(now)}.zip`);
  if (out.exists) out.delete();
  await out.write(zip);
  return { uri: out.uri, manifest: parseBackupZip(zip).manifest, sizeBytes: zip.length };
}

/** เปิดหน้าแชร์ของ Android ให้ผู้ใช้เลือกที่เก็บ (Drive / LINE / Files / อีเมล ...) */
export async function shareBackupFile(uri: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('มือถือนี้แชร์ไฟล์ไม่ได้');
  await Sharing.shareAsync(uri, { mimeType: 'application/zip', dialogTitle: 'เก็บไฟล์สำรองไว้ที่...' });
}

/** ให้ผู้ใช้เลือกไฟล์สำรอง — ขอ base64 จากตัวเลือกไฟล์ตรงๆ (ไม่เปิดไฟล์จาก path ซึ่งเคยพังใน Expo Go) */
export async function pickBackupFile(): Promise<ParsedBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
    copyToCacheDirectory: true,
    base64: true,
  });
  if (result.canceled) return null;
  const b64 = result.assets[0].base64;
  if (!b64) throw new Error('อ่านไฟล์ที่เลือกไม่ได้');
  return parseBackupZip(base64ToBytes(b64));
}

/** กู้คืน: เขียนรูป → แทนที่ข้อมูล → ลบรูปเก่าที่ไม่อยู่ในไฟล์สำรอง คืนจำนวนรายการ */
export async function restoreBackup({ entries }: ParsedBackup): Promise<number> {
  const restored = new Map<string, string>(); // ชื่อไฟล์ → uri ใหม่ในเครื่องนี้
  for (const [path, bytes] of Object.entries(entries)) {
    const name = path.slice(RECEIPTS_PREFIX.length);
    if (path.startsWith(RECEIPTS_PREFIX) && name && !name.includes('/')) {
      restored.set(name, await writeReceiptFile(name, bytes));
    }
  }

  const count = await replaceAllData(entries[DB_ENTRY], (oldUri) => restored.get(oldUri.split('/').pop() ?? '') ?? null);

  // ลบรูปของข้อมูลชุดเก่าที่ถูกแทนที่ไปแล้ว (ทำหลังฐานข้อมูลสำเร็จเท่านั้น)
  for (const file of listReceiptFiles()) {
    if (!restored.has(file.name)) file.delete();
  }
  return count;
}
