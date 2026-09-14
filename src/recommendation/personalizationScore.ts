/**
 * Personnalisation (§33, §44).
 *
 * Aucune magie : ce sont des POIDS ÉVOLUTIFS construits localement à partir des
 * favoris, des contenus vus, des refus et du feedback. Le profil est calculé
 * côté client et transmis au moteur, il n'est jamais stocké sur un serveur.
 */

import type { Candidate, RecommendationContext, RefusalReason } from "@/types/tonight";
import { canonicalGenres } from "@/utils/canonical";
import { clamp01 } from "./qualityScore";

/** Score des goûts personnels : 0.5 = neutre. */
export function calculatePersonalTasteScore(
  candidate: Candidate,
  context: RecommendationContext,
): { value: number; note: string | null } {
  const profile = context.profile;
  if (!profile) return { value: 0.5, note: null };

  const genres = canonicalGenres(candidate.genres);
  let affinity = 0;
  let known = 0;
  for (const genre of genres) {
    const weight = profile.genreWeights[genre];
    if (typeof weight === "number") {
      affinity += weight;
      known += 1;
    }
  }
  const genreScore = known ? clamp01(0.5 + affinity / (known * 2)) : 0.5;

  // Époque préférée
  let eraScore = 0.5;
  if (profile.preferredEra && candidate.year) {
    const { min, max } = profile.preferredEra;
    eraScore = candidate.year >= min && candidate.year <= max ? 0.8 : 0.45;
  }

  // Durée habituelle (films) ou nombre de saisons habituel (séries)
  let shapeScore = 0.5;
  if (candidate.mediaType === "movie" && profile.averageRuntime && candidate.runtime) {
    const delta = Math.abs(candidate.runtime - profile.averageRuntime);
    shapeScore = clamp01(1 - delta / 60);
  } else if (candidate.mediaType === "tv" && profile.preferredSeasons && candidate.seasons) {
    const delta = Math.abs(candidate.seasons - profile.preferredSeasons);
    shapeScore = clamp01(1 - delta / 5);
  }

  // Plateformes habituelles
  const providerScore = candidate.providers.some((provider) => profile.providerIds.includes(provider.providerId))
    ? 0.85
    : 0.5;

  const value = clamp01(genreScore * 0.45 + eraScore * 0.15 + shapeScore * 0.2 + providerScore * 0.2);

  let note: string | null = null;
  if (genreScore > 0.72) note = "dans tes habitudes";
  else if (genreScore < 0.35) note = "sort de tes habitudes";
  return { value, note };
}

/** Pénalité issue des contenus déjà vus / refusés. */
export function calculateHistoryPenalty(
  candidate: Candidate,
  context: RecommendationContext,
): { value: number; reason: string | null } {
  const profile = context.profile;
  if (!profile) return { value: 0, reason: null };
  const key = `${candidate.mediaType}:${candidate.id}`;

  if (profile.watchedIds.includes(key)) {
    return { value: 0.75, reason: "déjà vu" };
  }
  if (profile.refusedIds.includes(key)) {
    return { value: 0.9, reason: "déjà refusé" };
  }
  // Genres souvent refusés : pénalité douce.
  const refusedCount = canonicalGenres(candidate.genres).reduce(
    (sum, genre) => sum + (profile.refusedGenreCounts[genre] ?? 0),
    0,
  );
  if (refusedCount >= 3) {
    return { value: clamp01(Math.min(refusedCount / 12, 0.4)), reason: "genre souvent refusé" };
  }
  return { value: 0, reason: null };
}

/**
 * Effet immédiat du dernier refus (« Pourquoi pas celui-là ? », §43).
 * Chaque raison ajuste les prochaines propositions.
 */
export function feedbackAdjustment(
  candidate: Candidate,
  context: RecommendationContext,
): { value: number; notes: string[] } {
  if (!context.feedback.length) return { value: 0, notes: [] };

  const now = Date.now();
  /** Les feedbacks récents pèsent plus lourd (décroissance sur 30 minutes). */
  const recency = (iso: string) => {
    const age = now - new Date(iso).getTime();
    if (Number.isNaN(age)) return 0.5;
    return clamp01(1 - age / (30 * 60 * 1000)) * 0.8 + 0.2;
  };

  let penalty = 0;
  const notes: string[] = [];
  const year = candidate.year ?? 0;

  for (const feedback of context.feedback) {
    const weight = recency(feedback.at);
    for (const reason of feedback.reasons) {
      const applied = applyReason(reason, candidate, year);
      if (applied) {
        penalty += applied * weight;
        notes.push(reasonLabel(reason));
      }
    }
  }

  return { value: clamp01(penalty / Math.max(1, context.feedback.length)), notes: [...new Set(notes)] };
}

function applyReason(reason: RefusalReason, candidate: Candidate, year: number): number {
  switch (reason) {
    case "too_old":
      return year && year < 2005 ? 0.5 : 0;
    case "too_recent":
      return year && year > 2016 ? 0.4 : 0;
    case "too_long":
      return (candidate.runtime ?? 0) > 130 ? 0.5 : 0;
    case "too_serious":
      return candidate.genres.includes(18) && !candidate.genres.includes(35) ? 0.4 : 0;
    case "too_light":
      return candidate.genres.includes(35) || candidate.genres.includes(10751) ? 0.35 : 0;
    case "too_known":
      return candidate.popularity > 40 || candidate.voteCount > 12_000 ? 0.45 : 0;
    case "not_known_enough":
      return candidate.popularity < 12 ? 0.4 : 0;
    case "wrong_mood":
      return 0.15; // tous les candidats un peu, on change surtout via le tri
    case "wrong_genre":
      return 0.2;
    case "already_seen":
      return 0.8;
    case "not_available":
      return 0.3;
    default:
      return 0;
  }
}

/** Libellé humain d'une raison de refus. */
export function reasonLabel(reason: RefusalReason): string {
  const labels: Record<RefusalReason, string> = {
    too_old: "trop vieux",
    too_recent: "trop récent",
    too_long: "trop long",
    too_serious: "trop sérieux",
    too_light: "trop léger",
    too_known: "trop connu",
    not_known_enough: "pas assez connu",
    wrong_mood: "pas le mood",
    wrong_genre: "pas le genre",
    already_seen: "déjà vu",
    not_available: "pas dispo chez toi",
  };
  return labels[reason];
}

/** Toutes les raisons proposées dans l'UI « Pourquoi pas celui-là ? ». */
export const REFUSAL_OPTIONS: Array<{ reason: RefusalReason; label: string; emoji: string }> = [
  { reason: "too_old", label: "Trop vieux", emoji: "📼" },
  { reason: "too_recent", label: "Trop récent", emoji: "🆕" },
  { reason: "too_long", label: "Trop long", emoji: "⏱️" },
  { reason: "too_serious", label: "Trop sérieux", emoji: "🎭" },
  { reason: "too_light", label: "Trop léger", emoji: "🪶" },
  { reason: "too_known", label: "Trop connu", emoji: "🏆" },
  { reason: "not_known_enough", label: "Pas assez connu", emoji: "💎" },
  { reason: "wrong_mood", label: "Pas le mood", emoji: "🎚️" },
  { reason: "wrong_genre", label: "Pas le genre que je voulais", emoji: "🎯" },
  { reason: "already_seen", label: "Déjà vu", emoji: "👁️" },
  { reason: "not_available", label: "Pas disponible chez moi", emoji: "📡" },
];
