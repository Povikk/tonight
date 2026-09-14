/**
 * Mapping TMDB → modèle interne.
 * Toute la laideur de l'API est confinée ici : le reste de TONIGHT ne manipule
 * que des `Candidate`.
 */

import type { Candidate, MediaType, MonetizationType, ProviderAvailability } from "@/types/tonight";
import type {
  TmdbMovieDetails,
  TmdbMovieListItem,
  TmdbTvDetails,
  TmdbTvListItem,
  TmdbWatchProvider,
  TmdbWatchProviderAvailability,
} from "@/types/tmdb";
import { GENRE_NAMES_FR, TMDB_REGION, genreName } from "@/utils/constants";

function yearFromDate(date: string | null | undefined): number | null {
  if (!date || date.length < 4) return null;
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) && year > 1800 ? year : null;
}

function genreIdsOf(item: { genre_ids?: number[]; genres?: Array<{ id: number }> }): number[] {
  if (item.genre_ids?.length) return item.genre_ids;
  if (item.genres?.length) return item.genres.map((genre) => genre.id);
  return [];
}

export interface CandidateExtras {
  /** Slugs de keywords déduits d'une recherche par mood (mode TMDB). */
  keywordSlugs?: string[];
  providers?: ProviderAvailability[];
  /** Les champs détaillés sont-ils autoritaires ? (vrai après enrichissement) */
  verified?: boolean;
}

/** Convertit un film TMDB (liste ou détail) en `Candidate`. */
export function toMovieCandidate(raw: TmdbMovieListItem | TmdbMovieDetails, extras: CandidateExtras = {}): Candidate {
  const genres = genreIdsOf(raw);
  return {
    id: raw.id,
    mediaType: "movie",
    title: raw.title || raw.original_title || "Titre inconnu",
    originalTitle: raw.original_title || raw.title || "",
    year: yearFromDate(raw.release_date),
    endYear: null,
    runtime: raw.runtime ?? null,
    episodeRuntime: null,
    seasons: null,
    episodes: null,
    status: raw.status ?? null,
    genres,
    genreNames: genres.map(genreName),
    keywordSlugs: extras.keywordSlugs ?? [],
    overview: raw.overview ?? "",
    voteAverage: raw.vote_average ?? 0,
    voteCount: raw.vote_count ?? 0,
    popularity: raw.popularity ?? 0,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    originalLanguage: raw.original_language ?? "",
    originCountry: (raw as TmdbMovieDetails).production_countries?.map((c) => c.iso_3166_1) ?? [],
    director: null,
    creators: [],
    cast: [],
    providers: extras.providers ?? [],
    // `discover` / `search` ne renvoient ni durée ni plateformes : non vérifié.
    verified: extras.verified ?? false,
  };
}

/** Convertit une série TMDB (liste ou détail) en `Candidate`. */
export function toTvCandidate(raw: TmdbTvListItem | TmdbTvDetails, extras: CandidateExtras = {}): Candidate {
  const genres = genreIdsOf(raw);
  const episodeRuntime = raw.episode_run_time?.find((value) => value > 0) ?? null;
  return {
    id: raw.id,
    mediaType: "tv",
    title: raw.name || raw.original_name || "Titre inconnu",
    originalTitle: raw.original_name || raw.name || "",
    year: yearFromDate(raw.first_air_date),
    endYear: yearFromDate(raw.last_air_date),
    runtime: null,
    episodeRuntime,
    seasons: raw.number_of_seasons ?? null,
    episodes: raw.number_of_episodes ?? null,
    status: raw.status ?? null,
    genres,
    genreNames: genres.map(genreName),
    keywordSlugs: extras.keywordSlugs ?? [],
    overview: raw.overview ?? "",
    voteAverage: raw.vote_average ?? 0,
    voteCount: raw.vote_count ?? 0,
    popularity: raw.popularity ?? 0,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    originalLanguage: raw.original_language ?? "",
    originCountry: raw.origin_country ?? [],
    director: null,
    creators: (raw as TmdbTvDetails).created_by?.map((person) => person.name) ?? [],
    cast: [],
    providers: extras.providers ?? [],
    verified: extras.verified ?? false,
  };
}

/** Ajoute le réalisateur et le casting principal (issus de `credits`). */
export function withCredits(movie: Candidate, details: TmdbMovieDetails): Candidate {
  const crew = details.credits?.crew ?? [];
  const director = crew.find((person) => person.job === "Director")?.name ?? null;
  const cast = (details.credits?.cast ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .slice(0, 6)
    .map((person) => person.name);
  return { ...movie, director, cast };
}

export function withTvCredits(series: Candidate, details: TmdbTvDetails): Candidate {
  const source = details.aggregate_credits ?? details.credits;
  const cast = (source?.cast ?? []).slice(0, 6).map((person) => person.name);
  return { ...series, cast };
}

/** Extrait les disponibilités FR depuis `watch/providers`. */
export function providersFromAvailability(
  payload: TmdbWatchProviderAvailability | undefined,
  region = TMDB_REGION,
): ProviderAvailability[] {
  const entry = payload?.results?.[region];
  if (!entry) return [];
  const buckets: Array<[MonetizationType, TmdbWatchProvider[] | undefined]> = [
    ["flatrate", entry.flatrate],
    ["free", entry.free],
    ["ads", entry.ads],
    ["rent", entry.rent],
    ["buy", entry.buy],
  ];
  const availability: ProviderAvailability[] = [];
  const seen = new Set<string>();
  for (const [monetization, providers] of buckets) {
    for (const provider of providers ?? []) {
      const key = `${provider.provider_id}:${monetization}`;
      if (seen.has(key)) continue;
      seen.add(key);
      availability.push({
        providerId: provider.provider_id,
        name: provider.provider_name,
        logoPath: provider.logo_path,
        monetization,
        link: entry.link ?? null,
      });
    }
  }
  return availability;
}

/** Le nom d'un genre, même si TMDB ne le fournit pas (mode démo). */
export function fallbackGenreName(id: number): string {
  return GENRE_NAMES_FR[id] ?? genreName(id);
}

export function mediaTypeOf(candidate: Candidate): MediaType {
  return candidate.mediaType;
}
