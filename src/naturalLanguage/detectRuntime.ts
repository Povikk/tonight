/**
 * Détection des durées.
 *
 * Distinction essentielle (§13) :
 *  - « moins de 2 heures » → contrainte DURE (max = 120) ;
 *  - « pas trop long »      → préférence SOUPLE (viser ~110 min) ;
 *  - « environ 30 minutes » → durée approximative, avec tolérance.
 */

import { LONG_PHRASES, SHORT_PHRASES } from "./dictionaries";
import { NUMBER_WORDS, findPhrase, negationState, selectNonOverlapping } from "./normalizeText";
import type { Detection, DurationMention, TextContext } from "./types";

const MAX_MARKERS = [
  "moins de",
  "moins d'",
  "pas plus de",
  "maximum",
  "max",
  "au plus",
  "en dessous de",
  "sous les",
  "sous",
  "pas depasser",
  "pas plus",
  "top chrono",
  "j'ai que",
  "je n'ai que",
  "seulement",
];

const MIN_MARKERS = ["plus de", "au moins", "minimum", "min", "a partir de", "à partir de", "au dela de", "au-delà de"];
const AROUND_MARKERS = ["environ", "vers", "autour de", "a peu pres", "à peu près", "genre", "dans les", "de l'ordre de"];

const NUMBER_PATTERN = Object.keys(NUMBER_WORDS).join("|");

interface RawDuration {
  minutes: number;
  start: number;
  end: number;
  approximate: boolean;
}

/** Extrait toutes les durées écrites en chiffres ou en lettres. */
function extractRawDurations(text: string): RawDuration[] {
  const found: RawDuration[] = [];

  // 1h30 / 2h / 1 h 45 / 3h05
  const hourPattern = /(\d{1,2})\s*h\s*(\d{2})?(?![a-z0-9])/g;
  let match = hourPattern.exec(text);
  while (match) {
    const hours = Number.parseInt(match[1], 10);
    const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
    found.push({ minutes: hours * 60 + minutes, start: match.index, end: match.index + match[0].length, approximate: false });
    match = hourPattern.exec(text);
  }

  // 90 minutes / 30 min
  const minutePattern = /(\d{1,3})\s*(?:minutes?|mins?|mn)(?![a-z0-9])/g;
  match = minutePattern.exec(text);
  while (match) {
    found.push({ minutes: Number.parseInt(match[1], 10), start: match.index, end: match.index + match[0].length, approximate: false });
    match = minutePattern.exec(text);
  }

  // deux heures / une heure et demie / trois quarts d'heure
  const wordPattern = new RegExp(`\\b(${NUMBER_PATTERN})\\s*heures?\\b(?:\\s*(?:et|&)\\s*(demie|demi|quart))?`, "g");
  match = wordPattern.exec(text);
  while (match) {
    const hours = NUMBER_WORDS[match[1]] ?? 0;
    let minutes = hours * 60;
    if (match[2] === "demie" || match[2] === "demi") minutes += 30;
    if (match[2] === "quart") minutes += 15;
    found.push({ minutes, start: match.index, end: match.index + match[0].length, approximate: false });
    match = wordPattern.exec(text);
  }

  const quarterPattern = /\btrois quarts d'heure\b/g;
  match = quarterPattern.exec(text);
  while (match) {
    found.push({ minutes: 45, start: match.index, end: match.index + match[0].length, approximate: false });
    match = quarterPattern.exec(text);
  }

  const halfWordPattern = /\b(une )?demi-heure\b/g;
  match = halfWordPattern.exec(text);
  while (match) {
    found.push({ minutes: 30, start: match.index, end: match.index + match[0].length, approximate: false });
    match = halfWordPattern.exec(text);
  }

  // déduplication par position
  const deduped = new Map<string, RawDuration>();
  for (const item of found) deduped.set(`${item.start}:${item.end}`, item);
  return [...deduped.values()].sort((a, b) => a.start - b.start);
}

/** Détermine le type de borne (« moins de », « au moins », approximatif…). */
function classifyDuration(text: string, duration: RawDuration): DurationMention["kind"] {
  const prefix = text.slice(Math.max(0, duration.start - 24), duration.start);
  const lowered = prefix.toLowerCase();
  if (aroundMarkers(lowered)) return "around";
  if (maxMarkers(lowered)) return "max";
  if (minMarkers(lowered)) return "min";
  // Une durée donnée sans marqueur est considérée comme un plafond
  // (« j'ai 1h30 devant moi »).
  return "max";
}

function aroundMarkers(prefix: string): boolean {
  return AROUND_MARKERS.some((marker) => prefix.includes(marker));
}

function maxMarkers(prefix: string): boolean {
  return MAX_MARKERS.some((marker) => prefix.includes(marker));
}

function minMarkers(prefix: string): boolean {
  return MIN_MARKERS.some((marker) => prefix.includes(marker));
}

/** Toutes les durées mentionnées, avec leur nature. */
export function extractDurations(context: TextContext): DurationMention[] {
  const text = context.normalized;
  return extractRawDurations(text).map((duration) => {
    const prefix = text.slice(Math.max(0, duration.start - 26), duration.start);
    return {
      minutes: duration.minutes,
      kind: classifyDuration(text, duration),
      phrase: text.slice(duration.start, duration.end),
      negated: /\bpas (de|d'|plus de)\b/.test(prefix),
      start: duration.start,
      end: duration.end,
    };
  });
}

export interface RuntimeDetection {
  min: number | null;
  max: number | null;
  softShort: boolean;
  softLong: boolean;
}

/** Détection de la durée d'un FILM (les séries passent par les épisodes). */
export function detectRuntime(context: TextContext): Detection<RuntimeDetection> {
  const value: RuntimeDetection = { min: null, max: null, softShort: false, softLong: false };
  const evidence: string[] = [];
  let explicit = false;

  for (const duration of extractDurations(context)) {
    if (duration.negated) continue;
    // Les durées très courtes (≤ 45 min) dans un contexte film sont ambiguës :
    // on les ignore ici, elles sont gérées par la détection « épisodes ».
    if (duration.minutes < 45) continue;
    if (duration.kind === "max" || duration.kind === "around") {
      value.max = value.max === null ? duration.minutes : Math.min(value.max, duration.minutes);
      explicit = true;
      evidence.push(duration.phrase);
    } else {
      value.min = value.min === null ? duration.minutes : Math.max(value.min, duration.minutes);
      explicit = true;
      evidence.push(duration.phrase);
    }
  }

  // « court », « pas long » → préférence souple
  const shortMatches = selectNonOverlapping(SHORT_PHRASES.flatMap((phrase) => findPhrase(context, phrase)));
  for (const match of shortMatches) {
    const state = negationState(match);
    if (state === "affirmed" || state === "attenuated") {
      value.softShort = true;
      evidence.push(match.phrase);
    } else if (state === "negated") {
      // « pas court » → plutôt long
      value.softLong = true;
      evidence.push(`pas ${match.phrase}`);
    }
  }

  const longMatches = selectNonOverlapping(LONG_PHRASES.flatMap((phrase) => findPhrase(context, phrase)));
  for (const match of longMatches) {
    const state = negationState(match);
    if (state === "affirmed") {
      value.softLong = true;
      evidence.push(match.phrase);
    } else if (state === "negated" || state === "attenuated") {
      // « pas trop long », « pas long » → court souhaité, sans dureté
      value.softShort = true;
      evidence.push(`pas ${match.phrase}`);
    }
  }

  const confidence = explicit ? 0.9 : evidence.length ? 0.6 : 0;
  return { value, evidence: [...new Set(evidence)], confidence, explicit };
}
