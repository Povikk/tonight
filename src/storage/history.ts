/**
 * Historique des recommandations (§47).
 *
 * Chaque œuvre proposée par TONIGHT y entre avec un statut modifiable :
 * acceptée, vue, favorite, refusée.
 */

import type { MediaType, RefusalReason } from "@/types/tonight";
import { STORAGE_KEYS, storageKey } from "./storageVersion";
import { createLocalStore } from "./safeStorage";

export type HistoryStatus = "accepted" | "watched" | "favorite" | "refused";

export interface HistoryEntry {
  /** Clé unique « mediaType:id ». */
  key: string;
  id: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  year: number | null;
  posterPath: string | null;
  overview: string;
  genres: number[];
  /** Date de recommandation (ISO). */
  recommendedAt: string;
  matchPercent: number;
  status: HistoryStatus;
  /** Raisons du refus, si refusé (§43). */
  refusalReasons?: RefusalReason[];
  /** Contexte de la demande qui a produit la recommandation. */
  query?: string;
  /* --- Métadonnées utiles au calcul des goûts (§44) --- */
  runtime?: number | null;
  seasons?: number | null;
  popularity?: number;
  providers?: number[];
  moods?: string[];
}

export const HISTORY_STATUS_LABELS: Record<HistoryStatus, string> = {
  accepted: "▶ Accepté",
  watched: "👁️ Vu",
  favorite: "❤️ Favori",
  refused: "🚫 Refusé",
};

function migrate(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Partial<HistoryEntry> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      key: String(entry.key ?? `${entry.mediaType}:${entry.id}`),
      id: Number(entry.id ?? 0),
      mediaType: (entry.mediaType === "tv" ? "tv" : "movie") as MediaType,
      title: String(entry.title ?? "Titre inconnu"),
      originalTitle: String(entry.originalTitle ?? ""),
      year: typeof entry.year === "number" ? entry.year : null,
      posterPath: entry.posterPath ?? null,
      overview: String(entry.overview ?? ""),
      genres: Array.isArray(entry.genres) ? entry.genres : [],
      recommendedAt: String(entry.recommendedAt ?? new Date().toISOString()),
      matchPercent: Number(entry.matchPercent ?? 0),
      status: (entry.status ?? "accepted") as HistoryStatus,
      refusalReasons: Array.isArray(entry.refusalReasons) ? entry.refusalReasons : undefined,
      query: entry.query,
      runtime: typeof entry.runtime === "number" ? entry.runtime : null,
      seasons: typeof entry.seasons === "number" ? entry.seasons : null,
      popularity: typeof entry.popularity === "number" ? entry.popularity : undefined,
      providers: Array.isArray(entry.providers) ? entry.providers : undefined,
      moods: Array.isArray(entry.moods) ? entry.moods : undefined,
    }));
}

export const historyStore = createLocalStore<HistoryEntry[]>(
  storageKey(STORAGE_KEYS.history),
  [],
  { migrate },
);

/** Nombre maximum d'entrées conservées (évite de saturer le stockage). */
const MAX_ENTRIES = 300;

export function historyKey(mediaType: MediaType, id: number): string {
  return `${mediaType}:${id}`;
}

/** Enregistre (ou met à jour) une recommandation affichée à l'utilisateur. */
export function recordRecommendation(entry: Omit<HistoryEntry, "recommendedAt" | "status"> & {
  status?: HistoryStatus;
}): void {
  historyStore.set((previous) => {
    const existing = previous.find((item) => item.key === entry.key);
    if (existing) {
      return previous.map((item) =>
        item.key === entry.key
          ? { ...item, ...entry, status: entry.status ?? item.status, recommendedAt: new Date().toISOString() }
          : item,
      );
    }
    const next: HistoryEntry = {
      ...entry,
      status: entry.status ?? "accepted",
      recommendedAt: new Date().toISOString(),
    };
    return [next, ...previous].slice(0, MAX_ENTRIES);
  });
}

export function updateHistoryStatus(key: string, status: HistoryStatus, reasons?: RefusalReason[]): void {
  historyStore.set((previous) =>
    previous.map((item) =>
      item.key === key
        ? { ...item, status, refusalReasons: reasons ?? (status === "refused" ? item.refusalReasons : undefined) }
        : item,
    ),
  );
}

export function removeHistoryEntry(key: string): void {
  historyStore.set((previous) => previous.filter((item) => item.key !== key));
}

export function getHistory(): HistoryEntry[] {
  return historyStore.get();
}

export function clearHistory(): void {
  historyStore.reset();
}
