/** Recherche manuelle classique (exigence §54). */

import type { Candidate } from "@/types/tonight";
import type { TmdbMovieListItem, TmdbPaged, TmdbTvListItem } from "@/types/tmdb";
import { tmdbFetch } from "./client";
import { toMovieCandidate, toTvCandidate } from "./mappers";

export async function searchMovies(query: string, page = 1): Promise<Candidate[]> {
  if (!query.trim()) return [];
  const payload = await tmdbFetch<TmdbPaged<TmdbMovieListItem>>(
    "/search/movie",
    { query, page, include_adult: false, region: "FR" },
    { revalidate: 600 },
  );
  return payload.results.map((item) => toMovieCandidate(item));
}

export async function searchSeries(query: string, page = 1): Promise<Candidate[]> {
  if (!query.trim()) return [];
  const payload = await tmdbFetch<TmdbPaged<TmdbTvListItem>>(
    "/search/tv",
    { query, page, include_adult: false },
    { revalidate: 600 },
  );
  return payload.results.map((item) => toTvCandidate(item));
}

/** Recherche films + séries fusionnés, triés par pertinence « TONIGHT ». */
export async function searchBoth(query: string): Promise<Candidate[]> {
  const [movies, series] = await Promise.all([searchMovies(query), searchSeries(query)]);
  return [...movies, ...series].sort((a, b) => b.popularity - a.popularity);
}
