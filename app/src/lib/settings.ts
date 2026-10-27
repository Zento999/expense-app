import * as SecureStore from 'expo-secure-store';

// เก็บที่อยู่เซิร์ฟเวอร์และ token ไว้ในที่เก็บแบบเข้ารหัสของมือถือ (ไม่ฝังในโค้ด/APK)
const SERVER_URL_KEY = 'server_url';
const APP_TOKEN_KEY = 'app_token';

export type ServerSettings = {
  serverUrl: string;
  appToken: string;
};

export async function loadSettings(): Promise<ServerSettings> {
  const [serverUrl, appToken] = await Promise.all([
    SecureStore.getItemAsync(SERVER_URL_KEY),
    SecureStore.getItemAsync(APP_TOKEN_KEY),
  ]);
  return { serverUrl: serverUrl ?? '', appToken: appToken ?? '' };
}

export async function saveSettings({ serverUrl, appToken }: ServerSettings) {
  await Promise.all([
    SecureStore.setItemAsync(SERVER_URL_KEY, serverUrl.trim().replace(/\/+$/, '')),
    SecureStore.setItemAsync(APP_TOKEN_KEY, appToken.trim()),
  ]);
}
