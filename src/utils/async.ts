/** Utilitaires asynchrones (limitation de concurrence pour les appels TMDB). */

/**
 * `Promise.all` avec limite de concurrence.
 * TMDB n'aime pas 40 requêtes simultanées : on plafonne.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await worker(items[index], index);
      } catch {
        // Un candidat qui échoue ne doit pas faire tomber toute la recherche.
        results[index] = undefined as unknown as R;
      }
    }
  });

  await Promise.all(runners);
  return results;
}

/** Filtre les `undefined` avec un type sûr. */
export function compact<T>(items: Array<T | undefined | null>): T[] {
  return items.filter((item): item is T => item !== undefined && item !== null);
}
