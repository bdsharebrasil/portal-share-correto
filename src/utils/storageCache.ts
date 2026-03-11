// Cache persistente simples usando localStorage
export function saveCache<T>(key: string, data: T) {
  try {
    const item = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(item));
  } catch {}
}

export function loadCache<T>(key: string, maxAgeMs: number): T | null {
  try {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;
    const item = JSON.parse(itemStr);
    if (Date.now() - item.timestamp > maxAgeMs) return null;
    return item.data as T;
  } catch {
    return null;
  }
}

export function clearCache(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}