"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { LocalStore } from "@/storage/safeStorage";

/**
 * Branche un store local sur React.
 *
 * On évite tout avertissement d'hydratation en exposant `hydrated` : les
 * composants qui affichent des données locales attendent le premier rendu
 * client avant de les montrer (squelette ou état vide en attendant).
 */
export function useLocalStore<T>(store: LocalStore<T>): { value: T; hydrated: boolean } {
  const value = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.get(),
    () => store.get(),
  );
  return { value, hydrated: useHydrated() };
}

/** `true` après le montage côté client. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
