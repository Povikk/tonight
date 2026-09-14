/**
 * Versionnement du format de stockage local (§45).
 *
 * Objectif : pouvoir faire évoluer les données stockées sans casser
 * l'expérience des utilisateurs existants. On ne supprime jamais les données
 * silencieusement : une migration mal comprise serait pire qu'un reset.
 */

export const STORAGE_VERSION = 1;
export const STORAGE_PREFIX = `tonight:v${STORAGE_VERSION}:`;

/** Clés logiques (toujours utilisées via `storageKey`). */
export const STORAGE_KEYS = {
  history: "history",
  favorites: "favorites",
  feedback: "feedback",
  settings: "settings",
  /** Marqueur global : version réellement installée sur l'appareil. */
  version: "storage-version",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function storageKey(key: StorageKey | string): string {
  return `${STORAGE_PREFIX}${key}`;
}

/** Toutes les clés possibles, pour la purge et l'export. */
export function allStorageKeys(): string[] {
  return [STORAGE_KEYS.history, STORAGE_KEYS.favorites, STORAGE_KEYS.feedback, STORAGE_KEYS.settings].map(
    (key) => storageKey(key),
  );
}
