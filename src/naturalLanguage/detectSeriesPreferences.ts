/**
 * Détection des préférences propres aux séries :
 * nombre de saisons, statut (terminée / en cours), engagement, durée d'épisode.
 *
 * « une petite série feel-good terminée avec des épisodes d'environ 30 minutes »
 * doit produire : maxSeasons ≈ 2, status = ended (souple), episodeRuntime = 30
 * avec une tolérance.
 */

import { NEGATIVE_MOOD_IDS } from "@/data/moods";
import {
  CANCELED_PHRASES,
  ENDED_PHRASES,
  EPISODE_SHORT_PHRASES,
  LONG_SERIES_PHRASES,
  MEDIUM_SERIES_PHRASES,
  MINI_SERIES_PHRASES,
  ONGOING_PHRASES,
  SMALL_SERIES_PHRASES,
} from "./dictionaries";
import { extractDurations } from "./detectRuntime";
import { findPhrase, isEmphatic, isTempered, negationState, selectNonOverlapping } from "./normalizeText";
import type { Detection, TextContext } from "./types";

export interface SeriesDetection {
  minSeasons: number | null;
  maxSeasons: number | null;
  status: "ended" | "ongoing_ok" | "any" | null;
  commitment: "mini" | "small" | "medium" | "long" | "any" | null;
  episodeRuntime: number | null;
  episodeTolerance: number;
  /** Le statut « terminée » est-il exigé strictement ? */
  statusIsHard: boolean;
}

const SEASON_NUMBER = "\\d{1,2}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze|quinze|vingt";

const WORD_TO_NUMBER: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  douze: 12,
  quinze: 15,
  vingt: 20,
};

function toNumber(raw: string): number | null {
  const value = Number.parseInt(raw, 10);
  if (Number.isFinite(value)) return value;
  return WORD_TO_NUMBER[raw] ?? null;
}

export function detectSeriesPreferences(context: TextContext): Detection<SeriesDetection> {
  const value: SeriesDetection = {
    minSeasons: null,
    maxSeasons: null,
    status: null,
    commitment: null,
    episodeRuntime: null,
    episodeTolerance: 12,
    statusIsHard: false,
  };
  const evidence: string[] = [];
  let explicit = false;
  const text = context.normalized;

  const raiseMax = (limit: number) => {
    value.maxSeasons = value.maxSeasons === null ? limit : Math.min(value.maxSeasons, limit);
  };
  const raiseMin = (limit: number) => {
    value.minSeasons = value.minSeasons === null ? limit : Math.max(value.minSeasons, limit);
  };

  /* --- 1. Bornes strictes : « maximum 3 saisons » ---------------------- */

  const maxPattern = new RegExp(
    `\\b(?:maximum|max|au plus|pas plus de|moins de|jusqu'a|jusqu'à|jusqu a)\\s*(${SEASON_NUMBER})\\s*saisons?\\b`,
    "g",
  );
  let match = maxPattern.exec(text);
  while (match) {
    const number = toNumber(match[1]);
    if (number) {
      raiseMax(number);
      explicit = true;
      evidence.push(match[0]);
    }
    match = maxPattern.exec(text);
  }

  const maxSuffix = new RegExp(`\\b(${SEASON_NUMBER})\\s*saisons?\\s*(?:maximum|max|au plus)\\b`, "g");
  match = maxSuffix.exec(text);
  while (match) {
    const number = toNumber(match[1]);
    if (number) {
      raiseMax(number);
      explicit = true;
      evidence.push(match[0]);
    }
    match = maxSuffix.exec(text);
  }

  const minPattern = new RegExp(
    `\\b(?:au moins|minimum|plus de|a partir de|à partir de)\\s*(${SEASON_NUMBER})\\s*saisons?\\b`,
    "g",
  );
  match = minPattern.exec(text);
  while (match) {
    const number = toNumber(match[1]);
    if (number) {
      raiseMin(number);
      explicit = true;
      evidence.push(match[0]);
    }
    match = minPattern.exec(text);
  }

  // « entre 2 et 4 saisons », « 1-2 saisons », « 2 à 3 saisons »
  const rangePattern = new RegExp(
    `\\b(?:entre\\s+)?(${SEASON_NUMBER})\\s*(?:-|a|à|et)\\s*(${SEASON_NUMBER})\\s*saisons?\\b`,
    "g",
  );
  match = rangePattern.exec(text);
  while (match) {
    const from = toNumber(match[1]);
    const to = toNumber(match[2]);
    if (from && to) {
      raiseMin(Math.min(from, to));
      raiseMax(Math.max(from, to));
      explicit = true;
      evidence.push(match[0]);
    }
    match = rangePattern.exec(text);
  }

  /* --- 2. Engagement (« petite série », « mini-série »…) ---------------- */

  const check = (phrases: string[], handler: (matched: string) => void) => {
    const matches = selectNonOverlapping(phrases.flatMap((phrase) => findPhrase(context, phrase)));
    for (const phraseMatch of matches) {
      const state = negationState(phraseMatch);
      if (state === "negated" || state === "neutralized") continue;
      // « 3 saisons maximum » est une borne explicite, pas un engagement moyen.
      const surrounded = `${phraseMatch.prefix} ${phraseMatch.suffix}`;
      if (/\b(maximum|max|au plus|pas plus de|moins de)\b/.test(surrounded)) continue;
      handler(phraseMatch.phrase);
      evidence.push(phraseMatch.phrase);
    }
  };

  check(MINI_SERIES_PHRASES, () => {
    value.commitment = "mini";
    raiseMax(1);
    explicit = true;
  });
  check(SMALL_SERIES_PHRASES, () => {
    value.commitment = value.commitment ?? "small";
    raiseMax(2);
    explicit = true;
  });
  check(MEDIUM_SERIES_PHRASES, () => {
    value.commitment = value.commitment ?? "medium";
    raiseMin(3);
    raiseMax(5);
  });
  check(LONG_SERIES_PHRASES, () => {
    value.commitment = value.commitment ?? "long";
    raiseMin(3);
  });

  // « pas dix saisons », « pas beaucoup de saisons » → petite série.
  const fewSeasonsPhrases = ["pas dix saisons", "pas beaucoup de saisons", "peu de saisons", "un truc pas trop long", "pas trop de saisons"];
  const fewMatches = selectNonOverlapping(fewSeasonsPhrases.flatMap((phrase) => findPhrase(context, phrase)));
  if (fewMatches.length) {
    raiseMax(3);
    value.commitment = value.commitment ?? "small";
    explicit = true;
  }

  /* --- 3. Statut ------------------------------------------------------- */

  const endedMatches = selectNonOverlapping(ENDED_PHRASES.flatMap((phrase) => findPhrase(context, phrase)));
  for (const phraseMatch of endedMatches) {
    const state = negationState(phraseMatch);
    if (state === "negated") {
      value.status = "ongoing_ok";
      evidence.push(`pas ${phraseMatch.phrase}`);
      continue;
    }
    if (state === "neutralized") continue;
    value.status = "ended";
    // « terminée » énoncé simplement est un CRITÈRE, pas un souhait : §26
    // propose « ✅ TERMINÉE » comme filtre, et §13 réserve le mode souple aux
    // formules tempérées (« terminée si possible », « plutôt terminée »,
    // « idéalement terminée »). Sans cela, « une petite série terminée »
    // acceptait des séries en cours.
    value.statusIsHard =
      isEmphatic(phraseMatch, context) ||
      phraseMatch.phrase.includes("je veux pouvoir tout voir") ||
      !isTempered(phraseMatch);
    evidence.push(phraseMatch.phrase);
  }

  const ongoingMatches = selectNonOverlapping(ONGOING_PHRASES.flatMap((phrase) => findPhrase(context, phrase)));
  for (const phraseMatch of ongoingMatches) {
    if (negationState(phraseMatch) === "negated") continue;
    value.status = "ongoing_ok";
    evidence.push(phraseMatch.phrase);
  }

  const canceledMatches = selectNonOverlapping(CANCELED_PHRASES.flatMap((phrase) => findPhrase(context, phrase)));
  for (const phraseMatch of canceledMatches) {
    // Une série annulée n'est pas une série « finie » : on note l'évitement.
    if (negationState(phraseMatch) !== "negated") {
      value.status = "ended";
      value.statusIsHard = true;
      evidence.push(`pas ${phraseMatch.phrase}`);
    }
  }

  /* --- 4. Durée des épisodes ------------------------------------------- */

  const episodeContext = /episodes?|par episod|chaque episod/;
  for (const duration of extractDurations(context)) {
    const windowBefore = text.slice(Math.max(0, duration.start - 45), duration.start);
    const windowAfter = text.slice(duration.end, Math.min(text.length, duration.end + 30));
    const related = episodeContext.test(windowBefore) || episodeContext.test(windowAfter);
    if (!related) continue;
    if (duration.negated) continue;
    value.episodeRuntime = duration.minutes;
    value.episodeTolerance = duration.kind === "around" ? 14 : duration.kind === "max" ? 6 : 12;
    explicit = true;
    evidence.push(`épisodes de ${duration.phrase}`);
  }

  const shortEpisodes = selectNonOverlapping(EPISODE_SHORT_PHRASES.flatMap((phrase) => findPhrase(context, phrase)));
  if (shortEpisodes.length && value.episodeRuntime === null) {
    value.episodeRuntime = 26;
    value.episodeTolerance = 8;
    explicit = true;
    evidence.push(...shortEpisodes.map((item) => item.phrase));
  }

  return {
    value,
    evidence: [...new Set(evidence)],
    confidence: evidence.length ? 0.8 : 0,
    explicit,
  };
}

/** Un mood explicitement souhaité est-il de nature « série » ? (utilisé par parseRequest) */
export function isSeriesishMood(moods: string[]): boolean {
  const seriesOnly = ["comfort", "investigation", "historical", "detective", "justice", "medical", "workplace"];
  return moods.some((mood) => seriesOnly.includes(mood) && !NEGATIVE_MOOD_IDS.includes(mood as never));
}
