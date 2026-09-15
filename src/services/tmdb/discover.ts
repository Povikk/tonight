/**
 * `discover/movie` et `discover/tv` : c'est ici que les `TonightSearchPreferences`
 * deviennent des paramètres TMDB, et uniquement ici.
 *
 * Stratégie : TONIGHT ne télécharge pas un catalogue, il interroge TMDB
 * dynamiquement avec des filtres larges, puis laisse le moteur de scoring faire
 * le tri fin (exigence §4 et §32).
 */

import type { TonightSearchPreferences } from "@/types/tonight";
import type { TmdbMovieListItem, TmdbPaged, TmdbTvListItem } from "@/types/tmdb";
import { GENRE, TMDB_REGION, TMDB_WATCH_REGION, toGenreForMedia } from "@/utils/constants";
import { TmdbError, tmdbFetch, type TmdbParams } from "./client";

/** Tri distant : évite de télécharger un catalogue énorme. */
export type DiscoverSort =
  | "popularity.desc"
  | "vote_count.desc"
  | "vote_average.desc"
  | "primary_release_date.desc"
  | "first_air_date.desc";

function joinIds(ids: number[]): string | undefined {
  return ids.length ? Array.from(new Set(ids)).join("|") : undefined;
}

/**
 * Construit les paramètres de `discover`.
 *
 * @param options.soft quand `true`, on n'applique AUCUN filtre dur (années,
 * durée, note). Utilisé par le mécanisme d'assouplissement (§37).
 * @param options.withKeywords keywords (moods) à exiger, sinon aucun filtre.
 */
export function buildDiscoverParams(
  mediaType: "movie" | "tv",
  prefs: TonightSearchPreferences,
  options: { sort: DiscoverSort; page: number; withKeywords?: number[]; soft?: boolean; skipProviders?: boolean },
): TmdbParams {
  const { sort, page, withKeywords, soft = false, skipProviders = false } = options;

  const params: TmdbParams = {
    sort_by: sort,
    page,
    include_adult: false,
    region: TMDB_REGION,
    // Plancher de votes : évite les notes calculées sur 3 avis (§34).
    "vote_count.gte": mediaType === "movie" ? 120 : 80,
  };

  // Genres inclus en OR : le scoring gère la pondération, discover ne cadrait que.
  const included = joinIds(prefs.genres.map((id) => toGenreForMedia(id, mediaType)));
  if (included) params.with_genres = included;

  // Les genres exclus « durs » doivent être retirés dès `discover` : sinon ils
  // occupent les places d'enrichissement avant d'être rejetés localement, ce qui
  // peut masquer des candidats conformes situés plus bas.
  const excluded = new Set([
    ...prefs.excludedGenres.map((id) => toGenreForMedia(id, mediaType)),
    ...prefs.hardExcludedGenres.map((id) => toGenreForMedia(id, mediaType)),
  ]);
  if (prefs.excludeAnimation) excluded.add(GENRE.ANIMATION);
  if (prefs.excludeDocumentary) excluded.add(GENRE.DOCUMENTARY);
  if (excluded.size) params.without_genres = joinIds([...excluded]);

  if (!soft) {
    const dateField = mediaType === "movie" ? "primary_release_date" : "first_air_date";
    if (prefs.minYear) params[`${dateField}.gte`] = `${prefs.minYear}-01-01`;
    if (prefs.maxYear) params[`${dateField}.lte`] = `${prefs.maxYear}-12-31`;
    if (prefs.minRating) params["vote_average.gte"] = prefs.minRating;
    if (prefs.originalLanguage) params.with_original_language = prefs.originalLanguage;
    if (prefs.originCountry) params.with_origin_country = prefs.originCountry;

    if (mediaType === "movie") {
      // `with_runtime` est supporté par `discover/movie` : le tri se fait
      // gratuitement côté TMDB.
      if (prefs.minRuntime) params["with_runtime.gte"] = prefs.minRuntime;
      if (prefs.maxRuntime) params["with_runtime.lte"] = prefs.maxRuntime;
    }
    // ATTENTION : `discover/tv` N'ACCEPTE PAS `with_runtime`. Le paramètre est
    // ignoré silencieusement (HTTP 200, mais le filtre ne s'applique jamais :
    // une série de 57 minutes ressortait avec `with_runtime.lte=44`). Comme un
    // filtre ignoré donne une fausse impression de sécurité, on ne l'envoie
    // plus du tout pour les séries : la durée d'épisode est vérifiée APRÈS
    // enrichissement, par les contraintes dures (voir `recommendation/filters.ts`).
  }

  if (prefs.providers.length && !skipProviders) {
    params.with_watch_providers = prefs.providers.join("|");
    params.watch_region = TMDB_WATCH_REGION;
    const monetization = prefs.monetizationTypes.length
      ? prefs.monetizationTypes
      : (["flatrate", "free", "ads"] as const);
    params.with_watch_monetization_types = monetization.join("|");
  }

  if (withKeywords?.length) params.with_keywords = joinIds(withKeywords);

  return params;
}

/** Retire les filtres que `discover` refuse parfois (422) avant de réessayer. */
function stripUnsupported(params: TmdbParams): TmdbParams {
  const {
    "with_runtime.lte": _lte,
    "with_runtime.gte": _gte,
    ...rest
  } = params;
  return rest;
}

/** Une page de films. */
export async function discoverMovies(
  params: TmdbParams,
  revalidate = 900,
): Promise<TmdbPaged<TmdbMovieListItem>> {
  try {
    return await tmdbFetch<TmdbPaged<TmdbMovieListItem>>("/discover/movie", params, { revalidate });
  } catch (error) {
    if (error instanceof TmdbError && error.status === 422) {
      return tmdbFetch<TmdbPaged<TmdbMovieListItem>>("/discover/movie", stripUnsupported(params), {
        revalidate,
      });
    }
    throw error;
  }
}

/** Une page de séries. */
export async function discoverSeries(
  params: TmdbParams,
  revalidate = 900,
): Promise<TmdbPaged<TmdbTvListItem>> {
  try {
    return await tmdbFetch<TmdbPaged<TmdbTvListItem>>("/discover/tv", params, { revalidate });
  } catch (error) {
    if (error instanceof TmdbError && error.status === 422) {
      return tmdbFetch<TmdbPaged<TmdbTvListItem>>("/discover/tv", stripUnsupported(params), {
        revalidate,
      });
    }
    throw error;
  }
}
