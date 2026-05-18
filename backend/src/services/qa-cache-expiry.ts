export type CacheEntry<T> = {
  key: string;
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export function setCacheEntry<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { key, value, expiresAt: Date.now() + ttlMs });
}

export function getCacheEntry<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function purgeExpiredCacheEntries(): number {
  const now = Date.now();
  let removed = 0;
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function startQaCacheExpirySweep(intervalMs = 30_000): NodeJS.Timeout {
  return setInterval(() => {
    purgeExpiredCacheEntries();
  }, intervalMs);
}

export function cacheSize(): number {
  return store.size;
}
