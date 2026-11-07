/** Tiny in-memory TTL cache for hot read-only payloads. */
type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

export function ttlGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function ttlSet<T>(key: string, value: T, ttlMs: number): T {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function ttlDel(prefixOrKey: string): void {
  if (!prefixOrKey.endsWith('*')) {
    store.delete(prefixOrKey);
    return;
  }
  const prefix = prefixOrKey.slice(0, -1);
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
