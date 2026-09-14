/**
 * Détection de l'époque.
 *
 * Cas délicats gérés explicitement (§12) :
 *  - « pas trop vieux »     → préférence SOUPLE pour du récent ;
 *  - « pas forcément récent » → NE PAS interpréter comme « récent » (neutralisé) ;
 *  - « années 90 »          → contrainte DURE 1990-1999 ;
 *  - « un vieux classique mais pas en noir et blanc » → ancien, mais pas trop.
 */

import { DECADE_PHRASES, OLD_PHRASES, RECENT_PHRASES } from "./dictionaries";
import { findPhrase, negationState, selectNonOverlapping } from "./normalizeText";
import type { Detection, TextContext } from "./types";

const CURRENT_YEAR = new Date().getFullYear();
/** Fenêtre « récent » : les 12 dernières années. */
const RECENT_MIN_YEAR = CURRENT_YEAR - 12;

export interface DateDetection {
  minYear: number | null;
  maxYear: number | null;
  softRecent: boolean;
  softOld: boolean;
  /** Éviter le noir et blanc (film ancien → plutôt après 1965). */
  avoidBlackAndWhite: boolean;
}

function parseYear(raw: string): number | null {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return null;
  if (value < 1900 || value > CURRENT_YEAR + 2) return null;
  return value;
}

export function detectDates(context: TextContext): Detection<DateDetection> {
  const value: DateDetection = {
    minYear: null,
    maxYear: null,
    softRecent: false,
    softOld: false,
    avoidBlackAndWhite: false,
  };
  const evidence: string[] = [];
  let explicit = false;

  const widenMin = (year: number) => {
    value.minYear = value.minYear === null ? year : Math.max(value.minYear, year);
  };
  const widenMax = (year: number) => {
    value.maxYear = value.maxYear === null ? year : Math.min(value.maxYear, year);
  };

  /* --- 1. Années et décennies explicites -------------------------------- */

  // Décennies combinées : « les années 80 ou 90 », « 80-90 », « 80 et 90 ».
  const combinedPattern = /annees?\s+(\d{2})\s*(?:ou|et|-|a|à)\s*(?:les\s+)?(\d{2})/g;
  let combinedMatch = combinedPattern.exec(context.normalized);
  while (combinedMatch) {
    const first = Number.parseInt(combinedMatch[1], 10);
    const second = Number.parseInt(combinedMatch[2], 10);
    const base = (decade: number) => (decade >= 30 ? 1900 + decade : 2000 + decade);
    const from = base(Math.min(first, second));
    const to = base(Math.max(first, second)) + 9;
    widenMin(from);
    widenMax(to);
    explicit = true;
    evidence.push(combinedMatch[0]);
    combinedMatch = combinedPattern.exec(context.normalized);
  }

  for (const decade of DECADE_PHRASES) {
    const matches = selectNonOverlapping(decade.phrases.flatMap((phrase) => findPhrase(context, phrase)));
    for (const match of matches) {
      if (negationState(match) === "negated") continue;
      // Une décennie déjà couverte par une expression combinée ne rétrécit pas la borne.
      if (evidence.length && value.minYear !== null && value.maxYear !== null) continue;
      widenMin(decade.min);
      widenMax(decade.max);
      explicit = true;
      evidence.push(match.phrase.trim());
    }
  }

  // « de 1995 », « en 1998 », « entre 2000 et 2010 », « avant 1980 », « après 2010 »
  const rangePattern = /\bentre\s+(\d{4})\s+et\s+(\d{4})\b/g;
  let rangeMatch = rangePattern.exec(context.normalized);
  while (rangeMatch) {
    const from = parseYear(rangeMatch[1]);
    const to = parseYear(rangeMatch[2]);
    if (from && to) {
      widenMin(Math.min(from, to));
      widenMax(Math.max(from, to));
      explicit = true;
      evidence.push(rangeMatch[0]);
    }
    rangeMatch = rangePattern.exec(context.normalized);
  }

  const boundPattern = /\b(avant|apres|après|depuis|des|en|de)\s+(\d{4})\b/g;
  let boundMatch = boundPattern.exec(context.normalized);
  while (boundMatch) {
    const year = parseYear(boundMatch[2]);
    const marker = boundMatch[1];
    if (year) {
      if (marker === "avant") widenMax(year - 1);
      else if (marker === "apres" || marker === "après" || marker === "depuis") widenMin(year);
      else {
        // « de 1995 » / « en 1998 » : année précise → fenêtre tolérante de 2 ans.
        widenMin(year - 2);
        widenMax(year + 2);
      }
      explicit = true;
      evidence.push(boundMatch[0]);
    }
    boundMatch = boundPattern.exec(context.normalized);
  }

  /* --- 2. Récent / vieux ------------------------------------------------ */

  const recentMatches = selectNonOverlapping(RECENT_PHRASES.flatMap((phrase) => findPhrase(context, phrase)));
  for (const match of recentMatches) {
    const state = negationState(match);
    switch (state) {
      case "affirmed":
        value.softRecent = true;
        evidence.push(match.phrase);
        break;
      case "attenuated":
        // « pas trop récent » → on remonte un peu, sans dureté
        value.softOld = true;
        evidence.push(`pas trop ${match.phrase}`);
        break;
      case "negated":
        // « pas récent » → plutôt ancien
        value.softOld = true;
        value.softRecent = false;
        evidence.push(`pas ${match.phrase}`);
        break;
      case "neutralized":
        // « pas forcément récent » → AUCUNE préférence (exigence §12)
        evidence.push(`pas forcément ${match.phrase}`);
        break;
    }
  }

  const oldMatches = selectNonOverlapping(OLD_PHRASES.flatMap((phrase) => findPhrase(context, phrase)));
  for (const match of oldMatches) {
    const state = negationState(match);
    switch (state) {
      case "affirmed":
        value.softOld = true;
        evidence.push(match.phrase);
        break;
      case "attenuated":
      case "negated":
        // « pas trop vieux », « pas vieux » → récent souhaité (souple)
        value.softRecent = true;
        value.softOld = false;
        evidence.push(`${state === "attenuated" ? "pas trop " : "pas "}${match.phrase}`);
        break;
      case "neutralized":
        evidence.push(`pas forcément ${match.phrase}`);
        break;
    }
  }

  // « très récent » / « tout récent » → on durcit un peu la borne basse.
  if (/tres recent|tout recent|de cette annee|sorti recemment|recemment sorti/.test(context.normalized)) {
    value.softRecent = true;
    widenMin(CURRENT_YEAR - 4);
    explicit = true;
    evidence.push("très récent");
  }

  /* --- 3. Cas particulier : noir et blanc ------------------------------- */

  const blackAndWhiteMatches = findPhrase(context, "noir et blanc");
  for (const match of blackAndWhiteMatches) {
    if (negationState(match) === "negated") {
      value.avoidBlackAndWhite = true;
      evidence.push("pas en noir et blanc");
      // Un film en couleur avant 1965 est rare : on remonte la borne basse.
      widenMin(1965);
      explicit = true;
    } else {
      value.softOld = true;
      evidence.push("noir et blanc");
    }
  }

  const confidence = explicit ? 0.9 : evidence.length ? 0.6 : 0;
  return { value, evidence: [...new Set(evidence)], confidence, explicit };
}

export { RECENT_MIN_YEAR };
