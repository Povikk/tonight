/**
 * `calculateMovieTonightScore()`, composition du score d'un FILM (§32, §33).
 *
 * Le score final est une moyenne pondérée normalisée, puis modulée par des
 * pénalités non linéaires (moods refusés, historique, feedback utilisateur).
 * On ne fait JAMAIS `films.filter(...)[random]`.
 */

import type {
  Candidate,
  RecommendationContext,
  ScoreComponent,
  TonightSearchPreferences,
} from "@/types/tonight";
import { canonicalGenres } from "@/utils/canonical";
import { calculateDiscoveryScore } from "./discoveryScore";
import { calculateMoodPenalty, calculateMoodScore } from "./moodScore";
import { calculateHistoryPenalty, calculatePersonalTasteScore, feedbackAdjustment } from "./personalizationScore";
import { calculateEraScore, calculateProviderScore } from "./providerScore";
import { clamp01, qualityPreferenceFit } from "./qualityScore";
import { calculateRuntimeScore } from "./runtimeScore";

export type WeightMap = Partial<Record<ScoreComponent["key"], number>>;

export interface ScoreOutcome {
  score: number;
  components: ScoreComponent[];
  reasons: string[];
  penalties: { history: number; feedback: number };
}

/** Applique les poids et renvoie la base normalisée. */
export function weightedBase(components: ScoreComponent[]): number {
  let weightedSum = 0;
  let weightSum = 0;
  for (const component of components) {
    if (component.weight <= 0) continue;
    weightedSum += component.value * component.weight;
    weightSum += component.weight;
  }
  return weightSum > 0 ? weightedSum / weightSum : 0.5;
}

/**
 * Applique les pénalités d'historique et de feedback.
 * Elles sont multiplicatives car elles expriment un « non » catégorique :
 * une œuvre déjà refusée ne doit pas remonter parce qu'elle matche bien.
 */
export function applyPenalties(
  base: number,
  penalties: { history: number; feedback: number },
): number {
  return clamp01(base * (1 - 0.55 * penalties.history) * (1 - 0.4 * penalties.feedback));
}

export function calculateMovieTonightScore(
  candidate: Candidate,
  preferences: TonightSearchPreferences,
  context: RecommendationContext,
  weights: WeightMap,
): ScoreOutcome {
  const components: ScoreComponent[] = [];
  const reasons: string[] = [];

  /* --- Mood (signal principal) ---------------------------------------- */
  const mood = calculateMoodScore(candidate, preferences);
  const moodPenalty = calculateMoodPenalty(candidate, preferences);
  components.push({
    key: "moodMatch",
    value: clamp01(mood.value - moodPenalty.value * 0.75),
    weight: weights.moodMatch ?? 0,
    reason: moodPenalty.hit.length ? `pénalité ${moodPenalty.hit.join("/")}` : undefined,
  });

  /* --- Genres --------------------------------------------------------- */
  const genres = canonicalGenres(candidate.genres);
  let genreValue = preferences.genres.length ? 0.25 : 0.6;
  if (preferences.genres.length) {
    const overlap = preferences.genres.filter((genre) => genres.includes(genre)).length;
    if (overlap) genreValue = clamp01(0.7 + 0.3 * (overlap / preferences.genres.length));
  }
  const softExcluded = preferences.excludedGenres.some((genre) => genres.includes(genre)) ? 0.45 : 0;
  const combo = preferences.excludedGenreCombos.some(([a, b]) => genres.includes(a) && genres.includes(b)) ? 0.5 : 0;
  components.push({
    key: "genreMatch",
    value: clamp01(genreValue - softExcluded - combo),
    weight: weights.genreMatch ?? 0,
    reason: combo ? "combo de genres non voulu" : undefined,
  });

  /* --- Qualité lissée -------------------------------------------------- */
  components.push({
    key: "qualityScore",
    value: qualityPreferenceFit(candidate, preferences.qualityPreference),
    weight: weights.qualityScore ?? 0,
  });

  /* --- Découverte ------------------------------------------------------ */
  components.push({
    key: "discoveryScore",
    value: calculateDiscoveryScore(candidate, preferences.discoveryLevel),
    weight: weights.discoveryScore ?? 0,
  });

  /* --- Durée ----------------------------------------------------------- */
  const runtime = calculateRuntimeScore(candidate, preferences);
  components.push({
    key: "runtimeMatch",
    value: runtime.value,
    weight: weights.runtimeMatch ?? 0,
    reason: runtime.note ?? undefined,
  });

  /* --- Plateformes ----------------------------------------------------- */
  const provider = calculateProviderScore(candidate, preferences);
  components.push({
    key: "providerMatch",
    value: provider.value,
    weight: weights.providerMatch ?? 0,
    reason: provider.matched ? `sur ${provider.matched.name}` : undefined,
  });
  if (provider.matched) reasons.push(`dispo sur ${provider.matched.name}`);

  /* --- Époque ---------------------------------------------------------- */
  const era = calculateEraScore(candidate, preferences);
  components.push({
    key: "eraMatch",
    value: era.value,
    weight: weights.eraMatch ?? 0,
    reason: era.note ?? undefined,
  });

  /* --- Goûts personnels ------------------------------------------------ */
  const taste = calculatePersonalTasteScore(candidate, context);
  components.push({
    key: "personalTaste",
    value: taste.value,
    weight: weights.personalTaste ?? 0,
    reason: taste.note ?? undefined,
  });

  /* --- Pénalités ------------------------------------------------------- */
  const history = calculateHistoryPenalty(candidate, context);
  const feedback = feedbackAdjustment(candidate, context);
  const penalties = { history: history.value, feedback: feedback.value };
  if (history.reason) reasons.push(history.reason);

  const base = weightedBase(components);

  // Raisons lisibles : uniquement les dimensions réellement responsables du score.
  if (mood.matched.length) reasons.unshift(`mood ${mood.matched.join(" + ")}`);
  if (runtime.note) reasons.push(runtime.note);
  if (combo) reasons.push("ce n'est pas la combinaison que tu voulais éviter");

  return { score: applyPenalties(base, penalties), components, reasons, penalties };
}
