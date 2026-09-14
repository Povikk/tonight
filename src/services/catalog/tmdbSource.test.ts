/**
 * Tests du mode TMDB « en vraie grandeur » (§4, §32, §37).
 *
 * Aucun token n'est nécessaire : on installe un FAUX SERVEUR TMDB, mais un faux
 * FIDÈLE. C'est le point capital : `discover/movie` et `discover/tv` ne
 * renvoient NI la durée d'un film, NI le nombre de saisons, NI le statut d'une
 * série, NI les plateformes. Ces informations n'arrivent que par
 * `/movie/{id}` et `/tv/{id}`.
 *
 * Ces fixtures reproduisent cette asymétrie : si l'enrichissement de
 * `tmdbSource.buildPool` disparaissait, les tests de contraintes dures
 * (durée, saisons, statut, plateformes) échoueraient immédiatement.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import { recommend } from "@/recommendation/engine";
import type { RecommendationContext } from "@/types/tonight";

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const NETFLIX = 8;
const PRIME = 9;
const DISNEY = 337;
const CANAL = 381;

const PROVIDER_NAMES: Record<number, string> = {
  [NETFLIX]: "Netflix",
  [PRIME]: "Amazon Prime Video",
  [DISNEY]: "Disney Plus",
  [CANAL]: "Canal Plus",
};

/**
 * Keywords TMDB avec leurs identifiants RÉELS.
 *
 * Le faux serveur s'aligne sur la vraie API jusque dans les détails qui ont
 * causé des bugs en production : la recherche de keyword est FLOUE (elle
 * renvoie des voisins), et c'est le client qui doit exiger une correspondance
 * exacte. Les noms ci-dessous sont ceux que les moods demandent réellement
 * (voir `data/moods.ts`).
 */
const KEYWORDS: Record<string, number> = {
  heartwarming: 319357,
  uplifting: 334465,
  feelgood: 275276,
  comfort: 308158,
  lighthearted: 288816,
  // Keywords de FORMAT, utilisés quand `discover/tv` ne sait pas filtrer
  // (nombre de saisons, durée d'épisode).
  miniseries: 11162,
  sitcom: 193171,
  "mind bending": 362567,
  romance: 9840,
  "love story": 244886,
  satire: 8201,
  comedy: 322268,
  funny: 377102,
  humour: 340900,
};

interface FakeMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  portrait: string | null;
  backdrop: string | null;
  original_language: string;
  country: string;
  runtime: number;
  providers: number[];
  keywords: string[];
}

interface FakeSeries {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  last_air_date: string | null;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  portrait: string | null;
  backdrop: string | null;
  original_language: string;
  origin_country: string[];
  number_of_seasons: number;
  number_of_episodes: number;
  /** Souvent VIDE chez TMDB : sert à tester le repli sur le dernier épisode. */
  episode_run_time: number[];
  /** Durée réelle du dernier épisode (repli quand `episode_run_time` est vide). */
  last_episode_runtime?: number;
  status: string;
  providers: number[];
  keywords: string[];
}

const MOVIES: FakeMovie[] = [
  {
    id: 501, title: "Palm Springs", original_title: "Palm Springs", overview: "Une boucle temporelle à un mariage.",
    release_date: "2020-07-10", genre_ids: [35, 10749], vote_average: 7.4, vote_count: 3200, popularity: 42,
    portrait: "/palm.jpg", backdrop: "/palm-b.jpg", original_language: "en", country: "US", runtime: 90,
    providers: [NETFLIX], keywords: ["heartwarming"],
  },
  {
    id: 502, title: "Le Grand Bain", original_title: "Sink or Swim", overview: "Des quadras montent une équipe de natation synchronisée.",
    release_date: "2018-10-24", genre_ids: [35, 18], vote_average: 7.2, vote_count: 1800, popularity: 21,
    portrait: "/bain.jpg", backdrop: "/bain-b.jpg", original_language: "fr", country: "FR", runtime: 122,
    providers: [CANAL], keywords: ["heartwarming"],
  },
  {
    id: 503, title: "Mystère à la nuit tombante", original_title: "Nightfall Mystery", overview: "Une enquête étrange dans un village isolé.",
    release_date: "1996-03-15", genre_ids: [9648, 878], vote_average: 8.1, vote_count: 2600, popularity: 18,
    portrait: "/night.jpg", backdrop: "/night-b.jpg", original_language: "en", country: "US", runtime: 95,
    providers: [PRIME], keywords: ["mind bending"],
  },
  {
    id: 504, title: "Horreur au sous-sol", original_title: "Basement", overview: "Quelque chose vit en dessous.",
    release_date: "2019-10-31", genre_ids: [27], vote_average: 6.4, vote_count: 900, popularity: 25,
    portrait: "/basement.jpg", backdrop: "/basement-b.jpg", original_language: "en", country: "US", runtime: 101,
    providers: [NETFLIX], keywords: [],
  },
  {
    id: 505, title: "Trop long mais culte", original_title: "Too Long But Loved", overview: "Une fresque interminable.",
    release_date: "2015-05-05", genre_ids: [18, 36], vote_average: 8.6, vote_count: 5400, popularity: 30,
    portrait: "/long.jpg", backdrop: "/long-b.jpg", original_language: "en", country: "US", runtime: 186,
    providers: [NETFLIX], keywords: [],
  },
  {
    id: 506, title: "Beau et récent", original_title: "Beautiful and New", overview: "Un drame lumineux tourné en Islande.",
    release_date: "2022-09-02", genre_ids: [10749, 18], vote_average: 7.9, vote_count: 1400, popularity: 26,
    portrait: "/beau.jpg", backdrop: "/beau-b.jpg", original_language: "fr", country: "FR", runtime: 108,
    providers: [DISNEY], keywords: ["romance"],
  },
  {
    id: 507, title: "Comédie légère", original_title: "Light Comedy", overview: "Deux voisins qui se détestent puis s'adorent.",
    release_date: "2021-01-20", genre_ids: [35, 10749], vote_average: 7.1, vote_count: 2100, popularity: 35,
    portrait: "/legere.jpg", backdrop: "/legere-b.jpg", original_language: "en", country: "US", runtime: 98,
    providers: [NETFLIX], keywords: ["heartwarming"],
  },
  {
    id: 508, title: "Vieille pépite", original_title: "Old Gem", overview: "Un western oublié.",
    release_date: "1968-06-01", genre_ids: [37, 18], vote_average: 8.4, vote_count: 700, popularity: 7,
    portrait: "/gem.jpg", backdrop: "/gem-b.jpg", original_language: "en", country: "US", runtime: 141,
    providers: [PRIME], keywords: [],
  },
  {
    id: 509, title: "Animation familiale", original_title: "Family Animation", overview: "Une petite fille et son dragon.",
    release_date: "2023-04-05", genre_ids: [16, 10751, 12], vote_average: 8.0, vote_count: 3100, popularity: 48,
    portrait: "/anim.jpg", backdrop: "/anim-b.jpg", original_language: "en", country: "US", runtime: 96,
    providers: [DISNEY], keywords: ["heartwarming"],
  },
  {
    id: 510, title: "Thriller des années 90", original_title: "Nineties Thriller", overview: "Un journaliste remonte une affaire classée.",
    release_date: "1997-11-14", genre_ids: [53, 80], vote_average: 7.6, vote_count: 2400, popularity: 15,
    portrait: "/thrill.jpg", backdrop: "/thrill-b.jpg", original_language: "en", country: "US", runtime: 116,
    providers: [CANAL], keywords: [],
  },
];

const SERIES: FakeSeries[] = [
  {
    id: 701, name: "Petite Série Feel-Good", original_name: "Small Feel-Good Show", overview: "Un club de lecture qui sauve des vies.",
    first_air_date: "2020-02-14", last_air_date: "2021-03-01", genre_ids: [35], vote_average: 8.5, vote_count: 1900,
    popularity: 28, portrait: "/p701.jpg", backdrop: "/p701-b.jpg", original_language: "en", origin_country: ["US"],
    number_of_seasons: 2, number_of_episodes: 16, episode_run_time: [28], status: "Ended",
    providers: [NETFLIX], keywords: ["heartwarming"],
  },
  {
    id: 702, name: "Saga Interminable", original_name: "Endless Saga", overview: "Quinze saisons de passions.",
    first_air_date: "2009-09-01", last_air_date: "2024-05-30", genre_ids: [18, 10749], vote_average: 7.8, vote_count: 4100,
    popularity: 33, portrait: "/p702.jpg", backdrop: "/p702-b.jpg", original_language: "en", origin_country: ["US"],
    number_of_seasons: 15, number_of_episodes: 320, episode_run_time: [43], status: "Returning Series",
    providers: [NETFLIX], keywords: ["romance"],
  },
  {
    id: 703, name: "Mini-Série Serrée", original_name: "Tight Miniseries", overview: "Quatre épisodes, une seule nuit.",
    first_air_date: "2019-01-11", last_air_date: "2019-02-01", genre_ids: [80, 9648], vote_average: 8.2, vote_count: 1200,
    popularity: 17, portrait: "/p703.jpg", backdrop: "/p703-b.jpg", original_language: "fr", origin_country: ["FR"],
    number_of_seasons: 1, number_of_episodes: 4, episode_run_time: [52], status: "Ended",
    providers: [CANAL], keywords: ["mind bending"],
  },
  {
    id: 704, name: "Annulée Sans Fin", original_name: "Cancelled No Ending", overview: "Deux saisons puis plus rien.",
    first_air_date: "2018-06-01", last_air_date: "2019-08-01", genre_ids: [878, 18], vote_average: 8.3, vote_count: 950,
    popularity: 14, portrait: "/p704.jpg", backdrop: "/p704-b.jpg", original_language: "en", origin_country: ["GB"],
    number_of_seasons: 2, number_of_episodes: 12, episode_run_time: [45], status: "Canceled",
    providers: [PRIME], keywords: ["heartwarming"],
  },
  {
    id: 705, name: "Série Confortable Longue", original_name: "Cosy Long Show", overview: "Un cabinet médical de campagne.",
    first_air_date: "2012-03-04", last_air_date: "2022-12-20", genre_ids: [18, 35], vote_average: 8.0, vote_count: 2200,
    popularity: 24, portrait: "/p705.jpg", backdrop: "/p705-b.jpg", original_language: "en", origin_country: ["US"],
    number_of_seasons: 8, number_of_episodes: 150, episode_run_time: [42], status: "Ended",
    providers: [DISNEY], keywords: ["heartwarming"],
  },
  {
    id: 706, name: "Policier Français", original_name: "French Cop Show", overview: "Une brigade parisienne.",
    first_air_date: "2016-10-06", last_air_date: "2021-11-18", genre_ids: [80, 18], vote_average: 8.1, vote_count: 1100,
    popularity: 16, portrait: "/p706.jpg", backdrop: "/p706-b.jpg", original_language: "fr", origin_country: ["FR"],
    number_of_seasons: 4, number_of_episodes: 32, episode_run_time: [52], status: "Ended",
    providers: [NETFLIX], keywords: [],
  },
  {
    id: 707, name: "Épisodes Courts Récente", original_name: "Short Episodes Recent", overview: "Une coloc sous tension.",
    first_air_date: "2023-05-10", last_air_date: null, genre_ids: [35, 18], vote_average: 7.7, vote_count: 640,
    popularity: 22, portrait: "/p707.jpg", backdrop: "/p707-b.jpg", original_language: "fr", origin_country: ["FR"],
    number_of_seasons: 2, number_of_episodes: 16, episode_run_time: [24], status: "Returning Series",
    providers: [PRIME], keywords: ["heartwarming"],
  },
  {
    id: 708, name: "Documentaire Nature", original_name: "Nature Doc", overview: "La planète filmée au plus près.",
    first_air_date: "2015-11-01", last_air_date: "2015-12-06", genre_ids: [99, 10751], vote_average: 9.0, vote_count: 1600,
    popularity: 12, portrait: "/p708.jpg", backdrop: "/p708-b.jpg", original_language: "en", origin_country: ["GB"],
    number_of_seasons: 1, number_of_episodes: 6, episode_run_time: [50], status: "Ended",
    providers: [DISNEY], keywords: ["heartwarming"],
  },
  {
    id: 709, name: "Deux Saisons Terminées", original_name: "Two Seasons Done", overview: "Un duo d'improvisateurs montréalais.",
    first_air_date: "2018-03-08", last_air_date: "2019-04-12", genre_ids: [35], vote_average: 8.3, vote_count: 1300,
    popularity: 20, portrait: "/p709.jpg", backdrop: "/p709-b.jpg", original_language: "fr", origin_country: ["FR"],
    number_of_seasons: 2, number_of_episodes: 20, episode_run_time: [26], status: "Ended",
    providers: [NETFLIX], keywords: ["heartwarming"],
  },
  {
    id: 710, name: "Mini-Série Douce", original_name: "Sweet Miniseries", overview: "Un été dans le sud de la France.",
    first_air_date: "2021-06-20", last_air_date: "2021-07-11", genre_ids: [35, 10749], vote_average: 7.9, vote_count: 880,
    popularity: 19, portrait: "/p710.jpg", backdrop: "/p710-b.jpg", original_language: "fr", origin_country: ["FR"],
    number_of_seasons: 1, number_of_episodes: 6, episode_run_time: [30], status: "Ended",
    providers: [NETFLIX], keywords: ["romance", "heartwarming", "miniseries"],
  },
  {
    // Cas RÉEL chez TMDB : `episode_run_time` vide. La durée n'est alors
    // récupérable que via le dernier épisode diffusé.
    id: 712, name: "Durée Seulement Sur Le Dernier Épisode", original_name: "Runtime Only On Last Episode",
    overview: "Un quatuor d'amis dans une petite ville.",
    first_air_date: "2019-02-14", last_air_date: "2020-03-06", genre_ids: [35], vote_average: 8.0, vote_count: 900,
    popularity: 17, portrait: "/p712.jpg", backdrop: "/p712-b.jpg", original_language: "en", origin_country: ["US"],
    number_of_seasons: 2, number_of_episodes: 18, episode_run_time: [], last_episode_runtime: 27, status: "Ended",
    providers: [PRIME], keywords: [],
  },
  {
    id: 711, name: "Courte Et Terminée", original_name: "Short And Done", overview: "Une coloc britannique pleine d'espoir.",
    first_air_date: "2017-09-05", last_air_date: "2018-10-09", genre_ids: [35, 18], vote_average: 8.1, vote_count: 1500,
    popularity: 18, portrait: "/p711.jpg", backdrop: "/p711-b.jpg", original_language: "en", origin_country: ["GB"],
    number_of_seasons: 2, number_of_episodes: 12, episode_run_time: [29], status: "Ended",
    providers: [PRIME], keywords: ["heartwarming"],
  },
];

/* -------------------------------------------------------------------------- */
/* Faux serveur TMDB                                                          */
/* -------------------------------------------------------------------------- */

const PAGE_SIZE = 20;

type FakeMode = "ok" | "unauthorized" | "rate-limit-once";

interface FakeState {
  mode: FakeMode;
  calls: Array<{ path: string; params: URLSearchParams; authorized: boolean }>;
}

const state: FakeState = { mode: "ok", calls: [] };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Réponse « liste » : c'est ICI que se joue la fidélité au vrai TMDB. */
function movieListItem(movie: FakeMovie) {
  return {
    id: movie.id,
    title: movie.title,
    original_title: movie.original_title,
    overview: movie.overview,
    release_date: movie.release_date,
    genre_ids: movie.genre_ids,
    vote_average: movie.vote_average,
    vote_count: movie.vote_count,
    popularity: movie.popularity,
    poster_path: movie.portrait,
    backdrop_path: movie.backdrop,
    original_language: movie.original_language,
    adult: false,
    video: false,
    // VOLONTAIREMENT ABSENTS de discover : runtime, genres détaillés, plateformes.
  };
}

function seriesListItem(series: FakeSeries) {
  return {
    id: series.id,
    name: series.name,
    original_name: series.original_name,
    overview: series.overview,
    first_air_date: series.first_air_date,
    genre_ids: series.genre_ids,
    vote_average: series.vote_average,
    vote_count: series.vote_count,
    popularity: series.popularity,
    poster_path: series.portrait,
    backdrop_path: series.backdrop,
    original_language: series.original_language,
    origin_country: series.origin_country,
    // VOLONTAIREMENT ABSENTS : number_of_seasons, status, episode_run_time.
  };
}

function movieDetails(movie: FakeMovie) {
  return {
    ...movieListItem(movie),
    runtime: movie.runtime,
    status: "Released",
    tagline: null,
    genres: movie.genre_ids.map((id) => ({ id, name: `Genre ${id}` })),
    production_countries: [{ iso_3166_1: movie.country, name: movie.country }],
    "watch/providers": availability(movie.providers),
  };
}

function seriesDetails(series: FakeSeries) {
  return {
    ...seriesListItem(series),
    number_of_seasons: series.number_of_seasons,
    number_of_episodes: series.number_of_episodes,
    episode_run_time: series.episode_run_time,
    last_episode_to_air: series.last_episode_runtime
      ? { runtime: series.last_episode_runtime, episode_number: 1, season_number: series.number_of_seasons }
      : null,
    status: series.status,
    last_air_date: series.last_air_date,
    tagline: null,
    genres: series.genre_ids.map((id) => ({ id, name: `Genre ${id}` })),
    "watch/providers": availability(series.providers),
  };
}

function availability(providerIds: number[]) {
  return {
    results: {
      FR: {
        link: "https://www.themoviedb.org/movie/1/watch?locale=FR",
        flatrate: providerIds.map((id, index) => ({
          provider_id: id,
          provider_name: PROVIDER_NAMES[id] ?? `Provider ${id}`,
          logo_path: `/logo-${id}.png`,
          display_priority: index,
        })),
      },
    },
  };
}

function numbersFrom(param: string | null): number[] {
  if (!param) return [];
  return param.split("|").map((value) => Number.parseInt(value, 10)).filter(Number.isFinite);
}

/**
 * Nombre optionnel : `null` quand le paramètre est ABSENT.
 * Piège classique : `Number(null)` vaut 0, ce qui transformerait un filtre
 * absent en « <= 0 » et viderait tout le catalogue.
 */
function optionalNumber(param: string | null): number | null {
  if (param === null || param === "") return null;
  const value = Number(param);
  return Number.isFinite(value) ? value : null;
}

function normaliseKeyword(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchesKeywords(record: { keywords: string[] }, param: string | null): boolean {
  const ids = numbersFrom(param);
  if (!ids.length) return true;
  const names = ids
    .map((id) => Object.entries(KEYWORDS).find(([, value]) => value === id)?.[0])
    .filter((name): name is string => Boolean(name));
  return names.some((name) => record.keywords.includes(name));
}

function sortBy<T extends { popularity: number; vote_count: number; vote_average: number }>(
  items: T[],
  param: string,
  dateOf: (item: T) => string | null,
): T[] {
  const sorted = [...items];
  switch (param) {
    case "vote_average.desc":
      sorted.sort((a, b) => b.vote_average - a.vote_average || b.vote_count - a.vote_count);
      break;
    case "vote_count.desc":
      sorted.sort((a, b) => b.vote_count - a.vote_count);
      break;
    case "primary_release_date.desc":
    case "first_air_date.desc":
      sorted.sort((a, b) => String(dateOf(b)).localeCompare(String(dateOf(a))));
      break;
    default:
      sorted.sort((a, b) => b.popularity - a.popularity);
  }
  return sorted;
}

function discoverMovies(params: URLSearchParams): FakeMovie[] {
  let items = [...MOVIES];
  const withGenres = numbersFrom(params.get("with_genres"));
  if (withGenres.length) items = items.filter((m) => m.genre_ids.some((g) => withGenres.includes(g)));
  const without = numbersFrom(params.get("without_genres"));
  if (without.length) items = items.filter((m) => !m.genre_ids.some((g) => without.includes(g)));
  const minRuntime = optionalNumber(params.get("with_runtime.gte"));
  if (minRuntime !== null) items = items.filter((m) => m.runtime >= minRuntime);
  const maxRuntime = optionalNumber(params.get("with_runtime.lte"));
  if (maxRuntime !== null) items = items.filter((m) => m.runtime <= maxRuntime);
  const minDate = params.get("primary_release_date.gte");
  if (minDate) items = items.filter((m) => m.release_date >= minDate);
  const maxDate = params.get("primary_release_date.lte");
  if (maxDate) items = items.filter((m) => m.release_date <= maxDate);
  const minRating = optionalNumber(params.get("vote_average.gte"));
  if (minRating !== null) items = items.filter((m) => m.vote_average >= minRating);
  const minVotes = optionalNumber(params.get("vote_count.gte"));
  if (minVotes !== null) items = items.filter((m) => m.vote_count >= minVotes);
  const maxVotes = optionalNumber(params.get("vote_count.lte"));
  if (maxVotes !== null) items = items.filter((m) => m.vote_count <= maxVotes);
  const language = params.get("with_original_language");
  if (language) items = items.filter((m) => m.original_language === language);
  const country = params.get("with_origin_country");
  if (country) items = items.filter((m) => m.country === country);
  const providers = numbersFrom(params.get("with_watch_providers"));
  if (providers.length) items = items.filter((m) => m.providers.some((p) => providers.includes(p)));
  items = items.filter((m) => matchesKeywords(m, params.get("with_keywords")));
  return sortBy(items, params.get("sort_by") ?? "popularity.desc", (m) => m.release_date);
}

function discoverSeries(params: URLSearchParams): FakeSeries[] {
  let items = [...SERIES];
  const withGenres = numbersFrom(params.get("with_genres"));
  if (withGenres.length) items = items.filter((s) => s.genre_ids.some((g) => withGenres.includes(g)));
  const without = numbersFrom(params.get("without_genres"));
  if (without.length) items = items.filter((s) => !s.genre_ids.some((g) => without.includes(g)));
  // FIDÉLITÉ : `discover/tv` n'accepte PAS `with_runtime`. La vraie API répond
  // 200 en ignorant le paramètre (vérifié : une série de 57 min remonte avec
  // `with_runtime.lte=44`). On ne filtre donc rien ici, sans quoi les tests
  // valideraient une contrainte dure que TMDB ne sait pas appliquer.
  const minDate = params.get("first_air_date.gte");
  if (minDate) items = items.filter((s) => s.first_air_date >= minDate);
  const maxDate = params.get("first_air_date.lte");
  if (maxDate) items = items.filter((s) => s.first_air_date <= maxDate);
  const minRating = optionalNumber(params.get("vote_average.gte"));
  if (minRating !== null) items = items.filter((s) => s.vote_average >= minRating);
  const minVotes = optionalNumber(params.get("vote_count.gte"));
  if (minVotes !== null) items = items.filter((s) => s.vote_count >= minVotes);
  const maxVotes = optionalNumber(params.get("vote_count.lte"));
  if (maxVotes !== null) items = items.filter((s) => s.vote_count <= maxVotes);
  const language = params.get("with_original_language");
  if (language) items = items.filter((s) => s.original_language === language);
  const country = params.get("with_origin_country");
  if (country) items = items.filter((s) => s.origin_country.includes(country));
  const providers = numbersFrom(params.get("with_watch_providers"));
  if (providers.length) items = items.filter((s) => s.providers.some((p) => providers.includes(p)));
  items = items.filter((s) => matchesKeywords(s, params.get("with_keywords")));
  return sortBy(items, params.get("sort_by") ?? "popularity.desc", (s) => s.first_air_date);
}

let rateLimitBudget = 0;

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const params = url.searchParams;
  const authorized = Boolean(
    params.get("api_key") || (init?.headers && "Authorization" in (init.headers as Record<string, string>)),
  );
  state.calls.push({ path: url.pathname, params, authorized });

  if (!params.get("api_key") && !init?.headers) return json({ status_message: "Invalid API key" }, 401);
  if (state.mode === "unauthorized") return json({ status_message: "Invalid API key" }, 401);
  if (state.mode === "rate-limit-once" && rateLimitBudget > 0) {
    rateLimitBudget -= 1;
    return json({ status_message: "Too many requests" }, 429);
  }

  const path = url.pathname.replace(/^\/3/, "");

  if (path === "/discover/movie") {
    const items = discoverMovies(params);
    const page = Number(params.get("page") ?? 1);
    const slice = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return json({ page, results: slice.map(movieListItem), total_pages: Math.ceil(items.length / PAGE_SIZE), total_results: items.length });
  }
  if (path === "/discover/tv") {
    const items = discoverSeries(params);
    const page = Number(params.get("page") ?? 1);
    const slice = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return json({ page, results: slice.map(seriesListItem), total_pages: Math.ceil(items.length / PAGE_SIZE), total_results: items.length });
  }

  const movieMatch = /^\/movie\/(\d+)$/.exec(path);
  if (movieMatch) {
    const movie = MOVIES.find((entry) => entry.id === Number(movieMatch[1]));
    return movie ? json(movieDetails(movie)) : json({ status_message: "Not found" }, 404);
  }
  const tvMatch = /^\/tv\/(\d+)$/.exec(path);
  if (tvMatch) {
    const series = SERIES.find((entry) => entry.id === Number(tvMatch[1]));
    return series ? json(seriesDetails(series)) : json({ status_message: "Not found" }, 404);
  }
  const providerMatch = /^\/(movie|tv)\/(\d+)\/watch\/providers$/.exec(path);
  if (providerMatch) {
    const id = Number(providerMatch[2]);
    const record =
      providerMatch[1] === "movie"
        ? MOVIES.find((entry) => entry.id === id)
        : SERIES.find((entry) => entry.id === id);
    return record ? json(availability(record.providers)) : json({ results: {} });
  }

  if (path === "/search/movie") {
    const query = (params.get("query") ?? "").toLowerCase();
    return json({ page: 1, results: MOVIES.filter((m) => m.title.toLowerCase().includes(query)).map(movieListItem), total_pages: 1, total_results: 1 });
  }
  if (path === "/search/tv") {
    const query = (params.get("query") ?? "").toLowerCase();
    return json({ page: 1, results: SERIES.filter((s) => s.name.toLowerCase().includes(query)).map(seriesListItem), total_pages: 1, total_results: 1 });
  }
  if (path === "/search/keyword") {
    // Recherche FLOUE, comme TMDB : « comfort show » fait remonter « comfort »,
    // et « feel good » fait remonter « feel good music ». C'est au client de
    // refuser tout ce qui n'est pas exactement le libellé demandé.
    const query = normaliseKeyword(params.get("query") ?? "");
    const found = Object.entries(KEYWORDS)
      .filter(([name]) => {
        const normalised = normaliseKeyword(name);
        return normalised.includes(query) || query.includes(normalised);
      })
      .map(([name, id]) => ({ id, name }));
    return json({ page: 1, results: found, total_pages: 1, total_results: found.length });
  }

  if (path === "/genre/movie/list") {
    return json({ genres: [{ id: 35, name: "Comédie" }, { id: 18, name: "Drame" }, { id: 27, name: "Horreur" }] });
  }
  if (path === "/genre/tv/list") {
    return json({ genres: [{ id: 35, name: "Comédie" }, { id: 18, name: "Drame" }, { id: 99, name: "Documentaire" }] });
  }
  if (path === "/watch/providers/movie" || path === "/watch/providers/tv") {
    return json({
      results: Object.entries(PROVIDER_NAMES).map(([id, name], index) => ({
        provider_id: Number(id),
        provider_name: name,
        logo_path: `/logo-${id}.png`,
        display_priority: index,
      })),
    });
  }

  return json({ status_message: `Unknown fixture path ${path}` }, 404);
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

const emptyContext: RecommendationContext = {
  sessionExcluded: [],
  feedback: [],
  profile: null,
  allowRelaxation: true,
};

beforeAll(() => {
  process.env.TMDB_API_KEY = "cle-de-test-tonight";
  vi.stubGlobal("fetch", fakeFetch);
});

afterAll(() => {
  delete process.env.TMDB_API_KEY;
  vi.unstubAllGlobals();
});

beforeEach(() => {
  state.mode = "ok";
  state.calls = [];
  rateLimitBudget = 0;
});

describe("mode TMDB, découverte et enrichissement", () => {
  it("les listes `discover` ne portent ni durée ni saisons : l'enrichissement est donc obligatoire", async () => {
    const { getCatalog } = await import("./index");
    expect(getCatalog().mode).toBe("tmdb");

    const pool = await getCatalog().buildPool({
      mediaType: "movie",
      prefs: createEmptyPreferences("natural_language", { mediaType: "movie" }),
    });

    expect(pool.length).toBeGreaterThan(5);
    // Aucun film ne doit rester sans durée : sans enrichissement, ils vaudraient tous `null`.
    expect(pool.every((candidate) => candidate.runtime !== null)).toBe(true);
    // Les plateformes arrivent avec le même appel (`append_to_response`).
    expect(pool.every((candidate) => candidate.providers.length > 0)).toBe(true);
    expect(state.calls.some((call) => call.path.startsWith("/3/movie/"))).toBe(true);
  });

  it("enrichit aussi les séries (saisons, statut, durée d'épisode)", async () => {
    const { getCatalog } = await import("./index");
    const pool = await getCatalog().buildPool({
      mediaType: "tv",
      prefs: createEmptyPreferences("natural_language", { mediaType: "tv" }),
    });

    expect(pool.length).toBeGreaterThan(3);
    expect(pool.every((candidate) => candidate.seasons !== null)).toBe(true);
    expect(pool.every((candidate) => candidate.status !== null)).toBe(true);
    expect(pool.some((candidate) => candidate.episodeRuntime !== null)).toBe(true);
  });
});

describe("mode TMDB, contraintes DURES réellement appliquées", () => {
  it("« moins de 2h » retire les films trop longs", async () => {
    const preferences = createEmptyPreferences("natural_language", {
      mediaType: "movie",
      maxRuntime: 110,
      hardConstraints: ["mediaType", "maxRuntime"],
      confidence: 0.9,
    });

    const response = await recommend({ preferences, context: emptyContext, seed: 3 });
    const top = response.top;

    expect(top).not.toBeNull();
    expect(response.relaxations).toHaveLength(0);
    // Impossible à obtenir sans enrichissement : `discover` ne donne pas la durée.
    expect(top!.candidate.runtime).not.toBeNull();
    expect(top!.candidate.runtime!).toBeLessThanOrEqual(110);
    // Et le film culte de 3h06 n'a pas le droit de gagner.
    expect(top!.candidate.id).not.toBe(505);
  });

  it("« maximum 2 saisons » et « terminée » sont respectés sur une série", async () => {
    const preferences = createEmptyPreferences("natural_language", {
      mediaType: "tv",
      maxSeasons: 2,
      seriesStatus: "ended",
      hardConstraints: ["mediaType", "maxSeasons", "seriesEnded"],
      confidence: 0.9,
    });

    const response = await recommend({ preferences, context: emptyContext, seed: 4 });
    const top = response.top;

    expect(top).not.toBeNull();
    expect(response.relaxations).toHaveLength(0);
    expect((top!.candidate.seasons ?? 99) <= 2).toBe(true);
    expect(top!.candidate.status?.toLowerCase()).toContain("ended");
    // La saga de 15 saisons et la série annulée sont écartées.
    expect([702, 704]).not.toContain(top!.candidate.id);
  });

  it("assouplit en le DISANT quand trop peu d'œuvres correspondent (§37)", async () => {
    // Contraintes intenables : une seule série de 3 saisons existe avec ce genre.
    const preferences = createEmptyPreferences("natural_language", {
      mediaType: "tv",
      maxSeasons: 1,
      seriesStatus: "ended",
      genres: [99],
      hardConstraints: ["mediaType", "maxSeasons", "seriesEnded", "requireGenre"],
      confidence: 0.9,
    });

    const response = await recommend({ preferences, context: emptyContext, seed: 9 });
    // On ne renvoie JAMAIS un écran vide : on relâche et on prévient.
    expect(response.top).not.toBeNull();
    expect(response.relaxations.length).toBeGreaterThan(0);
    expect(response.relaxations[0].message.length).toBeGreaterThan(10);
  });

  it("« sur Netflix » est vérifié sur les disponibilités réelles", async () => {
    const preferences = createEmptyPreferences("questionnaire", {
      mediaType: "movie",
      providers: [NETFLIX],
      monetizationTypes: ["flatrate"],
      hardConstraints: ["mediaType", "providers"],
    });

    const response = await recommend({ preferences, context: emptyContext, seed: 5 });
    const top = response.top;

    expect(top).not.toBeNull();
    expect(top!.candidate.providers.some((provider) => provider.providerId === NETFLIX)).toBe(true);
    // Le filtre est bien parti côté serveur TMDB.
    expect(state.calls.some((call) => call.params.get("with_watch_providers") === "8")).toBe(true);
  });

  it("les plateformes sont disponibles pour l'affichage, même sans contrainte", async () => {
    const preferences = createEmptyPreferences("natural_language", {
      mediaType: "movie",
      moods: ["feel_good"],
      hardConstraints: ["mediaType"],
    });

    const response = await recommend({ preferences, context: emptyContext, seed: 6 });
    expect(response.top!.candidate.providers.length).toBeGreaterThan(0);
    expect(response.top!.candidate.providers[0].name.length).toBeGreaterThan(0);
    expect(response.top!.candidate.providers[0].link).toContain("themoviedb.org");
  });
});

describe("mode TMDB, robustesse", () => {
  it("un keyword de mood change réellement le pool", async () => {
    const { getCatalog } = await import("./index");
    await getCatalog().buildPool({
      mediaType: "movie",
      prefs: createEmptyPreferences("natural_language", { mediaType: "movie", moods: ["feel_good"] }),
    });
    // Le mood « feel-good » se traduit par les VRAIS keywords TMDB
    // « heartwarming » (319357) et « uplifting » (334465).
    expect(state.calls.some((call) => call.params.get("with_keywords") === "319357|334465")).toBe(true);
  });

  it("le pool de mood ne retient que les œuvres réellement taguées", async () => {
    const { getCatalog } = await import("./index");
    const pool = await getCatalog().buildPool({
      mediaType: "movie",
      prefs: createEmptyPreferences("natural_language", { mediaType: "movie", moods: ["feel_good"] }),
    });
    // Les seules œuvres taguées « heartwarming » / « uplifting » de la fixture.
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((candidate) => candidate.verified)).toBe(true);
  });

  it("un libellé de keyword inexistant n'est JAMAIS deviné", async () => {
    const { resolveKeywordId } = await import("@/services/tmdb/keywords");
    // « comfort show » n'existe pas chez TMDB, mais la recherche floue renvoie
    // « comfort » : le client ne doit pas s'en contenter.
    expect(await resolveKeywordId("comfort show")).toBeNull();
    expect(await resolveKeywordId("visually stunning")).toBeNull();
    // ... alors qu'un libellé réel est bien résolu, tirets et casse ignorés.
    expect(await resolveKeywordId("heartwarming")).toBe(319357);
    expect(await resolveKeywordId("Light Hearted")).not.toBeNull();
  });

  it("la durée d'épisode se replie sur le dernier épisode quand TMDB la laisse vide", async () => {
    const { getCatalog } = await import("./index");
    const pool = await getCatalog().buildPool({
      mediaType: "tv",
      prefs: createEmptyPreferences("natural_language", { mediaType: "tv" }),
    });
    const series = pool.find((candidate) => candidate.id === 712);
    expect(series).toBeDefined();
    // `episode_run_time` est vide dans la fixture : sans le repli, la contrainte
    // « épisodes d'environ 30 minutes » serait invérifiable pour cette série.
    expect(series!.episodeRuntime).toBe(27);
  });

  it("cherche un FORMAT de série par keyword (TMDB ne filtre ni saisons ni durée d'épisode)", async () => {
    const { getCatalog } = await import("./index");
    const before = state.calls.length;
    await getCatalog().buildPool({
      mediaType: "tv",
      prefs: createEmptyPreferences("natural_language", {
        mediaType: "tv",
        commitment: "small",
        minSeasons: 1,
        maxSeasons: 2,
        targetEpisodeRuntime: 30,
      }),
    });
    const keywords = state.calls
      .slice(before)
      .filter((call) => call.path.endsWith("/discover/tv"))
      .map((call) => call.params.get("with_keywords"))
      .filter((value): value is string => typeof value === "string");
    // Sans ces deux piscines, « petite série feel-good terminée avec des
    // épisodes d'environ 30 minutes » ne trouvait rien et devait être assouplie.
    expect(keywords.some((value) => value.includes("11162"))).toBe(true);
    expect(keywords.some((value) => value.includes("193171"))).toBe(true);
  });

  it("`discover/tv` ne reçoit jamais `with_runtime` (paramètre ignoré par TMDB)", async () => {
    const { getCatalog } = await import("./index");
    const before = state.calls.length;
    await getCatalog().buildPool({
      mediaType: "tv",
      prefs: createEmptyPreferences("natural_language", {
        mediaType: "tv",
        targetEpisodeRuntime: 30,
        episodeRuntimeTolerance: 14,
        hardConstraints: ["maxRuntime"],
      }),
    });
    const seriesCalls = state.calls
      .slice(before)
      .filter((call) => call.path.endsWith("/discover/tv"));
    expect(seriesCalls.length).toBeGreaterThan(0);
    // Sinon TMDB répond 200 en ignorant le filtre : la contrainte dure serait
    // faussement satisfaite, et la boucle serait pire que pas de filtre du tout.
    expect(seriesCalls.every((call) => !call.params.has("with_runtime.lte"))).toBe(true);
    expect(seriesCalls.every((call) => !call.params.has("with_runtime.gte"))).toBe(true);
  });

  it("réessaie après un 429 puis réussit", async () => {
    state.mode = "rate-limit-once";
    rateLimitBudget = 1;
    const { getCatalog } = await import("./index");
    const results = await getCatalog().search("Palm", "movie");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain("Palm");
  });

  it("une clé refusée ne casse pas l'écran : le moteur renvoie un état vide propre", async () => {
    state.mode = "unauthorized";
    const preferences = createEmptyPreferences("natural_language", {
      mediaType: "movie",
      hardConstraints: ["mediaType"],
    });
    const response = await recommend({ preferences, context: emptyContext, seed: 7 });
    expect(response.empty).toBe(true);
    expect(response.top).toBeNull();
  });

  it("les genres et plateformes FR sont exposés avec leurs noms", async () => {
    const { getCatalog } = await import("./index");
    const genres = await getCatalog().getGenres("movie");
    const providers = await getCatalog().getProviders("movie");
    expect(genres.some((genre) => genre.name === "Comédie")).toBe(true);
    expect(providers.some((provider) => provider.name === "Netflix")).toBe(true);
  });
});
