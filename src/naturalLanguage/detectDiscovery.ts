/** Détection du niveau de découverte : incontournable, pépite, truc inconnu… */

import { DISCOVERY_PHRASES } from "./dictionaries";
import { findPhrase, negationState, selectNonOverlapping } from "./normalizeText";
import type { Detection, TextContext } from "./types";

export type DiscoveryLevelValue = "mainstream" | "safe" | "hidden_gem" | "obscure" | "surprise";

const PRIORITY: DiscoveryLevelValue[] = ["obscure", "hidden_gem", "surprise", "mainstream", "safe"];

export function detectDiscovery(context: TextContext): Detection<DiscoveryLevelValue | null> {
  const found: DiscoveryLevelValue[] = [];
  const evidence: string[] = [];

  for (const entry of DISCOVERY_PHRASES) {
    const matches = selectNonOverlapping(entry.phrases.flatMap((phrase) => findPhrase(context, phrase)));
    for (const match of matches) {
      const state = negationState(match);

      if (state === "affirmed") {
        found.push(entry.level);
        evidence.push(match.phrase);
        continue;
      }
      if (state === "neutralized") continue;

      // « pas très connu » → pépite ; « pas un truc connu » → pépite également.
      if (entry.level === "mainstream") {
        found.push("hidden_gem");
        evidence.push(`pas ${match.phrase}`);
      }
      if (entry.level === "hidden_gem") {
        // « pas vraiment une pépite » → plutôt connu
        found.push("mainstream");
        evidence.push(`pas une ${match.phrase}`);
      }
    }
  }

  if (!found.length) {
    return { value: null, evidence: [], confidence: 0, explicit: false };
  }

  const sorted = PRIORITY.filter((level) => found.includes(level));
  return {
    value: sorted[0],
    evidence: [...new Set(evidence)],
    confidence: 0.75,
    explicit: true,
  };
}
