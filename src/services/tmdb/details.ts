/** Fiches détaillées : films et séries (crédits, keywords, plateformes, bandes-annonces). */

import type { CandidateDetails, MediaType, TrailerInfo } from "@/types/tonight";
import type { TmdbMovieDetails, TmdbTvDetails, TmdbVideo } from "@/types/tmdb";
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

interface TmdbVideosResponse {
  results?: TmdbVideo[];
}

/** Langues principales utilisées comme repli par l'endpoint `/videos`. */
const ORIGINAL_LANGUAGE_TAG: Record<string, string> = {
  de: "de-DE",
  es: "es-ES",
  it: "it-IT",
  ja: "ja-JP",
  ko: "ko-KR",
  pt: "pt-BR",
  zh: "zh-CN",
};

/**
 * `append_to_response=videos` hérite de `language=fr-FR` et peut donc être
 * vide alors que la fiche TMDB possède une vidéo anglaise ou en langue
 * originale. On interroge ces langues uniquement si le premier lot ne
 * contient rien de lisible.
 */
async function resolveTrailer(
  mediaType: MediaType,
  id: number,
  localizedVideos: TmdbVideo[] | undefined,
  originalLanguage: string | undefined,
): Promise<TrailerInfo | null> {
  const localized = pickTrailer(localizedVideos, TMDB_LANGUAGE.slice(0, 2));
  if (localized) return localized;

  const languages = new Set(["en-US"]);
  const original = originalLanguage?.toLowerCase();
  if (original && original !== "fr" && original !== "en") {
    languages.add(ORIGINAL_LANGUAGE_TAG[original] ?? original);
  }

  const responses = await Promise.all(
    [...languages].map((language) =>
      tmdbFetch<TmdbVideosResponse>(
        `/${mediaType}/${id}/videos`,
        {},
        { language, revalidate: 86_400 },
      ).catch(() => ({ results: [] })),
    ),
  );

  const merged = new Map<string, TmdbVideo>();
  for (const video of [...(localizedVideos ?? []), ...responses.flatMap((item) => item.results ?? [])]) {
    merged.set(`${video.site}:${video.key}`, video);
  }
  return pickTrailer([...merged.values()], TMDB_LANGUAGE.slice(0, 2));
}

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
  const trailer = await resolveTrailer(
    "movie",
    id,
    payload.videos?.results,
    payload.original_language,
  );

  return {
    ...base,
    tagline: payload.tagline ?? null,
    genresDetailed: (payload.genres ?? []).map((genre) => ({ id: genre.id, name: genre.name })),
    countries: payload.production_countries?.map((country) => country.iso_3166_1) ?? [],
    spokenLanguages: payload.spoken_languages?.map((lang) => lang.name ?? lang.iso_639_1) ?? [],
    providers: providersFromAvailability(payload["watch/providers"]),
    keywordSlugs: (payload.keywords?.keywords ?? []).map((keyword) => keyword.name),
    trailer,
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
  const trailer = await resolveTrailer(
    "tv",
    id,
    payload.videos?.results,
    payload.original_language,
  );

  return {
    ...base,
    tagline: payload.tagline ?? null,
    genresDetailed: (payload.genres ?? []).map((genre) => ({ id: genre.id, name: genre.name })),
    countries: payload.production_countries?.map((country) => country.iso_3166_1) ?? [],
    spokenLanguages: payload.spoken_languages?.map((lang) => lang.name ?? lang.iso_639_1) ?? [],
    providers: providersFromAvailability(payload["watch/providers"]),
    keywordSlugs: (payload.keywords?.results ?? []).map((keyword) => keyword.name),
    trailer,
    similar,
  };
}
