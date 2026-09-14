/**
 * Score de qualité (§34).
 *
 * RÈGLE FONDAMENTALE : on ne compare JAMAIS naïvement deux notes TMDB.
 *   Film A : 9.8/10 avec 8 votes   → note non fiable
 *   Film B : 8.2/10 avec 95 000 votes → note très fiable
 *
 * On utilise donc une moyenne bayésienne (la « note lissée »), qui rapproche
 * les films peu votés de la moyenne globale tant que la preuve est faible :
 *
 *     note_lissée = (v / (v + m)) * R  +  (m / (v + m)) * C
 *
 *   R = note moyenne du candidat
 *   v = nombre de votes du candidat
 *   m = nombre de votes « de confiance » (priori prudent, différent films/séries)
 *   C = note moyenne globale du catalogue (constante de référence)
 */

import type { Candidate, QualityPreference } from "@/types/tonight";

/** Priori : nombre de votes nécessaires pour faire moitié confiance à la note. */
const PRIOR_VOTES = { movie: 1200, tv: 800 } as const;
/** Moyenne globale de référence (ordre de grandeur TMDB). */
const GLOBAL_MEAN = { movie: 6.9, tv: 7.4 } as const;
/** Bornes de normalisation des notes lissées. */
const MIN_USEFUL_RATING = 5.4;
const MAX_USEFUL_RATING = 8.9;

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Note lissée (bayésienne) d'un candidat. */
export function bayesianRating(candidate: Pick<Candidate, "voteAverage" | "voteCount" | "mediaType">): number {
  const { movie, tv } = PRIOR_VOTES;
  const priorVotes = candidate.mediaType === "movie" ? movie : tv;
  const globalMean = candidate.mediaType === "movie" ? GLOBAL_MEAN.movie : GLOBAL_MEAN.tv;

  const votes = Math.max(0, candidate.voteCount);
  const rating = candidate.voteAverage > 0 ? candidate.voteAverage : globalMean;

  if (votes === 0) return globalMean - 0.4; // aucun vote : on se méfie
  return (votes / (votes + priorVotes)) * rating + (priorVotes / (votes + priorVotes)) * globalMean;
}

/** 0 → 1 : confiance statistique dans la note (nombre de votes). */
export function calculateQualityConfidence(
  candidate: Pick<Candidate, "voteAverage" | "voteCount" | "mediaType">,
): number {
  const priorVotes = candidate.mediaType === "movie" ? PRIOR_VOTES.movie : PRIOR_VOTES.tv;
  return clamp01(candidate.voteCount / (candidate.voteCount + priorVotes));
}

/** 0 → 1 : qualité lissée et normalisée (le score « brut » de qualité). */
export function calculateQualityScore(
  candidate: Pick<Candidate, "voteAverage" | "voteCount" | "mediaType">,
): number {
  const smoothed = bayesianRating(candidate);
  return clamp01((smoothed - MIN_USEFUL_RATING) / (MAX_USEFUL_RATING - MIN_USEFUL_RATING));
}

/**
 * Qualité pondérée par la tolérance au risque de l'utilisateur (§21).
 *  - `risky`      : on accepte de se tromper, la note pèse peu ;
 *  - `solid`      : comportement neutre ;
 *  - `very_solid` : on privilégie nettement les bonnes notes ;
 *  - `no_risk`    : on exige à la fois une bonne note ET une preuve statistique.
 */
export function qualityPreferenceFit(
  candidate: Pick<Candidate, "voteAverage" | "voteCount" | "mediaType">,
  preference: QualityPreference | null,
): number {
  const quality = calculateQualityScore(candidate);
  const statistical = calculateQualityConfidence(candidate);

  switch (preference) {
    case "risky":
      // Peu de différenciation : on assume le pari.
      return clamp01(0.45 + quality * 0.35);
    case "very_solid":
      // Courbe convexe : seuls les très bons scores ressortent.
      return clamp01(Math.pow(quality, 1.6) * (0.75 + 0.25 * statistical));
    case "no_risk": {
      // Il faut une note élevée (lissée ≥ ~7.0) ET des votes.
      const high = clamp01((bayesianRating(candidate) - 6.8) / 1.8);
      return clamp01(high * (0.55 + 0.45 * statistical));
    }
    case "solid":
    default:
      return quality;
  }
}
