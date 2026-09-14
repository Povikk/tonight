/** Fiches détaillées : films et séries (crédits, keywords, plateformes, bandes-annonces). */

import type { CandidateDetails } from "@/types/tonight";
import type { TmdbMovieDetails, TmdbTvDetails } from "@/types/tmdb";
import { TMDB_LANGUAGE } from "@/utils/constants";
import { pickTrailer } from "@/utils/trailers";
import {
  providersFromAvailability,
  toMovieCandidate,
  toTvCandidate,
  withCredits,
  withTvCredits,
} from "./mappers";
import { tmdbFetch } from "./client";

/** Fiche film complète. */
export async function getMovieDetails(id: number): Promise<CandidateDetails> {
  const payload = await tmdbFetch<TmdbMovieDetails>(
    `/movie/${id}`,
    { append_to_response: "credits,keywords,watch/providers,similar,videos" },
    { revalidate: 86_400 },
  );

  const base = withCredits(toMovieCandidate(payload), payload);
  const similar = (payload.similar?.results ?? [])
    .slice(0, 12)
    .map((item) => toMovieCandidate(item));

  return {
    ...base,
    tagline: payload.tagline ?? null,
    genresDetailed: (payload.genres ?? []).map((genre) => ({ id: genre.id, name: genre.name })),
    countries: payload.production_countries?.map((country) => country.iso_3166_1) ?? [],
    spokenLanguages: payload.spoken_languages?.map((lang) => lang.name ?? lang.iso_639_1) ?? [],
    providers: providersFromAvailability(payload["watch/providers"]),
    keywordSlugs: (payload.keywords?.keywords ?? []).map((keyword) => keyword.name),
    trailer: pickTrailer(payload.videos?.results, TMDB_LANGUAGE.slice(0, 2)),
    similar,
  };
}

/** Fiche série complète. */
export async function getSeriesDetails(id: number): Promise<CandidateDetails> {
  const payload = await tmdbFetch<TmdbTvDetails>(
    `/tv/${id}`,
    { append_to_response: "credits,aggregate_credits,keywords,watch/providers,similar,videos" },
    { revalidate: 86_400 },
  );

  const base = withTvCredits(toTvCandidate(payload), payload);
  const similar = (payload.similar?.results ?? [])
    .slice(0, 12)
    .map((item) => toTvCandidate(item));

  return {
    ...base,
    tagline: payload.tagline ?? null,
    genresDetailed: (payload.genres ?? []).map((genre) => ({ id: genre.id, name: genre.name })),
    countries: payload.production_countries?.map((country) => country.iso_3166_1) ?? [],
    spokenLanguages: payload.spoken_languages?.map((lang) => lang.name ?? lang.iso_639_1) ?? [],
    providers: providersFromAvailability(payload["watch/providers"]),
    keywordSlugs: (payload.keywords?.results ?? []).map((keyword) => keyword.name),
    trailer: pickTrailer(payload.videos?.results, TMDB_LANGUAGE.slice(0, 2)),
    similar,
  };
}
