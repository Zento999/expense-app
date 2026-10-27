import { File } from 'expo-file-system';

import { loadSettings } from '@/lib/settings';
import type { Category, Expense, ExpenseCreate, ReadResult, ScanKind } from '@/lib/types';

export type ConnectionStatus = 'ok' | 'not-configured' | 'unreachable' | 'bad-token';

/** error จาก API พร้อม status — หน้าจอใช้แยกข้อความ เช่น 503 = ยังไม่ได้ตั้ง AI */
export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`HTTP ${status}: ${detail}`);
  }
}

/** เรียก API พร้อมแนบ token ให้อัตโนมัติ */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { serverUrl, appToken } = await loadSettings();
  if (!serverUrl) throw new Error('ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์');
  // body เป็น JSON string → ใส่ Content-Type เอง / เป็น FormData → ปล่อยให้ fetch ใส่ boundary ให้
  const jsonHeader: Record<string, string> = typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {};
  const res = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: { ...jsonHeader, 'X-App-Token': appToken, ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, typeof body.detail === 'string' ? body.detail : res.statusText);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/** เช็คทั้งเครือข่าย (Tailscale) และ token ในคราวเดียว เพื่อบอกผู้ใช้ได้ว่าพังตรงไหน */
export async function checkConnection(): Promise<ConnectionStatus> {
  const { serverUrl, appToken } = await loadSettings();
  if (!serverUrl || !appToken) return 'not-configured';
  try {
    const res = await fetch(`${serverUrl}/api/ping`, {
      headers: { 'X-App-Token': appToken },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401) return 'bad-token';
    return res.ok ? 'ok' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

export function getCategories() {
  return apiFetch<Category[]>('/api/categories');
}

export function createExpense(body: ExpenseCreate) {
  return apiFetch<Expense>('/api/expenses', { method: 'POST', body: JSON.stringify(body) });
}

/** อัปโหลดรูปจากเครื่อง (uri ของไฟล์) → upload_id */
export async function uploadImage(uri: string): Promise<string> {
  const form = new FormData();
  // SDK 58 ใช้ expo/fetch เป็น fetch หลัก ซึ่งไม่รองรับแบบเก่า { uri, name, type }
  // ต้องส่งเป็น File ของ expo-file-system (เป็น Blob จริง อ่าน bytes ได้)
  form.append('file', new File(uri));
  const { upload_id } = await apiFetch<{ upload_id: string }>('/api/uploads', { method: 'POST', body: form });
  return upload_id;
}

/** ข้อความ error ที่บอกสาเหตุจริง — เน็ตหลุด กับ เซิร์ฟเวอร์ปฏิเสธ ต้องแก้คนละแบบ */
export function describeError(e: unknown, action: string): string {
  console.warn(`[${action}]`, e); // ดูรายละเอียดเต็มได้ในหน้าต่าง Metro บนคอม
  if (e instanceof ApiError) return `${action}ไม่สำเร็จ (HTTP ${e.status}: ${e.detail})`;
  if (e instanceof TypeError) return `${action}ไม่สำเร็จ — ติดต่อเซิร์ฟเวอร์ไม่ได้ เช็คการเชื่อมต่อ`;
  return `${action}ไม่สำเร็จ — ${e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'}`;
}

export function readUpload(uploadId: string, kind: ScanKind) {
  return apiFetch<ReadResult>(`/api/uploads/${uploadId}/read?kind=${kind}`, { method: 'POST' });
}
