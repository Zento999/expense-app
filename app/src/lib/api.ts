import { loadSettings } from '@/lib/settings';

export type ConnectionStatus = 'ok' | 'not-configured' | 'unreachable' | 'bad-token';

/** เรียก API พร้อมแนบ token ให้อัตโนมัติ */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { serverUrl, appToken } = await loadSettings();
  if (!serverUrl) throw new Error('ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์');
  const res = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-App-Token': appToken, ...init.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
