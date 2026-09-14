/** Détection de l'exigence de qualité et des notes minimales explicites. */

import { QUALITY_PHRASES } from "./dictionaries";
import { findPhrase, negationState, selectNonOverlapping } from "./normalizeText";
import type { Detection, TextContext } from "./types";

export interface QualityDetection {
  preference: "risky" | "solid" | "very_solid" | "no_risk" | null;
  minRating: number | null;
}

/** « note > 8 », « au moins 8/10 », « 7,5 minimum » */
function detectMinRating(text: string): { value: number | null; phrase: string | null } {
  const patterns: RegExp[] = [
    /\bnote\s*(?:>|superieure? a|supérieure? à|au dessus de|au-dessus de|minimum|au moins)?\s*(\d(?:[.,]\d)?)/,
    /(\d(?:[.,]\d)?)\s*\/\s*10/,
    /\b(?:au moins|minimum|plus de)\s*(\d(?:[.,]\d)?)\s*(?:de\s*)?(?:note|etoiles|étoiles)/,
    /\b(?:note|notes)\s*(?:de|:)\s*(\d(?:[.,]\d)?)/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const value = Number.parseFloat(match[1].replace(",", "."));
    if (Number.isFinite(value) && value >= 4 && value <= 9.9) {
      return { value, phrase: match[0] };
    }
  }
  return { value: null, phrase: null };
}

export function detectQuality(context: TextContext): Detection<QualityDetection> {
  const value: QualityDetection = { preference: null, minRating: null };
  const evidence: string[] = [];

  for (const entry of QUALITY_PHRASES) {
    const matches = selectNonOverlapping(entry.phrases.flatMap((phrase) => findPhrase(context, phrase)));
    for (const match of matches) {
      const state = negationState(match);
      if (state === "neutralized") continue;
      if (state === "negated") continue;
      if (value.preference === null) {
        value.preference = entry.preference;
        evidence.push(match.phrase);
      }
    }
  }

  const rating = detectMinRating(context.normalized);
  if (rating.value !== null) {
    value.minRating = rating.value;
    evidence.push(rating.phrase ?? `note ≥ ${rating.value}`);
  }

  return {
    value,
    evidence: [...new Set(evidence)],
    confidence: evidence.length ? 0.7 : 0,
    explicit: value.minRating !== null,
  };
}
