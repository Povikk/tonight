/**
 * Source de catalogue TMDB (mode normal).
 *
 * Point clé : `discover` ne renvoie NI la durée d'un film, NI le nombre de
 * saisons/le statut d'une série. Or ces informations sont centrales pour
 * TONIGHT (« moins de 2h », « petite série terminée »). On procède donc en deux
 * temps :
 *   1. `discover` (filtres larges, tri distant) → pool brut ;
 *   2. enrichissement ciblé des meilleurs candidats via `/movie/{id}` et
 *      `/tv/{id}` (mis en cache 24 h), avec concurrence limitée.
 * Résultat : jamais de catalogue téléchargé, mais des données complètes là où
 * elles comptent.
 */

import { moodDefinition } from "@/data/moods";
import type {
  Candidate,
  CandidateDetails,
  MediaType,
  ProviderAvailability,
  TonightSearchPreferences,
} from "@/types/tonight";
import type { TmdbMovieDetails, TmdbMovieListItem, TmdbTvDetails, TmdbTvListItem } from "@/types/tmdb";
import { POOL_TARGET_SIZE, genreName, toGenreForMedia } from "@/utils/constants";
import { compact, mapLimit } from "@/utils/async";
import { tmdbFetch } from "@/services/tmdb/client";
import { discoverMovies, discoverSeries, type DiscoverSort } from "@/services/tmdb/discover";
import { getMovieDetails, getSeriesDetails } from "@/services/tmdb/details";
import { getGenres, getProviders } from "@/services/tmdb/genres";
import { resolveKeywordId, resolveKeywordIds } from "@/services/tmdb/keywords";
import { providersFromAvailability, toMovieCandidate, toTvCandidate } from "@/services/tmdb/mappers";
import { searchBoth, searchMovies, searchSeries } from "@/services/tmdb/search";
import type { CatalogSource, PoolRequest, ProviderOption } from "./types";

/**
 * Nombre d'œuvres enrichies (durée / saisons / statut / plateformes).
 *
 * ON ENRICHIT TOUT LE POOL. C'est une exigence de correction, pas de confort :
 * un seul candidat non enrichi peut gagner le classement avec des champs
 * inconnus, et TONIGHT se met alors à promettre des choses fausses (« petite
 * série terminée » → une série annulée de 4 saisons).
 *
 * Le coût est très acceptable : un appel `/tv/{id}` prend ~140 ms et l'appel
 * est mis en cache 24 h. Enrichir 70 œuvres avec 8 requêtes en parallèle prend
 * moins d'une seconde.
 */
const ENRICH_LIMIT = POOL_TARGET_SIZE;
/** Concurrence des appels TMDB. */
const CONCURRENCY = 8;
/** Plancher de votes pour les pools « mood » triés par popularité. */
const MOOD_VOTE_FLOOR = 250;
/**
 * Plancher de votes pour les pools « mood » triés par NOTE.
 *
 * Beaucoup plus élevé, et pour une raison de fond (§34) : `vote_average.desc`
 * classe en tête les œuvres à tout petit échantillon. À 250 votes, les recherches
 * « un peu d'amour, joli, récent » remontaient des films confidentiels à 8,4/10
 * sur 300 votes, devant des films vus par 30 000 personnes. À 1 000 votes, la
 * note veut enfin dire quelque chose.
 */
const MOOD_RATING_VOTE_FLOOR = 1000;
/** Nombre de moods pour lesquels on lance une recherche dédiée. */
const MOOD_POOL_LIMIT = 2;
/**
 * Keyword TMDB d'une mini-série (identifiant vérifié : 11162).
 *
 * Indispensable : `discover/tv` ne sait filtrer NI le nombre de saisons NI le
 * statut, et les piscines par popularité ne contiennent quasiment que des
 * séries-fleuves. Sans récupération par keyword, « une mini-série avec une
 * vraie fin » finissait par proposer Dr. House (8 saisons).
 */
const MINISERIES_KEYWORD = "miniseries";
/**
 * Keyword TMDB du format court (identifiant vérifié : 193171).
 *
 * Même raison que MINISERIES_KEYWORD, transposée à la durée d'épisode :
 * `discover/tv` n'a AUCUN filtre de durée d'épisode (avec_runtime y est
 * ignoré). Quand l'utilisateur demande « des épisodes d'environ 30 minutes »,
 * les piscines par popularité ne contiennent que des séries de 45 à 60 minutes,
 * et la contrainte doit être assouplie faute de candidats. La sitcom est le
 * format qui correspond réellement à cette demande.
 */
const SITCOM_KEYWORD = "sitcom";
/** Durée d'épisode à partir de laquelle on cherche un format court. */
const SHORT_EPISODE_THRESHOLD = 32;

interface DiscoverJob {
  sort: DiscoverSort;
  page: number;
  override?: Record<string, string | number | boolean>;
  /** Mood qui a motivé ce pool : les résultats en héritent. */
  moodSlugs?: string[];
}

/** Plan de collecte : large au départ, resserré si l'utilisateur cherche une pépite. */
function buildJobs(prefs: TonightSearchPreferences): DiscoverJob[] {
  const jobs: DiscoverJob[] = [
    { sort: "popularity.desc", page: 1 },
    { sort: "popularity.desc", page: 2 },
  ];

  switch (prefs.discoveryLevel) {
    case "hidden_gem":
      jobs.push(
        { sort: "vote_average.desc", page: 1, override: { "vote_count.gte": 250, "vote_count.lte": 4000 } },
        { sort: "vote_average.desc", page: 2, override: { "vote_count.gte": 250, "vote_count.lte": 6000 } },
      );
      break;
    case "obscure":
      jobs.push(
        { sort: "vote_average.desc", page: 1, override: { "vote_count.gte": 120, "vote_count.lte": 1200 } },
        { sort: "vote_average.desc", page: 2, override: { "vote_count.gte": 120, "vote_count.lte": 2000 } },
      );
      break;
    case "mainstream":
      jobs.push({ sort: "vote_count.desc", page: 1 });
      break;
    case "surprise":
      jobs.push(
        { sort: "vote_count.desc", page: 3 },
        { sort: "vote_average.desc", page: 3, override: { "vote_count.gte": 200, "vote_count.lte": 8000 } },
      );
      break;
    default:
      // `vote_count.desc` ramenait les monstres de volume (talk-shows des
      // années 80, animés à rallonge) qui écrasaient tout sans rapport avec la
      // demande. La popularité est un bien meilleur signal d'actualité.
      jobs.push({ sort: "popularity.desc", page: 3 });
      break;
  }

  if (prefs.qualityPreference === "no_risk" || prefs.qualityPreference === "very_solid") {
    jobs.push({ sort: "vote_average.desc", page: 1, override: { "vote_count.gte": 1500 } });
  }

  return jobs;
}

/**
 * Pré-classement du pool : sert uniquement à décider quelles œuvres on enrichit
 * et lesquelles on garde quand le pool dépasse la taille cible. Ce n'est PAS le
 * score TONIGHT (voir `recommendation/`).
 *
 * IMPORTANT : ce classement doit tenir compte de la DEMANDE, sinon on enrichit
 * les 70 œuvres les plus populaires du moment et la contrainte « feel-good »
 * n'a plus rien à se mettre sous la dent. D'où la composante `relevance`
 * (genres du mood + keywords rapportés par les pools de mood).
 */
function preRankScore(candidate: Candidate, prefs: TonightSearchPreferences): number {
  const quality = Math.min(candidate.voteAverage / 10, 1);
  const volume = Math.min(Math.log10(Math.max(candidate.voteCount, 1)) / 5, 1);
  const popularity = Math.min(Math.log10(Math.max(candidate.popularity, 1)) / 2.6, 1);
  const relevance = relevanceScore(candidate, prefs);

  switch (prefs.discoveryLevel) {
    case "hidden_gem":
    case "obscure": {
      // En mode « pépite », sortir les blockbusters du pool est un préalable :
      // sinon ils raflent les places d'enrichissement et le moteur n'a plus
      // l'embarras du choix. D'où le bonus de rareté et le volume plafonné.
      const rarity = 1 - popularity;
      return relevance * 0.35 + quality * 0.4 + rarity * 0.15 + Math.min(volume, 0.8) * 0.1;
    }
    case "mainstream":
      return popularity * 0.4 + relevance * 0.3 + quality * 0.3;
    default:
      // La pertinence domine, mais la qualité garde un vrai poids : sans cela
      // les 70 places d'enrichissement partent à des films de niche simplement
      // parce qu'ils portent le keyword du mood.
      return relevance * 0.4 + quality * 0.35 + popularity * 0.15 + volume * 0.1;
  }
}

/**
 * Proximité d'un candidat avec la demande, à partir de ce que `discover`
 * connaît déjà (genres + keywords rapportés par les pools de mood).
 *
 * Vaut 0 quand la demande n'a ni mood ni genre : on retombe alors sur le
 * classement qualité / popularité habituel.
 */
function relevanceScore(candidate: Candidate, prefs: TonightSearchPreferences): number {
  const wantedGenres = new Set<number>();
  for (const genreId of prefs.genres) wantedGenres.add(toGenreForMedia(genreId, candidate.mediaType));
  for (const mood of prefs.moods) {
    for (const genreId of moodDefinition(mood).genres) {
      wantedGenres.add(toGenreForMedia(genreId, candidate.mediaType));
    }
  }

  if (!wantedGenres.size && !candidate.keywordSlugs.length) return 0;

  const genreHits = candidate.genres.filter((genreId) => wantedGenres.has(genreId)).length;
  const genrePart = Math.min(genreHits, 2) / 2;
  // Un keyword rapporté par un pool de mood signifie : « TMDB l'associe
  // explic-itement à ce mood ». C'est le signal le plus fiable disponible.
  const keywordPart = candidate.keywordSlugs.length ? 1 : 0;
  return keywordPart * 0.6 + genrePart * 0.4;
}

function mergeCandidates(target: Map<number, Candidate>, incoming: Candidate[], moodSlugs?: string[]) {
  for (const candidate of incoming) {
    const existing = target.get(candidate.id);
    if (!existing) {
      target.set(candidate.id, moodSlugs?.length
        ? { ...candidate, keywordSlugs: Array.from(new Set([...candidate.keywordSlugs, ...moodSlugs])) }
        : candidate);
      continue;
    }
    // On fusionne les signalements de mood déjà connus.
    if (moodSlugs?.length) {
      existing.keywordSlugs = Array.from(new Set([...existing.keywordSlugs, ...moodSlugs]));
    }
    // On garde la fiche la plus riche.
    if (!existing.backdropPath && candidate.backdropPath) existing.backdropPath = candidate.backdropPath;
    if (!existing.posterPath && candidate.posterPath) existing.posterPath = candidate.posterPath;
    if (!existing.overview && candidate.overview) existing.overview = candidate.overview;
  }
}

/**
 * Genres d'un candidat enrichi.
 * `discover` renvoie `genre_ids`, la fiche détaillée renvoie `genres[{id,name}]` :
 * on accepte les deux formes.
 */
function genresOf(candidate: Candidate, payload: TmdbMovieListItem | TmdbTvListItem): number[] {
  if (candidate.genres.length) return candidate.genres;
  if (payload.genres?.length) return payload.genres.map((genre) => genre.id);
  return payload.genre_ids ?? [];
}

/**
 * Complète un film via `/movie/{id}` : durée exacte, genres réels et
 * disponibilités streaming.
 *
 * Les plateformes sont demandées ICI (`append_to_response=watch/providers`) et
 * ne coûtent donc AUCUNE requête supplémentaire : sans elles, l'écran résultat
 * n'afficherait aucune plateforme en mode TMDB (exigences §22, §38).
 */
async function enrichMovie(candidate: Candidate): Promise<Candidate> {
  const payload = await tmdbFetch<TmdbMovieDetails>(
    `/movie/${candidate.id}`,
    { append_to_response: "watch/providers" },
    { revalidate: 86_400 },
  );
  const genres = genresOf(candidate, payload);
  return {
    ...candidate,
    genres,
    genreNames: genres.map(genreName),
    // À partir d'ici, durée / genres / plateformes sont autoritaires.
    verified: true,
    runtime: payload.runtime ?? candidate.runtime,
    voteAverage: payload.vote_average ?? candidate.voteAverage,
    voteCount: payload.vote_count ?? candidate.voteCount,
    popularity: payload.popularity ?? candidate.popularity,
    posterPath: candidate.posterPath ?? payload.poster_path,
    backdropPath: candidate.backdropPath ?? payload.backdrop_path,
    overview: candidate.overview || (payload.overview ?? ""),
    providers: providersFromAvailability(payload["watch/providers"]),
  };
}

/**
 * Durée d'un épisode, en minutes.
 *
 * `episode_run_time` est souvent vide chez TMDB (constaté sur la majorité des
 * séries, y compris très populaires), tandis que le dernier épisode diffusé
 * porte toujours sa durée. On essaie donc les trois sources dans l'ordre.
 */
function episodeRuntimeOf(payload: TmdbTvDetails): number | null {
  const declared = payload.episode_run_time?.find((value) => value > 0);
  if (declared) return declared;
  for (const episode of [payload.last_episode_to_air, payload.next_episode_to_air]) {
    const runtime = episode?.runtime;
    if (typeof runtime === "number" && runtime > 0) return runtime;
  }
  return null;
}

/**
 * Complète une série via `/tv/{id}` : saisons, épisodes, statut, durée
 * d'épisode et disponibilités streaming.
 */
async function enrichSeries(candidate: Candidate): Promise<Candidate> {
  const payload = await tmdbFetch<TmdbTvDetails>(
    `/tv/${candidate.id}`,
    { append_to_response: "watch/providers" },
    { revalidate: 86_400 },
  );
  const genres = genresOf(candidate, payload);
  const episodeRuntime = episodeRuntimeOf(payload) ?? candidate.episodeRuntime;
  return {
    ...candidate,
    genres,
    genreNames: genres.map(genreName),
    // À partir d'ici, saisons / statut / durée d'épisode / plateformes sont
    // autoritaires : les contraintes dures peuvent s'y appuyer.
    verified: true,
    seasons: payload.number_of_seasons ?? candidate.seasons,
    episodes: payload.number_of_episodes ?? candidate.episodes,
    status: payload.status ?? candidate.status,
    episodeRuntime,
    endYear: payload.last_air_date ? Number.parseInt(payload.last_air_date.slice(0, 4), 10) : candidate.endYear,
    voteAverage: payload.vote_average ?? candidate.voteAverage,
    voteCount: payload.vote_count ?? candidate.voteCount,
    popularity: payload.popularity ?? candidate.popularity,
    originCountry: payload.origin_country ?? candidate.originCountry,
    posterPath: candidate.posterPath ?? payload.poster_path,
    backdropPath: candidate.backdropPath ?? payload.backdrop_path,
    overview: candidate.overview || (payload.overview ?? ""),
    providers: providersFromAvailability(payload["watch/providers"]),
  };
}

export function createTmdbCatalog(): CatalogSource {
  return {
    mode: "tmdb",

    async buildPool({ mediaType, prefs, soft = false, skipProviders = false }: PoolRequest) {
      const { buildDiscoverParams } = await import("@/services/tmdb/discover");
      const jobs = buildJobs(prefs);

      /* ---------------------------------------------------------------- */
      /* Pools « mood »                                                    */
      /* ---------------------------------------------------------------- */
      // Un mood n'est jamais un genre : on le cherche via les keywords TMDB
      // associés. On double le tir avec un pool par genre pour garantir du
      // rappel même quand aucun keyword ne se résout.
      const moodPools = await mapLimit(prefs.moods.slice(0, MOOD_POOL_LIMIT), 2, async (mood) => {
        const definition = moodDefinition(mood);
        const ids = await resolveKeywordIds(definition.keywordLabels);
        const moodGenres = definition.genres
          .map((genreId) => toGenreForMedia(genreId, mediaType))
          .filter((genreId, index, all) => all.indexOf(genreId) === index)
          .slice(0, 1);
        if (!ids.length && !moodGenres.length) return null;
        return {
          ids: ids.slice(0, 2),
          // On AJOUTE le genre du mood à ceux demandés, on ne les remplace pas :
          // sinon une contrainte dure « requireGenre » viderait ce pool.
          genres: [...new Set([...prefs.genres.map((genreId) => toGenreForMedia(genreId, mediaType)), ...moodGenres])],
          moodSlugs: definition.keywordSlugs.slice(0, 1),
        };
      });

      /* ---------------------------------------------------------------- */
      /* Format des séries : mini-séries et petites séries                  */
      /* ---------------------------------------------------------------- */
      // Voir MINISERIES_KEYWORD : c'est le seul levier de récupération pour les
      // formats courts côté TMDB.
      if (mediaType === "tv") {
        const formatKeywords: string[] = [];
        if (prefs.commitment === "mini" || prefs.commitment === "small") formatKeywords.push(MINISERIES_KEYWORD);
        if (prefs.targetEpisodeRuntime !== null && prefs.targetEpisodeRuntime <= SHORT_EPISODE_THRESHOLD) {
          formatKeywords.push(SITCOM_KEYWORD);
        }

        const resolved = await mapLimit(formatKeywords, 2, async (label) => {
          const id = await resolveKeywordId(label);
          return id ? { label, id } : null;
        });

        for (const entry of compact(resolved)) {
          jobs.push({
            sort: "vote_average.desc",
            page: 1,
            override: { with_keywords: String(entry.id), "vote_count.gte": 150 },
          });
          jobs.push({ sort: "popularity.desc", page: 1, override: { with_keywords: String(entry.id) } });
        }
      }

      for (const pool of compact(moodPools)) {
        if (pool.ids.length) {
          // Tri par note avec plancher de votes : on veut les meilleures œuvres
          // du mood, pas celles qui cumulent le plus de votes (§34, §35).
          jobs.push({
            sort: "vote_average.desc",
            page: 1,
            override: { with_keywords: pool.ids.join("|"), "vote_count.gte": MOOD_RATING_VOTE_FLOOR },
            moodSlugs: pool.moodSlugs,
          });
          // Deuxième page par popularité : rappel complémentaire sur le mood.
          jobs.push({
            sort: "popularity.desc",
            page: 1,
            override: { with_keywords: pool.ids.join("|") },
            moodSlugs: pool.moodSlugs,
          });
        }
        if (pool.genres.length) {
          jobs.push({
            sort: "vote_average.desc",
            page: 1,
            override: { with_genres: pool.genres.join("|"), "vote_count.gte": MOOD_VOTE_FLOOR },
            moodSlugs: pool.moodSlugs,
          });
        }
      }

      const collected = new Map<number, Candidate>();

      // 2 vagues de requêtes : le pool de base, puis les pools « mood ».
      const baseJobs = jobs.filter((job) => !job.moodSlugs);
      const moodJobs = jobs.filter((job) => job.moodSlugs);

      const pageResults = await mapLimit(baseJobs, 3, async (job) => {
        const params = {
          ...buildDiscoverParams(mediaType, prefs, { sort: job.sort, page: job.page, soft, skipProviders }),
          ...(job.override ?? {}),
        };
        if (mediaType === "movie") {
          const page = await discoverMovies(params);
          return page.results.map((item) => toMovieCandidate(item));
        }
        const page = await discoverSeries(params);
        return page.results.map((item) => toTvCandidate(item));
      });

      for (const result of pageResults) if (result?.length) mergeCandidates(collected, result);

      const moodResults = await mapLimit(moodJobs, 3, async (job) => {
        const params = {
          ...buildDiscoverParams(mediaType, prefs, { sort: job.sort, page: job.page, soft, skipProviders }),
          ...(job.override ?? {}),
        };
        if (mediaType === "movie") {
          const page = await discoverMovies(params);
          return { candidates: page.results.map((item) => toMovieCandidate(item)), moodSlugs: job.moodSlugs };
        }
        const page = await discoverSeries(params);
        return { candidates: page.results.map((item) => toTvCandidate(item)), moodSlugs: job.moodSlugs };
      });

      for (const result of moodResults) {
        if (result?.candidates?.length) mergeCandidates(collected, result.candidates, result.moodSlugs);
      }

      // Tri par pertinence approximative puis enrichissement des meilleurs.
      const ranked = [...collected.values()].sort(
        (a, b) => preRankScore(b, prefs) - preRankScore(a, prefs),
      );
      const toEnrich = ranked.slice(0, ENRICH_LIMIT);

      const enriched = await mapLimit(toEnrich, CONCURRENCY, async (candidate) => {
        try {
          return mediaType === "movie" ? await enrichMovie(candidate) : await enrichSeries(candidate);
        } catch {
          // Enrichissement impossible (TMDB indisponible, œuvre retirée…) : le
          // candidat reste `verified: false` et ne pourra donc pas servir à
          // satisfaire une contrainte dure sur la durée, les saisons ou le
          // statut. C'est exactement ce qu'on veut (§67 : jamais de fausse
          // promesse, et l'UI gère les données manquantes).
          return candidate;
        }
      });

      return compact(enriched);
    },

    async search(query: string, mediaType: MediaType | "any") {
      if (mediaType === "movie") return searchMovies(query);
      if (mediaType === "tv") return searchSeries(query);
      return searchBoth(query);
    },

    async getDetails(mediaType: MediaType, id: number): Promise<CandidateDetails> {
      return mediaType === "movie" ? getMovieDetails(id) : getSeriesDetails(id);
    },

    async getGenres(mediaType: MediaType) {
      return getGenres(mediaType);
    },

    async getProviders(mediaType: MediaType): Promise<ProviderOption[]> {
      return getProviders(mediaType);
    },

    async getWatchProviders(mediaType: MediaType, id: number): Promise<ProviderAvailability[]> {
      const path = mediaType === "movie" ? `/movie/${id}/watch/providers` : `/tv/${id}/watch/providers`;
      const payload = await tmdbFetch<Parameters<typeof providersFromAvailability>[0]>(path, {}, { revalidate: 43_200 });
      return providersFromAvailability(payload);
    },
  };
}
