import { loadSettings } from '@/lib/settings';
import type {
  Category,
  Expense,
  ExpenseCreate,
  ExpenseList,
  ExpenseQuery,
  ExpenseUpdate,
  ReadResult,
  ScanKind,
  Summary,
} from '@/lib/types';

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

export function listExpenses({ month, q, categoryId, limit = 50, offset = 0 }: ExpenseQuery) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (month) params.set('month', month);
  if (q) params.set('q', q);
  if (categoryId != null) params.set('category_id', String(categoryId));
  return apiFetch<ExpenseList>(`/api/expenses?${params}`);
}

export function getSummary(month: string) {
  return apiFetch<Summary>(`/api/summary?month=${month}`);
}

export function getExpense(id: number) {
  return apiFetch<Expense>(`/api/expenses/${id}`);
}

export function updateExpense(id: number, body: ExpenseUpdate) {
  return apiFetch<Expense>(`/api/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteExpense(id: number) {
  return apiFetch<void>(`/api/expenses/${id}`, { method: 'DELETE' });
}

/** source ของรูปสำหรับ expo-image — แนบ token ไปกับ request รูปด้วย (ไม่งั้นได้ 401) */
export async function expenseImageSource(id: number, thumb = false) {
  const { serverUrl, appToken } = await loadSettings();
  return { uri: `${serverUrl}/api/expenses/${id}/image${thumb ? '?thumb=true' : ''}`, headers: { 'X-App-Token': appToken } };
}

/** อัปโหลด bytes ของรูป → upload_id */
export async function uploadImage(bytes: Uint8Array): Promise<string> {
  const form = new FormData();
  // SDK 58 ใช้ expo/fetch เป็น fetch หลัก: ไม่รับแบบเก่า { uri, name, type }
  // แต่รับ object ที่มี bytes() — ส่ง bytes ที่ได้จาก ImagePicker ตรงๆ ไม่ต้องเปิดไฟล์
  const part = { name: 'image.jpg', type: 'image/jpeg', bytes: async () => bytes };
  form.append('file', part as unknown as Blob);
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
