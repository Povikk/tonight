/**
 * Petit système de cache (exigence §63).
 *
 * - `createTtlCache` : cache mémoire avec expiration et déduplication des appels
 *   concurrents. C'est ce qui évite de rappeler TMDB à chaque rendu React.
 * - `readBrowserCache` / `writeBrowserCache` : cache localStorage avec TTL, pour
 *   les données peu volatiles (genres, plateformes, détails).
 *
 * Aucun de ces caches ne stocke quoi que ce soit de sensible.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  getOrSet(key: string, factory: () => Promise<T>): Promise<T>;
  clear(): void;
  size(): number;
}

export function createTtlCache<T>(ttlMs: number, maxEntries = 500): TtlCache<T> {
  const store = new Map<string, CacheEntry<T>>();
  const inFlight = new Map<string, Promise<T>>();

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt < Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      if (store.size >= maxEntries) {
        // Éviction FIFO : suffisant pour ce volume de données.
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    async getOrSet(key, factory) {
      const cached = this.get(key);
      if (cached !== undefined) return cached;
      const pending = inFlight.get(key);
      if (pending) return pending;
      const promise = factory()
        .then((value) => {
          this.set(key, value);
          return value;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, promise);
      return promise;
    },
    clear() {
      store.clear();
      inFlight.clear();
    },
    size() {
      return store.size;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Cache navigateur (localStorage, avec expiration)                           */
/* -------------------------------------------------------------------------- */

export const BROWSER_CACHE_PREFIX = "tonight:cache:";

export function readBrowserCache<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(BROWSER_CACHE_PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { expiresAt: number; value: T };
    if (!parsed || typeof parsed.expiresAt !== "number" || parsed.expiresAt < Date.now()) {
      window.localStorage.removeItem(BROWSER_CACHE_PREFIX + key);
      return undefined;
    }
    return parsed.value;
  } catch {
    return undefined;
  }
}

export function writeBrowserCache<T>(key: string, value: T, ttlMs: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      BROWSER_CACHE_PREFIX + key,
      JSON.stringify({ expiresAt: Date.now() + ttlMs, value }),
    );
  } catch {
    // quota dépassé : on ignore silencieusement, le cache n'est pas critique.
  }
}

export function clearBrowserCache(): void {
  if (typeof window === "undefined") return;
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(BROWSER_CACHE_PREFIX))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // ignore
  }
}
