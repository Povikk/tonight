/**
 * Score de mood (§19, §33).
 *
 * Un mood n'est jamais un seul genre TMDB. Pour chaque mood demandé on croise :
 *   - les genres (signal fort) ;
 *   - les keywords portés par le candidat (issus d'une recherche TMDB par mood) ;
 *   - des indices textuels dans le synopsis ;
 *   - les genres contradictoires (signal négatif) ;
 *   - les moods voisins (crédit partiel : feel-good crédite un peu « faire rire »).
 */

import { MOOD_DEFINITIONS, moodDefinition } from "@/data/moods";
import type { Candidate, Mood, TonightSearchPreferences } from "@/types/tonight";
import { canonicalGenres } from "@/utils/canonical";
import { normalize } from "@/utils/text";
import { clamp01 } from "./qualityScore";

/** Genres canoniques (espace film) d'un candidat. */
function candidateGenres(candidate: Candidate): number[] {
  return canonicalGenres(candidate.genres);
}

function genreOverlap(candidate: Candidate, genreIds: number[]): boolean {
  const genres = candidateGenres(candidate);
  return genreIds.some((id) => genres.includes(id));
}

function conflictOverlap(candidate: Candidate, genreIds: number[] | undefined): boolean {
  if (!genreIds?.length) return false;
  const genres = candidateGenres(candidate);
  return genreIds.some((id) => genres.includes(id));
}

function keywordOverlap(candidate: Candidate, slugs: string[]): boolean {
  if (!candidate.keywordSlugs.length) return false;
  const owned = candidate.keywordSlugs.map((slug) => normalize(slug));
  return slugs.some((slug) => owned.some((entry) => entry.includes(normalize(slug)) || normalize(slug).includes(entry)));
}

/**
 * Nombre d'indices textuels trouvés dans le synopsis.
 * Les synopsis FR de TMDB sont exploitables tels quels.
 */
function textHintCount(candidate: Candidate, hints: string[]): number {
  const overview = normalize(candidate.overview);
  if (!overview) return 0;
  let count = 0;
  for (const hint of hints) {
    if (overview.includes(normalize(hint))) count += 1;
  }
  return count;
}

/** Adéquation d'un candidat à UN mood, entre 0 et 1. */
export function calculateMoodFit(candidate: Candidate, mood: Mood): number {
  const definition = moodDefinition(mood);
  if (!definition) return 0;

  const genreMatch = genreOverlap(candidate, definition.genres) ? 0.7 : 0;
  const keywordMatch = keywordOverlap(candidate, definition.keywordSlugs) ? 0.35 : 0;
  const textMatch = Math.min(0.3, textHintCount(candidate, definition.textHints) * 0.12);
  const conflict = conflictOverlap(candidate, definition.conflictGenres) ? 0.55 : 0;

  // Un mood très spécifique est reconnu par le texte même sans genre exact
  // (« ce film parle de mémoire et de temps » → mind_bending).
  const raw = Math.max(genreMatch, textMatch + keywordMatch * 0.5) + keywordMatch + textMatch;
  return clamp01(raw - conflict);
}

/** Score de mood global : moyenne pondérée des moods demandés + crédit des voisins. */
export function calculateMoodScore(
  candidate: Candidate,
  preferences: TonightSearchPreferences,
): { value: number; matched: Mood[] } {
  if (!preferences.moods.length) return { value: 0.5, matched: [] };

  const scores: number[] = [];
  const matched: Mood[] = [];

  for (const mood of preferences.moods) {
    const direct = calculateMoodFit(candidate, mood);
    if (direct >= 0.5) matched.push(mood);

    // Crédit partiel via les moods voisins (max 0.25).
    let siblingCredit = 0;
    for (const sibling of moodDefinition(mood)?.siblings ?? []) {
      siblingCredit = Math.max(siblingCredit, calculateMoodFit(candidate, sibling) * 0.45);
    }
    scores.push(Math.max(direct, siblingCredit));
  }

  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return { value: clamp01(average), matched };
}

/**
 * Pénalité des moods refusés (« pas triste », « pas prise de tête »).
 * Renvoie 0 (aucun problème) → 1 (exactement ce que l'utilisateur refuse).
 */
export function calculateMoodPenalty(
  candidate: Candidate,
  preferences: TonightSearchPreferences,
): { value: number; hit: Mood[] } {
  if (!preferences.excludedMoods.length) return { value: 0, hit: [] };

  const hits: number[] = [];
  const hit: Mood[] = [];
  for (const mood of preferences.excludedMoods) {
    const fit = calculateMoodFit(candidate, mood);
    if (fit >= 0.45) hit.push(mood);
    hits.push(fit);
  }

  // On utilise la moyenne pondérée vers le pire cas : un seul mood très
  // présent suffit à disqualifier (« c'est exactement un film triste »).
  const average = hits.reduce((sum, value) => sum + value, 0) / hits.length;
  const worst = Math.max(...hits);
  return { value: clamp01(average * 0.55 + worst * 0.45), hit };
}

/** Tous les moods positifs connus (pour l'analyse de personnalité). */
export const ALL_MOOD_IDS = Object.keys(MOOD_DEFINITIONS) as Mood[];
