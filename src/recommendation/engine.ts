/**
 * Moteur de recommandation TONIGHT (§32 → §37).
 *
 * Pipeline complet :
 *   1. construction d'un pool de candidats auprès de la source (TMDB ou démo) ;
 *   2. exclusion des œuvres déjà vues / refusées / proposées dans la session ;
 *   3. application des contraintes DURES ;
 *   4. scoring de chaque candidat restant ;
 *   5. vérification des disponibilités streaming pour le haut du classement ;
 *   6. sélection d'UNE recommandation + alternatives, avec variation pondérée ;
 *   7. génération de l'explication, sans IA externe.
 *
 * Si le pool est trop pauvre, on relâche progressivement les critères et on le
 * dit à l'utilisateur (§37).
 */

import { getCatalog } from "@/services/catalog";
import type { CatalogMode } from "@/services/catalog/types";
import type {
  Candidate,
  RecommendResponse,
  RecommendationContext,
  ScoredCandidate,
  TonightSearchPreferences,
} from "@/types/tonight";
import { RECOMMENDATION_COUNT } from "@/utils/constants";
import { buildExplanation } from "./explain";
import { applyHardFilters, excludeSession } from "./filters";
import {
  scoreCandidate,
  selectRecommendations,
  temperatureFor,
  weightsFor,
} from "./ranking";
import { buildAttempts, isFullyRelaxed, type Attempt } from "./relaxation";

/** Nombre minimal de candidats pour considérer une tentative comme concluante. */
const MIN_RESULTS = 5;

export interface RecommendOptions {
  preferences: TonightSearchPreferences;
  context: RecommendationContext;
  count?: number;
  seed?: number;
  random?: () => number;
}

interface AttemptOutcome {
  attempt: Attempt;
  scored: ScoredCandidate[];
  poolSize: number;
}

/** Identifiants « déjà vus » ou « déjà refusés » à ne plus proposer. */
function blockedIds(context: RecommendationContext): string[] {
  const profile = context.profile;
  if (!profile) return [...context.sessionExcluded];
  return [
    ...context.sessionExcluded,
    ...profile.watchedIds,
    ...profile.refusedIds,
    ...profile.favoriteIds.filter((id) => profile.watchedIds.includes(id)),
  ];
}

async function runAttempt(attempt: Attempt, options: RecommendOptions): Promise<AttemptOutcome | null> {
  const catalog = getCatalog();
  const { preferences, context } = options;
  const mediaTypes: Array<"movie" | "tv"> =
    attempt.preferences.mediaType === "any" ? ["movie", "tv"] : [attempt.preferences.mediaType];

  const pools = await Promise.all(
    mediaTypes.map((mediaType) =>
      catalog
        .buildPool({
          mediaType,
          prefs: attempt.preferences,
          soft: attempt.soft,
          skipProviders: attempt.skipProviders,
        })
        .catch(() => [] as Candidate[]),
    ),
  );

  const merged = new Map<string, Candidate>();
  for (const pool of pools) {
    for (const candidate of pool) {
      merged.set(`${candidate.mediaType}:${candidate.id}`, candidate);
    }
  }

  const poolSize = merged.size;
  if (poolSize === 0) return null;

  const blocked = new Set(blockedIds(context));
  const available = [...merged.values()].filter(
    (candidate) => !blocked.has(`${candidate.mediaType}:${candidate.id}`),
  );

  const filtered = applyHardFilters(available, attempt.preferences);
  if (filtered.passed.length === 0) {
    return { attempt, scored: [], poolSize };
  }

  const scored = filtered.passed.map((candidate) =>
    scoreCandidate(
      candidate,
      attempt.preferences,
      context,
      weightsFor(candidate.mediaType, attempt.preferences, context),
    ),
  );

  return { attempt, scored, poolSize };
}

function toResponse(outcome: AttemptOutcome | null, options: RecommendOptions): RecommendResponse {
  const { preferences, count = RECOMMENDATION_COUNT, seed = 0, random } = options;
  if (!outcome || outcome.scored.length === 0) {
    return {
      top: null,
      alternatives: [],
      relaxations: outcome?.attempt.relaxations ?? [],
      fullyRelaxed: outcome ? isFullyRelaxed(outcome.attempt, preferences) : false,
      appliedPreferences: outcome?.attempt.preferences ?? preferences,
      poolSize: outcome?.poolSize ?? 0,
      empty: true,
    };
  }

  const selected = selectRecommendations(outcome.scored, {
    count: Math.min(count, outcome.scored.length),
    temperature: temperatureFor(preferences),
    seed,
    random,
  });

  const withExplanations = selected.map((item) => ({
    ...item,
    explanation: buildExplanation(item, outcome.attempt.preferences, outcome.attempt.relaxations.map((r) => r.message)),
  }));

  return {
    top: withExplanations[0] ?? null,
    alternatives: withExplanations.slice(1),
    relaxations: outcome.attempt.relaxations,
    fullyRelaxed: isFullyRelaxed(outcome.attempt, preferences),
    appliedPreferences: outcome.attempt.preferences,
    poolSize: outcome.poolSize,
    empty: withExplanations.length === 0,
  };
}

/**
 * Point d'entrée du moteur.
 * Renvoie UNE recommandation principale, des alternatives, et la trace des
 * assouplissements appliqués.
 */
export async function recommend(options: RecommendOptions): Promise<RecommendResponse> {
  const catalog = getCatalog();
  const attempts = buildAttempts(options.preferences);

  let best: AttemptOutcome | null = null;

  for (const attempt of attempts) {
    const outcome = await runAttempt(attempt, options);
    if (!outcome) continue;

    if (outcome.scored.length >= MIN_RESULTS) {
      return toResponse(outcome, options);
    }
    if (!best || outcome.scored.length > best.scored.length) best = outcome;
  }

  // Aucune tentative n'a atteint le seuil : on renvoie la meilleure trouvée,
  // même pauvre, plutôt qu'un écran vide (§67).
  return toResponse(best, options);
}

/** Moteur « Un autre » : mêmes critères, œuvres déjà proposées exclues (§42). */
export async function recommendAnother(options: RecommendOptions): Promise<RecommendResponse> {
  return recommend(options);
}
