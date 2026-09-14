/**
 * Détection des genres.
 *
 * Trois cas (§12 et §13) :
 *  - « policier »            → genre souhaité ;
 *  - « pas d'horreur »       → genre EXCLU (contrainte dure) ;
 *  - « pas trop de romance » → genre pénalisé (préférence souple).
 */

import { GENRE_PHRASES } from "./dictionaries";
import { findPhrase, negationState, selectNonOverlapping } from "./normalizeText";
import type { Detection, TextContext } from "./types";

export interface GenreDetection {
  genres: number[];
  excluded: number[];
  /** Exclusions dures : « pas d'horreur », pas une simple nuance. */
  hardExcluded: number[];
}

export function detectGenres(context: TextContext): Detection<GenreDetection> {
  const value: GenreDetection = { genres: [], excluded: [], hardExcluded: [] };
  const evidence: string[] = [];

  /**
   * Expressions composées gérées ailleurs.
   *
   * « pas une comédie romantique » ne doit PAS signifier « pas de comédie » :
   * c'est la combinaison romance + comédie qui est refusée (cf.
   * `detectExclusions`). On ignore donc les genres contenus dans ces locutions.
   */
  const compoundSpans = ["comedie romantique", "comédie romantique", "rom-com", "romcom"]
    .flatMap((phrase) => findPhrase(context, phrase))
    .map((match) => ({ start: match.start, end: match.end }));

  for (const entry of GENRE_PHRASES) {
    const matches = selectNonOverlapping(entry.phrases.flatMap((phrase) => findPhrase(context, phrase)));
    for (const match of matches) {
      const insideCompound = compoundSpans.some((span) => match.start >= span.start && match.end <= span.end);
      if (insideCompound) continue;
      const state = negationState(match);
      if (state === "neutralized") continue;

      if (state === "affirmed") {
        if (!value.genres.includes(entry.id)) value.genres.push(entry.id);
        evidence.push(match.phrase);
        continue;
      }

      if (!value.excluded.includes(entry.id)) value.excluded.push(entry.id);
      // « pas d'horreur » = exclusion stricte ; « pas trop d'horreur » = nuance.
      if (state === "negated") value.hardExcluded.push(entry.id);
      evidence.push(`${state === "attenuated" ? "pas trop de " : "pas de "}${match.phrase}`);
    }
  }

  // Un genre ne peut pas être à la fois souhaité et nié : l'exclusion gagne.
  value.genres = value.genres.filter((id) => !value.excluded.includes(id));

  return {
    value,
    evidence: [...new Set(evidence)],
    confidence: evidence.length ? 0.8 : 0,
    explicit: evidence.length > 0,
  };
}
