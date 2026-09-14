/** Détection des plateformes de streaming mentionnées (région FR). */

import { ANY_PROVIDER_PHRASES, PROVIDER_PHRASES, RENTAL_PHRASES } from "./dictionaries";
import { findPhrase, isUndecided, negationState, selectNonOverlapping } from "./normalizeText";
import type { Detection, TextContext } from "./types";

export interface ProviderDetection {
  providers: number[];
  monetization: string[];
  /** L'utilisateur a explicitement dit « peu importe la plateforme ». */
  anyProvider: boolean;
  /** Plateformes explicitement refusées. */
  excludedProviders: number[];
}

export function detectProviders(context: TextContext): Detection<ProviderDetection> {
  const value: ProviderDetection = { providers: [], monetization: [], anyProvider: false, excludedProviders: [] };
  const evidence: string[] = [];

  for (const entry of PROVIDER_PHRASES) {
    const matches = selectNonOverlapping(entry.phrases.flatMap((phrase) => findPhrase(context, phrase)));
    for (const match of matches) {
      const state = negationState(match);
      if (state === "neutralized") continue;
      if (state === "negated") {
        if (!value.excludedProviders.includes(entry.id)) value.excludedProviders.push(entry.id);
        evidence.push(`pas ${entry.name}`);
        continue;
      }
      if (!value.providers.includes(entry.id)) value.providers.push(entry.id);
      evidence.push(entry.name);
    }
  }

  const rentalMatches = selectNonOverlapping(RENTAL_PHRASES.flatMap((phrase) => findPhrase(context, phrase)));
  for (const match of rentalMatches) {
    if (negationState(match) === "negated") continue;
    value.monetization = ["flatrate", "free", "ads", "rent", "buy"];
    evidence.push(match.phrase);
  }
  if (value.providers.length && !value.monetization.length) {
    value.monetization = ["flatrate", "free", "ads"];
  }

  if (value.providers.length === 0 && (isUndecided(context) || findPhrase(context, "où").length)) {
    value.anyProvider = true;
  }
  if (value.providers.length) {
    // « dispo sur Netflix ou peu importe » : la sélection explicite gagne.
    value.anyProvider = false;
  }

  return {
    value,
    evidence: [...new Set(evidence)],
    confidence: evidence.length ? 0.8 : 0,
    explicit: value.providers.length > 0,
  };
}

export { ANY_PROVIDER_PHRASES };
