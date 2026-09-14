/**
 * Accès sécurisé au stockage local.
 *
 * RÈGLE (§45) : personne n'appelle `localStorage` directement dans les
 * composants. Tout passe par ce module, qui :
 *  - ne plante pas côté serveur (SSR) ;
 *  - tolère les navigateurs en navigation privée (quota / accès refusé) ;
 *  - fournit un « store » réactif utilisable avec `useSyncExternalStore`.
 */

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota dépassé ou stockage désactivé : on n'interrompt jamais l'utilisateur.
  }
}

export function removeKey(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export interface LocalStore<T> {
  /** Instantané stable (référence constante tant que rien ne change). */
  get(): T;
  set(next: T | ((previous: T) => T)): void;
  subscribe(listener: () => void): () => void;
  reset(): void;
}

/**
 * Crée un store persistant réactif.
 *
 * `getSnapshot` doit renvoyer une référence stable : c'est la condition pour
 * que `useSyncExternalStore` ne boucle pas. On cache donc la valeur.
 */
export function createLocalStore<T>(
  key: string,
  initialState: T,
  options: { migrate?: (raw: unknown) => T } = {},
): LocalStore<T> {
  let cache: T | undefined;
  let hydrated = false;
  const listeners = new Set<() => void>();

  const load = (): T => {
    if (!isBrowser()) return initialState;
    const raw = readJson<unknown>(key, null);
    if (raw === null) return initialState;
    if (options.migrate) {
      try {
        return options.migrate(raw);
      } catch {
        return initialState;
      }
    }
    return raw as T;
  };

  return {
    get() {
      if (!hydrated) {
        cache = load();
        hydrated = true;
      }
      return cache as T;
    },
    set(next) {
      const previous = this.get();
      const value = typeof next === "function" ? (next as (prev: T) => T)(previous) : next;
      cache = value;
      hydrated = true;
      writeJson(key, value);
      listeners.forEach((listener) => listener());
      // Synchronise les autres onglets ouverts sur TONIGHT.
      notifyCrossTab(key);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      cache = initialState;
      hydrated = true;
      removeKey(key);
      listeners.forEach((listener) => listener());
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Synchronisation entre onglets                                              */
/* -------------------------------------------------------------------------- */

const tabListeners = new Map<string, Set<() => void>>();

export function notifyCrossTab(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(`${key}:ping`, String(Date.now()));
  } catch {
    // ignore
  }
}

/** Branche l'écoute `storage` (autres onglets) sur un store. */
export function bindCrossTab(key: string, onChange: () => void): () => void {
  if (!isBrowser()) return () => undefined;
  const handler = (event: StorageEvent) => {
    if (event.key === key) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
