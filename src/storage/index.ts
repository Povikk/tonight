/**
 * Point d'entrée du stockage local (§45, §68).
 *
 * « Tes préférences restent sur cet appareil. » Tout ce que TONIGHT retient vit
 * dans le localStorage du navigateur : aucun compte, aucun serveur, aucune
 * analytics.
 */

import { clearBrowserCache } from "@/utils/cache";
import { clearFavorites, favoritesStore } from "./favorites";
import { clearFeedback, feedbackStore } from "./feedback";
import { clearHistory, historyStore } from "./history";
import { settingsStore } from "./preferences";
import { computeTasteProfile } from "./tasteProfile";
import { allStorageKeys, STORAGE_PREFIX } from "./storageVersion";
import { removeKey as removeLocalKey } from "./safeStorage";

export * from "./history";
export * from "./favorites";
export * from "./feedback";
export * from "./preferences";
export * from "./tasteProfile";
export * from "./storageVersion";

/** Export JSON complet des données locales (l'utilisateur est propriétaire). */
export function exportLocalData(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: "TONIGHT",
      history: historyStore.get(),
      favorites: favoritesStore.get(),
      feedback: feedbackStore.get(),
      settings: settingsStore.get(),
      profile: computeTasteProfile(),
    },
    null,
    2,
  );
}

/** Supprime TOUTES les données locales (§68). */
export function clearAllData(): void {
  clearHistory();
  clearFavorites();
  clearFeedback();
  settingsStore.reset();
  clearBrowserCache();
  allStorageKeys().forEach((key) => removeLocalKey(key));
  // Purge des éventuelles clés d'anciennes versions.
  if (typeof window !== "undefined") {
    try {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith("tonight:"))
        .forEach((key) => removeLocalKey(key));
    } catch {
      // ignore
    }
  }
}

/** Taille approximative des données stockées, pour l'écran Réglages. */
export function localDataFootprint(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Object.keys(window.localStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX) || key.startsWith("tonight:"))
      .reduce((total, key) => total + (window.localStorage.getItem(key)?.length ?? 0), 0);
  } catch {
    return 0;
  }
}
