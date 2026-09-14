/**
 * Poids, scoring et sélection (§33, §36).
 *
 * Deux responsabilités :
 *  1. décider quelles dimensions comptent RÉELLEMENT pour cette recherche
 *     (une dimension non demandée ne doit pas diluer le score) ;
 *  2. sélectionner la recommandation sans jamais sacrifier la pertinence au
 *     hasard : on garde le haut du classement et on applique une variation
 *     pondérée.
 */

import type {
  Candidate,
  MediaType,
  RecommendationContext,
  ScoredCandidate,
  TonightSearchPreferences,
} from "@/types/tonight";
import { stableHash } from "@/utils/text";
import { calculateMovieTonightScore, type WeightMap } from "./movieScore";
import { calculateSeriesTonightScore } from "./seriesScore";

/** Poids de base par type de média, avant désactivation des dimensions inactives. */
const MOVIE_WEIGHTS: WeightMap = {
  moodMatch: 0.25,
  genreMatch: 0.18,
  qualityScore: 0.17,
  discoveryScore: 0.13,
  runtimeMatch: 0.1,
  providerMatch: 0.09,
  eraMatch: 0.05,
  personalTaste: 0.03,
};

const SERIES_WEIGHTS: WeightMap = {
  moodMatch: 0.24,
  genreMatch: 0.16,
  qualityScore: 0.15,
  discoveryScore: 0.12,
  runtimeMatch: 0.11,
  providerMatch: 0.08,
  eraMatch: 0.04,
  personalTaste: 0.04,
};

/**
 * Poids effectifs : une dimension dont l'utilisateur n'a rien dit est mise à
 * zéro (ou minimisée) pour ne pas écraser les dimensions qui comptent.
 */
export function weightsFor(
  mediaType: MediaType,
  preferences: TonightSearchPreferences,
  context: RecommendationContext,
): WeightMap {
  const base = { ...(mediaType === "movie" ? MOVIE_WEIGHTS : SERIES_WEIGHTS) };
  const hasGenreSignal =
    preferences.genres.length > 0 ||
    preferences.excludedGenres.length > 0 ||
    preferences.excludedGenreCombos.length > 0 ||
    preferences.hardExcludedGenres.length > 0;

  if (!preferences.moods.length && !preferences.excludedMoods.length) base.moodMatch = 0;
  else if (!preferences.moods.length) base.moodMatch = (base.moodMatch ?? 0) * 0.35;

  if (!hasGenreSignal) base.genreMatch = 0.05;

  if (preferences.discoveryLevel) {
    // « Un très bon film que je ne connais probablement pas » : le niveau de
    // découverte n'est pas un réglage secondaire, c'est LA demande. Il doit donc
    // peser plus lourd que la qualité brute.
    // Sans cela, le pré-classement des nœuds restait mené par la qualité et
    // TONIGHT proposait The Dark Knight comme « pépite peu connue ».
    base.discoveryScore = mediaType === "movie" ? 0.24 : 0.22;
    base.qualityScore = (base.qualityScore ?? 0) * 0.7;
  } else {
    base.discoveryScore = 0.05;
  }

  const hasRuntimeSignal =
    mediaType === "movie"
      ? preferences.maxRuntime !== null ||
        preferences.minRuntime !== null ||
        preferences.softMaxRuntime !== null ||
        preferences.softMinRuntime !== null
      : preferences.targetEpisodeRuntime !== null;
  if (!hasRuntimeSignal) base.runtimeMatch = (base.runtimeMatch ?? 0.1) * 0.5;

  if (!preferences.providers.length) base.providerMatch = 0;

  const hasEraSignal =
    preferences.minYear !== null ||
    preferences.maxYear !== null ||
    preferences.softRecent ||
    preferences.softOld;
  if (!hasEraSignal) base.eraMatch = 0;

  if (!context.profile) base.personalTaste = 0;

  return base;
}

/** Score complet d'un candidat (score interne + explication des dimensions). */
export function scoreCandidate(
  candidate: Candidate,
  preferences: TonightSearchPreferences,
  context: RecommendationContext,
  weights: WeightMap,
): ScoredCandidate {
  const outcome =
    candidate.mediaType === "movie"
      ? calculateMovieTonightScore(candidate, preferences, context, weights)
      : calculateSeriesTonightScore(candidate, preferences, context, weights);

  return {
    candidate,
    score: outcome.score,
    // « 92 % MATCH » : arrondi volontairement généreux mais borné à 99 %.
    matchPercent: Math.max(35, Math.min(99, Math.round(outcome.score * 100))),
    components: outcome.components,
    reasons: outcome.reasons,
    explanation: "",
  };
}

export interface SelectionOptions {
  count: number;
  /** Température de la variation pondérée (0 = strictement le meilleur). */
  temperature?: number;
  /** Graine : rend la sélection reproductible pour les tests. */
  seed?: number;
  random?: () => number;
}

/**
 * Sélection avec VARIÉTÉ (§36).
 *
 * Règle d'or : l'aléatoire ne s'éloigne JAMAIS du haut du classement.
 *
 * - on ne considère que le haut du classement (top 20) ;
 * - on définit une BANDE DE PERTINENCE autour du meilleur score, dont la
 *   largeur suit l'ouverture de la demande : une envie précise (« série
 *   terminée, 30 min, feel-good ») resserre la bande, un « surprends-moi »
 *   l'élargit ;
 * - dans cette bande (et seulement dedans), les meilleurs restent fortement
 *   favorisés (softmax) et une petite perturbation déterministe évite de
 *   ressortir exactement la même œuvre pour les mêmes critères ;
 * - les alternatives suivantes complètent la liste par ordre de score, sans
 *   hasard : on ne dégrade jamais la pertinence pour remplir un écran.
 *
 * COHÉRENCE D'AFFICHAGE : le tirage mélange l'ordre des candidats de la bande.
 * On retrie donc explicitement les alternatives par score décroissant, et on
 * n'affiche jamais une alternative mieux notée que la recommandation
 * principale, sinon l'écran montre « 85 % MATCH » juste au-dessus d'une
 * proposition à 88 %, ce qui donne l'impression que TONIGHT s'est trompé. Les
 * candidats écartés pour cette raison restent éligibles au tirage suivant
 * (« Un autre »), donc la variété de §36 est intacte.
 */
export function selectRecommendations(
  scored: ScoredCandidate[],
  options: SelectionOptions,
): ScoredCandidate[] {
  const { count, temperature = 0.06, seed = 0, random = Math.random } = options;
  if (scored.length === 0) return [];

  const pool = [...scored].sort((a, b) => b.score - a.score).slice(0, 20);
  const maxScore = pool[0].score;

  const band = Math.max(0.03, temperature * 0.6);
  const relevant = pool.filter((item) => maxScore - item.score <= band);
  const rest = pool.filter((item) => !relevant.includes(item));

  const sampled = weightedSample(relevant, Math.min(count, relevant.length), {
    temperature,
    seed,
    random,
    maxScore,
  });

  const primary = sampled[0];
  if (!primary) return [];

  const alternatives = [...sampled.slice(1), ...rest]
    .filter((item) => item !== primary && item.score <= primary.score)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, count - 1));

  return [primary, ...alternatives];
}

interface SampleOptions {
  temperature: number;
  seed: number;
  random: () => number;
  maxScore: number;
}

/** Tirage pondéré (softmax + bruit déterministe) à l'intérieur d'un ensemble. */
function weightedSample(
  items: ScoredCandidate[],
  count: number,
  { temperature, seed, random, maxScore }: SampleOptions,
): ScoredCandidate[] {
  const weighted = items.map((item) => {
    const noise = ((stableHash(`${item.candidate.id}:${item.candidate.mediaType}:${seed}`) % 1000) / 1000 - 0.5) * 0.045;
    const weight = Math.exp((item.score - maxScore) / Math.max(temperature, 0.01));
    return { item, weight: Math.max(weight * (1 + noise), 0.0005) };
  });

  const selected: ScoredCandidate[] = [];
  const remaining = [...weighted];

  while (selected.length < count && remaining.length) {
    const total = remaining.reduce((sum, entry) => sum + entry.weight, 0);
    let threshold = random() * total;
    let index = 0;
    for (let i = 0; i < remaining.length; i += 1) {
      threshold -= remaining[i].weight;
      if (threshold <= 0) {
        index = i;
        break;
      }
    }
    selected.push(remaining[index].item);
    remaining.splice(index, 1);
  }

  return selected;
}

/** Température adaptée au niveau de découverte : « surprends-moi » varie plus. */
export function temperatureFor(preferences: TonightSearchPreferences): number {
  switch (preferences.discoveryLevel) {
    case "surprise":
      return 0.16;
    case "hidden_gem":
    case "obscure":
      return 0.1;
    case "mainstream":
      return 0.04;
    default:
      return 0.07;
  }
}
