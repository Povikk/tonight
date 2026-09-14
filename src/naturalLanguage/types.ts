/** Types partagés du module de langage naturel. */

import type { Mood, TonightSearchPreferences } from "@/types/tonight";

/** État d'une expression face à la négation. */
export type NegationState = "affirmed" | "negated" | "attenuated" | "neutralized";

export interface TextClause {
  index: number;
  start: number;
  end: number;
  text: string;
}

/** Contexte d'analyse : texte normalisé + propositions. */
export interface TextContext {
  raw: string;
  normalized: string;
  clauses: TextClause[];
}

export interface PhraseMatch {
  phrase: string;
  start: number;
  end: number;
  clause: TextClause;
  /** Texte de la proposition AVANT l'expression (base de l'analyse de négation). */
  prefix: string;
  /** Texte de la proposition APRÈS l'expression. */
  suffix: string;
}

/** Résultat d'un détecteur : ce qui a été trouvé et avec quelle certitude. */
export interface Detection<T> {
  value: T;
  /** Expressions réellement reconnues (pour la transparence côté UI). */
  evidence: string[];
  /** 0 → 1 : contribution à la confiance globale du parser. */
  confidence: number;
  /** Une donnée numérique a-t-elle été écrite explicitement ? */
  explicit: boolean;
}

/** Durée exprimée dans la phrase. */
export interface DurationMention {
  minutes: number;
  kind: "max" | "min" | "around";
  phrase: string;
  negated: boolean;
  /** Position dans le texte normalisé (utile pour analyser le contexte). */
  start: number;
  end: number;
}

export interface MoodDetection extends Detection<Mood[]> {
  excluded: Mood[];
}

/**
 * Résultat brut de tous les détecteurs. `parseRequest` assemble ensuite
 * l'objet `TonightSearchPreferences`.
 */
export interface ParseSlices {
  mediaType: Detection<"movie" | "tv" | "any" | null>;
  runtime: Detection<{ min: number | null; max: number | null; softShort: boolean; softLong: boolean }>;
  dates: Detection<{ minYear: number | null; maxYear: number | null; softRecent: boolean; softOld: boolean }>;
  genres: Detection<{ genres: number[]; excluded: number[] }>;
  moods: MoodDetection;
  exclusions: Detection<{
    combos: Array<[number, number]>;
    excludeAnimation: boolean;
    excludeDocumentary: boolean;
    excludeMusical: boolean;
  }>;
  series: Detection<{
    minSeasons: number | null;
    maxSeasons: number | null;
    status: "ended" | "ongoing_ok" | "any" | null;
    commitment: "mini" | "small" | "medium" | "long" | "any" | null;
    episodeRuntime: number | null;
    episodeTolerance: number;
  }>;
  discovery: Detection<"mainstream" | "safe" | "hidden_gem" | "obscure" | "surprise" | null>;
  quality: Detection<{ preference: "risky" | "solid" | "very_solid" | "no_risk" | null; minRating: number | null }>;
  providers: Detection<{ providers: number[]; monetization: string[] }>;
  language: Detection<string | null>;
  country: Detection<string | null>;
}

export type { TonightSearchPreferences };
