/**
 * Score de durée (§18, §25).
 *
 * Les contraintes dures (maxRuntime) sont déjà appliquées par les filtres ;
 * ici on mesure la QUALITÉ de l'adéquation :
 *   - « j'ai 1h30 » → un film de 1h25 est meilleur qu'un film de 2h30 ;
 *   - « pas trop long » → préférence souple autour de ~110 min ;
 *   - durée d'épisode → on raisonne en fourchette, pas en valeur exacte.
 */

import type { Candidate, TonightSearchPreferences } from "@/types/tonight";
import { clamp01 } from "./qualityScore";

/** Durée de référence « confortable » si l'utilisateur n'exprime rien. */
const COMFORT_MIN = 88;
const COMFORT_MAX = 148;

export function calculateRuntimeScore(
  candidate: Candidate,
  preferences: TonightSearchPreferences,
): { value: number; note: string | null } {
  const runtime = candidate.runtime;

  // Durée inconnue : on ne pénalise pas, mais on ne récompense pas (§67).
  if (!runtime || runtime <= 0) {
    return { value: 0.55, note: null };
  }

  const max = preferences.maxRuntime;
  const min = preferences.minRuntime;
  const softMax = preferences.softMaxRuntime;
  const softMin = preferences.softMinRuntime;

  if (max !== null) {
    // Sous la limite : d'autant mieux qu'on n'est pas tout près du plafond.
    const headroom = (max - runtime) / Math.max(max, 1);
    const value = runtime <= max ? 0.72 + clamp01(headroom) * 0.28 : 0.15;
    return {
      value: clamp01(value),
      note: runtime <= max ? `tient dans ${max} min` : null,
    };
  }

  if (min !== null) {
    const overflow = (runtime - min) / Math.max(min, 1);
    return { value: clamp01(0.7 + Math.min(overflow, 0.3)), note: null };
  }

  if (softMax !== null) {
    const overshoot = runtime - softMax;
    if (overshoot <= 0) return { value: 1, note: "court, comme demandé" };
    return { value: clamp01(1 - overshoot / 45), note: null };
  }

  if (softMin !== null) {
    const undershoot = softMin - runtime;
    if (undershoot <= 0) return { value: 1, note: null };
    return { value: clamp01(1 - undershoot / 45), note: null };
  }

  // Aucune consigne : léger bonus aux durées « confortables ».
  if (runtime >= COMFORT_MIN && runtime <= COMFORT_MAX) return { value: 0.78, note: null };
  if (runtime < 75) return { value: 0.6, note: null };
  if (runtime > 170) return { value: 0.5, note: null };
  return { value: 0.68, note: null };
}

/** Score de durée d'épisode pour une série, en fourchette. */
export function calculateEpisodeRuntimeScore(
  candidate: Candidate,
  preferences: TonightSearchPreferences,
): { value: number; note: string | null } {
  const episodeRuntime = candidate.episodeRuntime;
  const target = preferences.targetEpisodeRuntime;

  if (!target) {
    // Sans consigne : on favorit les épisodes digestes (25-50 min).
    if (!episodeRuntime) return { value: 0.6, note: null };
    if (episodeRuntime <= 50) return { value: 0.8, note: null };
    if (episodeRuntime <= 62) return { value: 0.7, note: null };
    return { value: 0.55, note: null };
  }

  if (!episodeRuntime) return { value: 0.5, note: null };

  const tolerance = preferences.episodeRuntimeTolerance || 12;
  const delta = Math.abs(episodeRuntime - target);
  if (delta <= tolerance * 0.5) return { value: 1, note: `épisodes de ${Math.round(episodeRuntime)} min` };
  if (delta <= tolerance) return { value: 0.85, note: `épisodes de ${Math.round(episodeRuntime)} min` };
  return { value: clamp01(0.85 - (delta - tolerance) / 30), note: null };
}

/** Score du nombre de saisons / de l'engagement (séries). */
export function calculateSeasonsScore(
  candidate: Candidate,
  preferences: TonightSearchPreferences,
): { value: number; note: string | null } {
  const seasons = candidate.seasons;
  if (!seasons) return { value: 0.55, note: null };

  const { minSeasons, maxSeasons, commitment } = preferences;

  if (maxSeasons !== null && seasons > maxSeasons) return { value: 0.1, note: null };
  if (minSeasons !== null && seasons < minSeasons) return { value: 0.1, note: null };

  if (commitment === "mini") return { value: seasons <= 1 ? 1 : 0.35, note: seasons <= 1 ? "mini-série" : null };
  if (commitment === "small") return { value: seasons <= 2 ? 1 : 0.4, note: seasons <= 2 ? "série courte" : null };
  if (commitment === "long") return { value: seasons >= 4 ? 1 : 0.45, note: seasons >= 4 ? "série longue" : null };
  if (commitment === "medium") return { value: seasons >= 3 && seasons <= 6 ? 1 : 0.6, note: null };

  if (maxSeasons !== null) return { value: 1, note: `${seasons} saison${seasons > 1 ? "s" : ""}` };
  if (minSeasons !== null) return { value: 1, note: null };
  return { value: 0.7, note: null };
}
