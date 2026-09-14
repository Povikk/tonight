/**
 * Normalisation du texte et analyse de la négation.
 *
 * C'est la brique la plus importante du parser : « pas d'horreur », « pas trop
 * vieux », « romantique mais pas une comédie romantique » ou « pas forcément
 * récent » doivent être interprétés différemment.
 *
 * Méthode :
 *  1. normalisation (minuscules, accents, apostrophes, nombres en chiffres) ;
 *  2. découpage en PROPOSITIONS (le « mais » change le sens de chaque côté) ;
 *  3. pour chaque expression trouvée, analyse de ce qui la précède dans SA
 *     proposition : négation stricte, négation atténuée (« pas trop ») ou
 *     neutralisation (« pas forcément »).
 */

import { normalize } from "@/utils/text";
import type { NegationState, PhraseMatch, TextClause, TextContext } from "./types";

/** Nombres en toutes lettres (français courant). */
const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  quinze: 15,
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
  quatre_vingts: 80,
  cent: 100,
};

/** Expressions à réécrire avant analyse (pièges du français). */
const PHRASE_REWRITES: Array<[RegExp, string]> = [
  // « pas mal » = bien, ce n'est PAS une négation.
  [/\bpas mal\b/g, "bien"],
  // « je sais pas » / « je ne sais pas » → indécision explicite.
  [/\bje (ne )?sais pas\b/g, "indecis"],
  [/\bje sais pas trop\b/g, "indecis"],
  [/\bpeu importe\b/g, "indecis"],
  [/\bn'importe quoi\b/g, "surprends-moi"],
  [/\baucune idée\b/g, "indecis"],
  [/\bça m'est égal\b/g, "indecis"],
  [/\bc'est égal\b/g, "indecis"],
];

/** Séparateurs de propositions : chaque côté d'un « mais » a son propre sens. */
const CLAUSE_SEPARATORS = [
  /\s+mais\s+/g,
  /\s+par contre\s+/g,
  /\s+cependant\s+/g,
  /\s+toutefois\s+/g,
  /\s+sinon\s+/g,
  /\s+et pas\s+/g,
  /\s+ni\s+/g,
  // Le tiret long est un SÉPARATEUR SAISI PAR L'UTILISATEUR (traitement de
  // l'entrée, pas de l'affichage) : ne pas le retirer en nettoyant la typo.
  /[.;!?/•\-–—]+/g,
  /\s+alors que\s+/g,
  /\s+en revanche\s+/g,
];

/** Marqueurs de négation stricte. */
const STRICT_NEGATORS = [
  "pas de",
  "pas d'",
  "pas des",
  "pas un",
  "pas une",
  "pas",
  "sans",
  "aucun",
  "aucune",
  "jamais",
  "sauf",
  "surtout pas",
  "hors de",
  "ni",
  "no",
  "not",
  "exclu",
  "exclure",
  "exclus",
  "eviter",
  "evite",
  "interdit",
  "je ne veux pas",
  "jveux pas",
  "j'veux pas",
  "pas vraiment",
  "loin de",
  "rien de",
];

/** Marqueurs de négation ATTÉNUÉE : « pas trop long » = plutôt court. */
const ATTENUATED_NEGATORS = ["pas trop", "pas tellement", "pas trop de", "peu de", "moins de", "moins", "guère", "guere"];

/**
 * « un peu de… », « un peu d'… » est une QUANTITÉ, jamais une négation.
 * Sans ce garde-fou, « avec un peu d'amour » serait lu comme « peu d'amour ».
 */
const SMALL_AMOUNT_PATTERN = /\bun peu d'?$|\bun peu de$|\bun peu des?$/;

/** Marqueurs qui NEUTRALISENT une préférence : « pas forcément récent ». */
const NEUTRALIZERS = ["pas forcement", "pas forcément", "pas obligatoirement", "pas necessairement", "pas nécessairement", "indecis", "sans preference", "sans préférence"];

function rewrite(text: string): string {
  let output = text;
  for (const [pattern, replacement] of PHRASE_REWRITES) {
    output = output.replace(pattern, replacement);
  }
  return output;
}

/** Ajoute des espaces autour de la ponctuation et compacte. */
function tidy(text: string): string {
  return text
    .replace(/([.,;!?()])/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Découpe le texte en propositions indépendantes pour l'analyse des négations. */
export function splitClauses(normalized: string): TextClause[] {
  const boundaries = new Set<number>([0, normalized.length]);
  for (const pattern of CLAUSE_SEPARATORS) {
    const regex = new RegExp(pattern.source, "g");
    let match = regex.exec(normalized);
    while (match) {
      boundaries.add(match.index);
      boundaries.add(match.index + match[0].length);
      match = regex.exec(normalized);
    }
  }

  const sorted = [...boundaries].sort((a, b) => a - b);
  const clauses: TextClause[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const start = sorted[i];
    const end = sorted[i + 1];
    const text = normalized.slice(start, end).trim();
    if (!text) continue;
    clauses.push({ index: clauses.length, start, end, text });
  }
  return clauses.length ? clauses : [{ index: 0, start: 0, end: normalized.length, text: normalized }];
}

/** Construit le contexte d'analyse d'une phrase utilisateur. */
export function createTextContext(raw: string): TextContext {
  const normalized = tidy(rewrite(normalize(raw)));
  return { raw, normalized, clauses: splitClauses(normalized) };
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Recherche une expression (mot ou locution) et renvoie toutes ses occurrences
 * avec la proposition qui la contient.
 */
export function findPhrase(context: TextContext, phrase: string): PhraseMatch[] {
  const needle = normalize(phrase);
  if (!needle) return [];
  const pattern = new RegExp(`(?<![a-z0-9])${escapeRegex(needle)}(?![a-z0-9])`, "g");
  const matches: PhraseMatch[] = [];
  let match = pattern.exec(context.normalized);
  while (match) {
    const start = match.index;
    const end = start + match[0].length;
    const clause =
      context.clauses.find((candidate) => start >= candidate.start && start < candidate.end) ??
      context.clauses[context.clauses.length - 1];
    matches.push({
      phrase: needle,
      start,
      end,
      clause,
      prefix: context.normalized.slice(clause.start, start).trim(),
      suffix: context.normalized.slice(end, clause.end).trim(),
    });
    match = pattern.exec(context.normalized);
  }
  return matches;
}

/** Cherche la première occurrence de plusieurs expressions. */
export function findAny(context: TextContext, phrases: string[]): PhraseMatch[] {
  const results: PhraseMatch[] = [];
  for (const phrase of phrases) {
    results.push(...findPhrase(context, phrase));
  }
  return results.sort((a, b) => a.start - b.start);
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => {
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegex(normalize(needle))}(?![a-z0-9])`, "i");
    return pattern.test(haystack);
  });
}

/**
 * Détermine l'état de négation d'une expression.
 *
 * On regarde uniquement ce qui PRÉCÈDE l'expression dans sa propre proposition
 * (les négateurs français sont antéposés), avec une fenêtre limitée pour éviter
 * qu'un « pas » lointain contamine tout.
 */
export function negationState(match: PhraseMatch): NegationState {
  const prefix = match.prefix;
  if (!prefix) return "affirmed";

  // Fenêtre : les 5 derniers mots environ.
  const words = prefix.split(" ").filter(Boolean);
  const window = words.slice(-5).join(" ");
  const tail = words.slice(-3).join(" ");

  // « avec un peu d'amour » : quantité, pas négation.
  if (SMALL_AMOUNT_PATTERN.test(tail)) return "affirmed";

  if (containsAny(window, NEUTRALIZERS)) return "neutralized";
  if (containsAny(window, ATTENUATED_NEGATORS)) return "attenuated";
  if (containsAny(window, STRICT_NEGATORS)) return "negated";
  return "affirmed";
}

/** Version synthétique : vrai si l'expression est niée strictement. */
export function isNegated(context: TextContext, phrase: string): boolean {
  const matches = findPhrase(context, phrase);
  if (!matches.length) return false;
  return matches.every((match) => negationState(match) === "negated");
}

/** La proposition contient-elle un marqueur d'indécision ? */
export function isUndecided(context: TextContext): boolean {
  return findPhrase(context, "indecis").length > 0;
}

/**
 * Ne garde que les occurrences non contenues dans une occurrence plus longue.
 *
 * Indispensable : dans « pas une comédie romantique », l'expression longue
 * « comédie romantique » doit gagner, sinon « comédie » et « romantique »
 * seraient marqués comme niés et on exclurait la romance à tort.
 */
export function selectNonOverlapping(matches: PhraseMatch[]): PhraseMatch[] {
  const sorted = [...matches].sort(
    (a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const kept: PhraseMatch[] = [];
  for (const match of sorted) {
    const contained = kept.some((other) => match.start >= other.start && match.end <= other.end);
    if (!contained) kept.push(match);
  }
  return kept.sort((a, b) => a.start - b.start);
}

/** Mot-clé d'intensification : transforme une préférence en contrainte dure. */
export function isEmphatic(match: PhraseMatch, context: TextContext): boolean {
  const around = `${match.prefix} ${match.suffix}`;
  return /\b(absolument|imperatif|impératif|obligatoire|il faut|je veux absolument|assure|assure-moi|c'est obligé)\b/.test(
    around,
  );
}

/** Mot-clé de tempérance : garde la préférence en souple. */
export function isTempered(match: PhraseMatch): boolean {
  const around = `${match.prefix} ${match.suffix}`;
  return /\b(si possible|de preference|de préférence|plutot|plutôt|j'aimerais|idealement|idéalement|eventuellement|éventuellement|pas oblige|pas obligé)\b/.test(
    around,
  );
}

export { NUMBER_WORDS };
