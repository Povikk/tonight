/**
 * Exclusions transverses : catégories entières et combinaisons de genres.
 *
 * Exemple emblématique : « un film romantique mais pas une comédie romantique »
 * → Romance autorisée, combo Romance + Comédie pénalisé.
 */

import { GENRE } from "@/utils/constants";
import { EXCLUSION_PHRASES } from "./dictionaries";
import { findPhrase, negationState, selectNonOverlapping } from "./normalizeText";
import type { Detection, TextContext } from "./types";

export interface ExclusionDetection {
  combos: Array<[number, number]>;
  excludeAnimation: boolean;
  excludeDocumentary: boolean;
  excludeMusical: boolean;
  /** Combinaisons en simple pénalité (préférence souple). */
  softCombos: Array<[number, number]>;
}

export function detectExclusions(context: TextContext): Detection<ExclusionDetection> {
  const value: ExclusionDetection = {
    combos: [],
    excludeAnimation: false,
    excludeDocumentary: false,
    excludeMusical: false,
    softCombos: [],
  };
  const evidence: string[] = [];

  const flagFor = (key: keyof typeof EXCLUSION_PHRASES): keyof ExclusionDetection | null => {
    switch (key) {
      case "animation":
        return "excludeAnimation";
      case "documentary":
        return "excludeDocumentary";
      case "musical":
        return "excludeMusical";
      default:
        return null;
    }
  };

  for (const [key, phrases] of Object.entries(EXCLUSION_PHRASES) as Array<
    [keyof typeof EXCLUSION_PHRASES, string[]]
  >) {
    const flag = flagFor(key);
    const matches = selectNonOverlapping(phrases.flatMap((phrase) => findPhrase(context, phrase)));
    for (const match of matches) {
      const state = negationState(match);
      if (state === "affirmed") continue;
      if (state === "neutralized") continue;
      if (flag) {
        (value[flag] as boolean) = true;
        evidence.push(`${state === "attenuated" ? "pas trop de " : "pas de "}${match.phrase}`);
      }
    }
  }

  // Comédie romantique refusée → combo Romance + Comédie.
  const romcomPhrases = ["comedie romantique", "comédie romantique", "rom-com", "romcom"];
  const romcomMatches = selectNonOverlapping(romcomPhrases.flatMap((phrase) => findPhrase(context, phrase)));
  for (const match of romcomMatches) {
    const state = negationState(match);
    if (state === "affirmed") continue;
    if (state === "neutralized") continue;
    const combo: [number, number] = [GENRE.ROMANCE, GENRE.COMEDY];
    if (state === "negated") value.combos.push(combo);
    else value.softCombos.push(combo);
    evidence.push(`pas de ${match.phrase}`);
  }

  return {
    value,
    evidence: [...new Set(evidence)],
    confidence: evidence.length ? 0.7 : 0,
    explicit: evidence.length > 0,
  };
}
