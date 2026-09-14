/**
 * Types bruts renvoyés par l'API TMDB (v3).
 * On ne modélise que ce que TONIGHT consomme réellement.
 * https://developer.themoviedb.org/reference/intro/getting-started
 */

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country?: string;
}

export interface TmdbCountry {
  iso_3166_1: string;
  name?: string;
}

export interface TmdbSpokenLanguage {
  english_name?: string;
  iso_639_1: string;
  name?: string;
}

/** Résultat de `discover/movie` ou d'une liste de films. */
export interface TmdbMovieListItem {
  id: number;
  title: string;
  original_title: string;
  overview: string | null;
  release_date: string | null;
  genre_ids?: number[];
  genres?: TmdbGenre[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  poster_path: string | null;
  backdrop_path: string | null;
  original_language: string;
  adult?: boolean;
  runtime?: number | null;
  status?: string;
}

/** Résultat de `discover/tv`, `tv/popular`, … */
export interface TmdbTvListItem {
  id: number;
  name: string;
  original_name: string;
  overview: string | null;
  first_air_date: string | null;
  last_air_date?: string | null;
  genre_ids?: number[];
  genres?: TmdbGenre[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  poster_path: string | null;
  backdrop_path: string | null;
  original_language: string;
  origin_country?: string[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  episode_run_time?: number[];
  seasons?: TmdbSeasonSummary[];
}

export interface TmdbSeasonSummary {
  id: number;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  name: string;
}

export interface TmdbPaged<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbCredits<T> {
  id: number;
  cast: Array<{
    id: number;
    name: string;
    character?: string;
    order?: number;
    profile_path?: string | null;
  }>;
  crew: Array<{
    id: number;
    name: string;
    job?: string;
    department?: string;
    profile_path?: string | null;
  }>;
}

export interface TmdbCreatedBy {
  id: number;
  name: string;
  profile_path?: string | null;
}

/**
 * `videos.results[]` : bandes-annonces, teasers et extraits.
 * `key` est l'identifiant YouTube ; `site` vaut « YouTube » dans la pratique.
 */
export interface TmdbVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
  iso_639_1?: string;
  published_at?: string;
  size?: number;
}

export interface TmdbMovieDetails extends TmdbMovieListItem {
  runtime: number | null;
  tagline: string | null;
  status: string;
  budget?: number;
  revenue?: number;
  production_countries?: TmdbCountry[];
  spoken_languages?: TmdbSpokenLanguage[];
  credits?: TmdbCredits<"movie">;
  keywords?: { keywords: TmdbKeyword[] };
  similar?: TmdbPaged<TmdbMovieListItem>;
  videos?: { results: TmdbVideo[] };
  "watch/providers"?: TmdbWatchProviderAvailability;
}

/**
 * Dernier / prochain épisode : sert de repli pour la durée d'un épisode.
 *
 * `episode_run_time` est VIDE pour une grande partie des séries (vérifié en
 * direct : Gravity Falls, Rick et Morty, Breaking Bad, Severance…), alors que
 * `last_episode_to_air.runtime` porte la vraie valeur. Sans ce repli, la
 * contrainte « épisodes d'environ 30 minutes » n'était pas évaluable.
 */
export interface TmdbEpisodeSummary {
  runtime?: number | null;
  episode_number?: number;
  season_number?: number;
  air_date?: string | null;
}

export interface TmdbTvDetails extends TmdbTvListItem {
  tagline: string | null;
  created_by?: TmdbCreatedBy[];
  episode_run_time?: number[];
  last_episode_to_air?: TmdbEpisodeSummary | null;
  next_episode_to_air?: TmdbEpisodeSummary | null;
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  in_production?: boolean;
  production_countries?: TmdbCountry[];
  spoken_languages?: TmdbSpokenLanguage[];
  credits?: TmdbCredits<"tv">;
  aggregate_credits?: TmdbCredits<"tv">;
  keywords?: { results: TmdbKeyword[] };
  similar?: TmdbPaged<TmdbTvListItem>;
  videos?: { results: TmdbVideo[] };
  "watch/providers"?: TmdbWatchProviderAvailability;
}

export interface TmdbKeyword {
  id: number;
  name: string;
}

/** `watch/providers/movie|tv` : catalogue des plateformes disponibles dans un pays. */
export interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
  display_priority: number;
  logo_path: string | null;
}

export interface TmdbWatchProviderResponse {
  results: TmdbWatchProvider[];
}

/** `movie/{id}/watch/providers` (disponibilités par pays). */
export interface TmdbWatchProviderAvailability {
  id?: number;
  results: Record<
    string,
    {
      link?: string;
      flatrate?: TmdbWatchProvider[];
      free?: TmdbWatchProvider[];
      ads?: TmdbWatchProvider[];
      rent?: TmdbWatchProvider[];
      buy?: TmdbWatchProvider[];
    }
  >;
}

export interface TmdbVideo {
  id: string;
  key: string;
  site: string;
  type: string;
  name: string;
  official?: boolean;
}
