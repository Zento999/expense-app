// เปลี่ยน import ให้รันโค้ดแอปบน Node ได้: expo-sqlite → node:sqlite, native อื่นๆ → stub, '@/…' → src/…
const MOCK = new URL('./expo-sqlite-mock.mjs', import.meta.url).href;
const STUB = new URL('./native-stub.mjs', import.meta.url).href;
const STUBBED = new Set(['expo-document-picker', 'expo-file-system', 'expo-sharing', 'expo-crypto', 'expo-secure-store', 'expo-notifications', 'expo-local-authentication']);
const SRC = new URL('../src/', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'expo-sqlite') return { url: MOCK, shortCircuit: true };
  if (STUBBED.has(specifier)) return { url: STUB, shortCircuit: true };
  if (specifier.startsWith('@/')) return { url: `${SRC}${specifier.slice(2)}.ts`, shortCircuit: true };
  return next(specifier, context);
}
