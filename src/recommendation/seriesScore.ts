/**
 * `calculateSeriesTonightScore()`, composition du score d'une SÉRIE (§32, §33).
 *
 * Différences assumées avec les films :
 *  - la durée raisonne sur l'épisode, pas sur l'œuvre entière ;
 *  - le nombre de saisons et l'engagement pèsent lourd ;
 *  - le statut (terminée / en cours / annulée) entre dans le score ;
 *  - la popularité et les notes ont un priori bayésien différent.
 */

import type {
  Candidate,
  RecommendationContext,
  ScoreComponent,
  TonightSearchPreferences,
} from "@/types/tonight";
import { canonicalGenres } from "@/utils/canonical";
import { classifySeriesStatus } from "@/utils/constants";
import { calculateDiscoveryScore } from "./discoveryScore";
import { calculateMoodPenalty, calculateMoodScore } from "./moodScore";
import { calculateHistoryPenalty, calculatePersonalTasteScore, feedbackAdjustment } from "./personalizationScore";
import { calculateEraScore, calculateProviderScore } from "./providerScore";
import { clamp01, qualityPreferenceFit } from "./qualityScore";
import { calculateEpisodeRuntimeScore, calculateSeasonsScore } from "./runtimeScore";
import { applyPenalties, weightedBase, type ScoreOutcome, type WeightMap } from "./movieScore";

/** Adéquation au statut souhaité (terminée, en cours). */
function statusFit(candidate: Candidate, preferences: TonightSearchPreferences): number {
  const kind = classifySeriesStatus(candidate.status);
  switch (preferences.seriesStatus) {
    case "ended":
      // Une série annulée n'a pas de vraie fin : elle n'est pas « terminée » (§26).
      if (kind === "ended") return candidate.status?.toLowerCase().includes("cancel") ? 0.6 : 1;
      if (kind === "canceled") return 0.45;
      return 0.3;
    case "ongoing_ok":
      return kind === "ongoing" ? 0.9 : 0.7;
    default:
      return kind === "ended" ? 0.8 : kind === "ongoing" ? 0.7 : 0.55;
  }
}

export function calculateSeriesTonightScore(
  candidate: Candidate,
  preferences: TonightSearchPreferences,
  context: RecommendationContext,
  weights: WeightMap,
): ScoreOutcome {
  const components: ScoreComponent[] = [];
  const reasons: string[] = [];

  /* --- Mood ------------------------------------------------------------ */
  const mood = calculateMoodScore(candidate, preferences);
  const moodPenalty = calculateMoodPenalty(candidate, preferences);
  components.push({
    key: "moodMatch",
    value: clamp01(mood.value - moodPenalty.value * 0.75),
    weight: weights.moodMatch ?? 0,
    reason: moodPenalty.hit.length ? `pénalité ${moodPenalty.hit.join("/")}` : undefined,
  });

  /* --- Genres ---------------------------------------------------------- */
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
  });

  /* --- Qualité --------------------------------------------------------- */
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

  /* --- Durée d'épisode + saisons + statut ------------------------------ */
  const episode = calculateEpisodeRuntimeScore(candidate, preferences);
  components.push({
    key: "runtimeMatch",
    value: episode.value,
    weight: weights.runtimeMatch ?? 0,
    reason: episode.note ?? undefined,
  });
  if (episode.note) reasons.push(episode.note);

  const seasons = calculateSeasonsScore(candidate, preferences);
  const status = statusFit(candidate, preferences);
  const shapeValue = clamp01(seasons.value * 0.65 + status * 0.35);

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

  /**
   * Le « shape » (saisons + statut) n'est pas un composant pondéré classique :
   * il est déjà couvert par les contraintes dures quand elles existent. On
   * l'injecte ici comme levier de tri secondaire.
   */
  const base = clamp01(weightedBase(components) * 0.88 + shapeValue * 0.12);

  if (mood.matched.length) reasons.unshift(`mood ${mood.matched.join(" + ")}`);
  if (seasons.note) reasons.push(seasons.note);

  return { score: applyPenalties(base, penalties), components, reasons, penalties };
}
