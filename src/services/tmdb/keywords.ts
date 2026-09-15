/**
 * Résolution des keywords TMDB utilisés par les moods.
 *
 * Les moods (« feel-good », « mindfuck », « pépite ») ne correspondent pas à des
 * genres : ils correspondent à des keywords. On résout ces keywords à la volée
 * via `/search/keyword` puis on les réutilise dans `discover` avec `with_keywords`.
 * Le résultat est mis en cache mémoire : une seule requête par expression.
 */

import { createTtlCache } from "@/utils/cache";
import { TmdbError, tmdbFetch } from "./client";

interface KeywordSearchResult {
  id: number;
  name: string;
}

const keywordCache = createTtlCache<number | null>(24 * 60 * 60 * 1000);

/**
 * Recherche l'identifiant TMDB d'un keyword (« heartwarming » → 319357).
 *
 * CORRESPONDANCE EXACTE UNIQUEMENT (accents, casse, tirets et apostrophes
 * ignorés). On ne retombe PAS sur `results[0]` : `search/keyword` est une
 * recherche floue, et deviner produisait des résultats absurdes : « feel good »
 * renvoyait « feel good music », et « comfort show » (mot-clé inexistant chez
 * TMDB) renvoyait n'importe quoi. Mieux vaut aucun keyword qu'un mauvais.
 */
export async function resolveKeywordId(label: string): Promise<number | null> {
  const key = label.trim().toLowerCase();
  if (!key) return null;

  return keywordCache.getOrSet(key, async () => {
    try {
      const payload = await tmdbFetch<{ results: KeywordSearchResult[] }>(
        "/search/keyword",
        { query: label },
        { revalidate: 604_800 },
      );
      const normalized = normalizeKeyword(label);
      const exact = payload.results.find((result) => normalizeKeyword(result.name) === normalized);
      return exact?.id ?? null;
    } catch (error) {
      // Un keyword réellement inexistant (404) est un résultat valide : on le
      // mémorise. En revanche, une panne transitoire (réseau, 429, 5xx) ne doit
      // PAS être mise en cache 24 h, sinon TONIGHT perd le mood concerné bien
      // après le rétablissement de TMDB.
      if (error instanceof TmdbError && error.status === 404) return null;
      throw error;
    }
  });
}

/** Forme comparable d'un nom de keyword (« feel-good » → « feelgood »). */
function normalizeKeyword(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Résout plusieurs keywords et renvoie les identifiants trouvés, DANS L'ORDRE
 * de préférence des libellés (le premier libellé qui existe est le plus fiable).
 */
export async function resolveKeywordIds(labels: string[]): Promise<number[]> {
  const ids = await Promise.all(labels.map((label) => resolveKeywordId(label)));
  return ids.filter((id): id is number => typeof id === "number");
}
