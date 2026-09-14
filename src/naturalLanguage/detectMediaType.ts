/** Détection Film / Série. */

import { MOVIE_PHRASES, TV_PHRASES } from "./dictionaries";
import { findPhrase, negationState, selectNonOverlapping } from "./normalizeText";
import type { Detection, TextContext } from "./types";

/**
 * Renvoie `movie`, `tv`, `any` (les deux mentionnés) ou `null` (aucune idée).
 * `null` déclenche la question unique « Film / Série / Choisis pour moi ».
 */
export function detectMediaType(context: TextContext): Detection<"movie" | "tv" | "any" | null> {
  const movieMatches = selectNonOverlapping(MOVIE_PHRASES.flatMap((phrase) => findPhrase(context, phrase)));
  const tvMatches = selectNonOverlapping(TV_PHRASES.flatMap((phrase) => findPhrase(context, phrase)));

  const wantsMovie = movieMatches.some((match) => negationState(match) !== "negated" && negationState(match) !== "neutralized");
  const wantsTv = tvMatches.some((match) => negationState(match) !== "negated" && negationState(match) !== "neutralized");

  const evidence = [
    ...movieMatches.map((match) => match.phrase),
    ...tvMatches.map((match) => match.phrase),
  ];

  if (wantsMovie && wantsTv) {
    return { value: "any", evidence, confidence: 0.6, explicit: true };
  }
  if (wantsTv) {
    return { value: "tv", evidence: [...new Set(evidence)], confidence: 0.8, explicit: true };
  }
  if (wantsMovie) {
    return { value: "movie", evidence: [...new Set(evidence)], confidence: 0.8, explicit: true };
  }
  return { value: null, evidence: [], confidence: 0, explicit: false };
}
