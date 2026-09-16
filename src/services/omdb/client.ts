import type { Candidate, PublicRating } from "@/types/tonight";
import { mapLimit } from "@/utils/async";
import { createTtlCache } from "@/utils/cache";

const OMDB_API_BASE = "https://www.omdbapi.com/";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const ratingCache = createTtlCache<PublicRating | null>(CACHE_TTL, 2_000);

interface OmdbResponse {
  Response?: "True" | "False";
  imdbRating?: string;
  imdbVotes?: string;
}

function apiKey(): string | null {
  return process.env.OMDB_API_KEY?.trim() || null;
}

function parseRating(payload: OmdbResponse): PublicRating | null {
  if (payload.Response === "False") return null;
  const average = Number.parseFloat(payload.imdbRating ?? "");
  const voteCount = Number.parseInt((payload.imdbVotes ?? "").replace(/,/g, ""), 10);
  if (!Number.isFinite(average) || average <= 0 || average > 10) return null;
  if (!Number.isInteger(voteCount) || voteCount <= 0) return null;
  return { source: "imdb", average, voteCount };
}

/** Récupère une note IMDb exacte par identifiant, sans jamais exposer la clé. */
export async function getOmdbRating(imdbId: string): Promise<PublicRating | null> {
  const key = apiKey();
  if (!key || !/^tt\d{5,12}$/.test(imdbId)) return null;

  return ratingCache.getOrSet(imdbId, async () => {
    const url = new URL(OMDB_API_BASE);
    url.searchParams.set("apikey", key);
    url.searchParams.set("i", imdbId);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(4_000),
      next: { revalidate: 604_800 },
    });
    if (!response.ok) throw new Error(`OMDb ${response.status}`);
    return parseRating((await response.json()) as OmdbResponse);
  });
}

/** Enrichit uniquement les œuvres finales affichées, avec concurrence bornée. */
export async function enrichWithOmdbRatings(candidates: Candidate[]): Promise<Candidate[]> {
  if (!apiKey()) return candidates;
  return mapLimit(candidates, 3, async (candidate) => {
    if (!candidate.imdbId) return candidate;
    try {
      const publicRating = await getOmdbRating(candidate.imdbId);
      return publicRating ? { ...candidate, publicRating } : candidate;
    } catch {
      return candidate;
    }
  });
}
