/** Utilitaires texte : normalisation FR, accents, comparaisons tolérantes. */

/**
 * Normalise une chaîne pour l'analyse : minuscules, accents retirés,
 * apostrophes et tirets unifiés, espaces compactés.
 * Cette fonction est la brique de base du parser en langage naturel.
 */
export function stripAccents(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalize(input: string): string {
  return stripAccents(input)
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    // Les tirets longs SAISIS PAR L'UTILISATEUR sont ramenés au tiret simple :
    // « moins de 2h — pas triste » doit se lire comme « moins de 2h - pas triste ».
    // Ne jamais retirer cette ligne : elle traite l'entrée, pas l'affichage.
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Supprime la ponctuation agressive tout en gardant les mots. */
export function words(input: string): string[] {
  return normalize(input)
    .replace(/[.,;:!?()"[\]{}«»/\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Recherche d'expression entière (avec limites de mots) dans un texte normalisé. */
export function containsPhrase(haystackNormalized: string, phrase: string): boolean {
  const needle = normalize(phrase);
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystackNormalized);
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

/** Hash stable (djb2) : sert aux couleurs déterministes des visuels de secours. */
export function stableHash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function capitalize(input: string): string {
  if (!input) return input;
  return input.charAt(0).toUpperCase() + input.slice(1);
}

/** Joint une liste en français : "a, b et c". */
export function joinFr(items: string[]): string {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(", ")} et ${clean[clean.length - 1]}`;
}
