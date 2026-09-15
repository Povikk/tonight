/** Favoris (§48). */

import type { MediaType } from "@/types/tonight";
import { STORAGE_KEYS, storageKey } from "./storageVersion";
import { createLocalStore } from "./safeStorage";
import { historyKey, historyStore, recordRecommendation, updateHistoryStatus } from "./history";

export interface FavoriteEntry {
  key: string;
  id: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
  voteAverage: number;
  genres: number[];
  addedAt: string;
}

function migrate(raw: unknown): FavoriteEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Partial<FavoriteEntry> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      key: String(entry.key ?? `${entry.mediaType}:${entry.id}`),
      id: Number(entry.id ?? 0),
      mediaType: (entry.mediaType === "tv" ? "tv" : "movie") as MediaType,
      title: String(entry.title ?? "Titre inconnu"),
      year: typeof entry.year === "number" ? entry.year : null,
      posterPath: entry.posterPath ?? null,
      voteAverage: Number(entry.voteAverage ?? 0),
      genres: Array.isArray(entry.genres) ? entry.genres : [],
      addedAt: String(entry.addedAt ?? new Date().toISOString()),
    }));
}

export const favoritesStore = createLocalStore<FavoriteEntry[]>(
  storageKey(STORAGE_KEYS.favorites),
  [],
  { migrate },
);

export function isFavorite(mediaType: MediaType, id: number): boolean {
  const key = historyKey(mediaType, id);
  return favoritesStore.get().some((entry) => entry.key === key);
}

/** Ajoute ou retire un favori. Renvoie le nouvel état. */
export function toggleFavorite(entry: Omit<FavoriteEntry, "addedAt">): boolean {
  const exists = isFavorite(entry.mediaType, entry.id);
  if (exists) {
    favoritesStore.set((previous) => previous.filter((item) => item.key !== entry.key));
    // Un retrait de favori ne doit pas laisser un statut « favori » orphelin
    // dans l'historique : le profil continuerait de le compter comme tel.
    if (historyStore.get().some((item) => item.key === entry.key && item.status === "favorite")) {
      updateHistoryStatus(entry.key, "accepted");
    }
    return false;
  }
  favoritesStore.set((previous) => [{ ...entry, addedAt: new Date().toISOString() }, ...previous]);
  // Un favori est aussi une entrée d'historique marquée « favori ». On la crée
  // si elle n'existe pas encore (favori ajouté depuis une fiche ou une
  // recherche manuelle), sinon on la met à jour.
  if (historyStore.get().some((item) => item.key === entry.key)) {
    updateHistoryStatus(entry.key, "favorite");
  } else {
    recordRecommendation({
      key: entry.key,
      id: entry.id,
      mediaType: entry.mediaType,
      title: entry.title,
      originalTitle: entry.title,
      year: entry.year,
      posterPath: entry.posterPath,
      overview: "",
      genres: entry.genres,
      matchPercent: 0,
      status: "favorite",
    });
  }
  return true;
}

export function removeFavorite(key: string): void {
  favoritesStore.set((previous) => previous.filter((item) => item.key !== key));
}

export function getFavorites(mediaType?: MediaType): FavoriteEntry[] {
  const all = favoritesStore.get();
  if (!mediaType) return all;
  return all.filter((entry) => entry.mediaType === mediaType);
}

export function clearFavorites(): void {
  favoritesStore.reset();
}
