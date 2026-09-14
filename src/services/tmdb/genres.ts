/** Genres et catalogue de plateformes (région FR). */

import type { TmdbGenre, TmdbWatchProvider, TmdbWatchProviderResponse } from "@/types/tmdb";
import { TMDB_WATCH_REGION } from "@/utils/constants";
import { tmdbFetch } from "./client";

export interface TmdbProviderInfo {
  providerId: number;
  name: string;
  logoPath: string | null;
  displayPriority: number;
}

export async function getGenres(mediaType: "movie" | "tv"): Promise<TmdbGenre[]> {
  const payload = await tmdbFetch<{ genres: TmdbGenre[] }>(
    `/genre/${mediaType}/list`,
    {},
    { revalidate: 604_800 }, // les genres ne bougent pas : 7 jours
  );
  return payload.genres;
}

/**
 * Plateformes disponibles en France.
 * On ne hardcode PAS la liste : elle vient de TMDB (§22).
 */
export async function getProviders(mediaType: "movie" | "tv"): Promise<TmdbProviderInfo[]> {
  const payload = await tmdbFetch<TmdbWatchProviderResponse>(
    `/watch/providers/${mediaType}`,
    { watch_region: TMDB_WATCH_REGION },
    { revalidate: 604_800 },
  );
  return payload.results
    .map((provider: TmdbWatchProvider) => ({
      providerId: provider.provider_id,
      name: provider.provider_name,
      logoPath: provider.logo_path,
      displayPriority: provider.display_priority,
    }))
    .sort((a, b) => a.displayPriority - b.displayPriority);
}
