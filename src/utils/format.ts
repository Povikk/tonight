/** Formatage d'affichage (durées, années, notes, dates). */

import { classifySeriesStatus } from "./constants";
import type { Candidate, MediaType } from "@/types/tonight";

/** 92 → "1h32" */
export function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** Année seule, ou "Année inconnue" (jamais d'écran cassé). */
export function formatYear(year: number | null | undefined): string {
  return year ? String(year) : "Année inconnue";
}

/** "2020 - 2023" / "2020 - en cours" */
export function formatSeriesYears(candidate: Pick<Candidate, "year" | "endYear" | "status">): string {
  if (!candidate.year) return "Année inconnue";
  const kind = classifySeriesStatus(candidate.status);
  if (kind === "ongoing" || !candidate.endYear) return `${candidate.year} - en cours`;
  if (candidate.endYear === candidate.year) return String(candidate.year);
  return `${candidate.year} - ${candidate.endYear}`;
}

/** Note TMDB au format français : 7,4 */
export function formatRating(rating: number | null | undefined): string {
  if (!rating || rating <= 0) return "Non noté";
  return rating.toFixed(1).replace(".", ",");
}

/**
 * Nombre de votes lisible, essentiel pour le discours de confiance (§34) :
 *   8     → "8 votes"
 *   3000  → "3 000 votes"
 *   95000 → "95 000 votes"
 *   1.2 M → "1,2 M votes"
 * Le groupement des milliers est fait manuellement (pas via `toLocaleString`) :
 * le rendu doit être identique côté serveur et côté navigateur.
 */
export function formatVoteCount(count: number | null | undefined): string {
  if (!count || count <= 0) return "0 vote";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(".", ",")} M votes`;
  const grouped = String(Math.round(count)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} vote${count > 1 ? "s" : ""}`;
}

/** "3 saisons", "1 saison", "12 épisodes" */
export function formatSeasons(count: number | null | undefined): string | null {
  if (!count || count <= 0) return null;
  return `${count} saison${count > 1 ? "s" : ""}`;
}

export function formatEpisodes(count: number | null | undefined): string | null {
  if (!count || count <= 0) return null;
  return `${count} épisode${count > 1 ? "s" : ""}`;
}

/** Date courte FR de recommandation, pour l'historique. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function mediaLabel(mediaType: MediaType): string {
  return mediaType === "movie" ? "Film" : "Série";
}

/** Ligne de métadonnées de la fiche : "2020 · 1h30 · Comédie · Romance" */
export function metaLine(candidate: Candidate): string {
  const parts: string[] = [];
  if (candidate.mediaType === "movie") {
    parts.push(formatYear(candidate.year));
    const runtime = formatRuntime(candidate.runtime);
    if (runtime) parts.push(runtime);
  } else {
    parts.push(formatSeriesYears(candidate));
    const seasons = formatSeasons(candidate.seasons);
    if (seasons) parts.push(seasons);
  }
  if (candidate.genreNames.length) parts.push(candidate.genreNames.slice(0, 3).join(" · "));
  return parts.join(" · ");
}

/** Durée d'épisode lisible : "≈ 27 min / épisode" */
export function formatEpisodeRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  return `≈ ${Math.round(minutes)} min / épisode`;
}
