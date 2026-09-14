/**
 * Source de catalogue « démo » : elle expose le catalogue local embarqué
 * derrière exactement la même interface que TMDB.
 *
 * Conséquence importante : tout le reste de TONIGHT (parser, moteur de scoring,
 * UI, favoris, historique) est identique avec ou sans token TMDB.
 */

import {
  DEMO_MOVIES,
  DEMO_PROVIDERS,
  DEMO_SERIES,
  type DemoSeed,
} from "@/data/demoCatalog";
import type {
  Candidate,
  CandidateDetails,
  MediaType,
  ProviderAvailability,
} from "@/types/tonight";
import { GENRE_NAMES_FR, POOL_TARGET_SIZE } from "@/utils/constants";
import { normalize } from "@/utils/text";
import type { CatalogSource, ProviderOption } from "./types";

/** Convertit une entrée du dataset en `Candidate`. */
function toCandidate(seed: DemoSeed): Candidate {
  return {
    id: seed.id,
    mediaType: seed.type,
    title: seed.title,
    originalTitle: seed.original,
    year: seed.year,
    endYear: seed.endYear ?? null,
    runtime: seed.runtime ?? null,
    episodeRuntime: seed.episodeRuntime ?? null,
    seasons: seed.seasons ?? null,
    episodes: seed.episodes ?? null,
    status: seed.status ?? (seed.type === "movie" ? "Released" : null),
    genres: seed.genres,
    genreNames: seed.genres.map((id) => GENRE_NAMES_FR[id] ?? `Genre ${id}`),
    keywordSlugs: seed.keywords,
    overview: seed.overview,
    voteAverage: seed.rating,
    voteCount: seed.votes,
    popularity: seed.popularity,
    // Le catalogue de démo ne fournit pas d'images TMDB : l'UI génère alors
    // un visuel procédural (jamais d'écran cassé, exigence §67).
    posterPath: null,
    backdropPath: null,
    originalLanguage: seed.language,
    originCountry: seed.countries,
    director: seed.director ?? null,
    creators: seed.creators ?? [],
    cast: seed.cast,
    providers: seed.providers.map((providerId) => ({
      providerId,
      name: DEMO_PROVIDERS[providerId]?.name ?? `Plateforme ${providerId}`,
      logoPath: null,
      monetization: "flatrate" as const,
    })),
    // Le dataset de démo est renseigné à la main : durée, saisons et statut
    // sont autoritaires, donc les contraintes dures sont pleinement vérifiables.
    verified: true,
  };
}

const ALL_SEEDS: DemoSeed[] = [...DEMO_MOVIES, ...DEMO_SERIES];

function seedsFor(mediaType: MediaType): DemoSeed[] {
  return mediaType === "movie" ? DEMO_MOVIES : DEMO_SERIES;
}

export function createDemoCatalog(): CatalogSource {
  return {
    mode: "demo",

    async buildPool({ mediaType }) {
      // Le pool renvoie tout le catalogue du média demandé : les contraintes
      // dures sont appliquées par le moteur (une seule source de vérité), ce qui
      // permet à l'assouplissement de fonctionner exactement comme avec TMDB.
      return seedsFor(mediaType).map(toCandidate).slice(0, POOL_TARGET_SIZE * 2);
    },

    async search(query: string, mediaType: MediaType | "any") {
      const needle = normalize(query);
      if (!needle) return [];
      const pool = mediaType === "any" ? ALL_SEEDS : seedsFor(mediaType);
      return pool
        .filter((seed) => normalize(seed.title).includes(needle) || normalize(seed.original).includes(needle))
        .map(toCandidate)
        .slice(0, 24);
    },

    async getDetails(mediaType: MediaType, id: number): Promise<CandidateDetails> {
      const seed = seedsFor(mediaType).find((entry) => entry.id === id);
      if (!seed) throw new Error("Œuvre introuvable.");
      const base = toCandidate(seed);

      // Œuvres similaires : même genre, année proche, bien notées.
      const similar = seedsFor(mediaType)
        .filter((entry) => entry.id !== id)
        .map((entry) => ({
          seed: entry,
          overlap: entry.genres.filter((genre) => seed.genres.includes(genre)).length,
        }))
        .sort((a, b) => {
          if (b.overlap !== a.overlap) return b.overlap - a.overlap;
          return Math.abs(a.seed.year - seed.year) - Math.abs(b.seed.year - seed.year);
        })
        .slice(0, 12)
        .map(({ seed: entry }) => toCandidate(entry));

      return {
        ...base,
        tagline: null,
        genresDetailed: seed.genres.map((genreId) => ({
          id: genreId,
          name: GENRE_NAMES_FR[genreId] ?? `Genre ${genreId}`,
        })),
        countries: seed.countries,
        spokenLanguages: [seed.language],
        // Le dataset local ne contient pas de vidéos : la fiche masque alors
        // simplement la section bande-annonce (§67, jamais d'écran cassé).
        trailer: null,
        similar,
      };
    },

    async getGenres(mediaType: MediaType) {
      const ids = new Set<number>();
      seedsFor(mediaType).forEach((seed) => seed.genres.forEach((id) => ids.add(id)));
      return [...ids]
        .map((id) => ({ id, name: GENRE_NAMES_FR[id] ?? `Genre ${id}` }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    },

    async getProviders(): Promise<ProviderOption[]> {
      return Object.entries(DEMO_PROVIDERS)
        .map(([id, provider]) => ({
          providerId: Number(id),
          name: provider.name,
          logoPath: null,
          displayPriority: provider.priority,
        }))
        .sort((a, b) => a.displayPriority - b.displayPriority);
    },

    async getWatchProviders(mediaType: MediaType, id: number): Promise<ProviderAvailability[]> {
      const seed = seedsFor(mediaType).find((entry) => entry.id === id);
      if (!seed) return [];
      return seed.providers.map((providerId) => ({
        providerId,
        name: DEMO_PROVIDERS[providerId]?.name ?? `Plateforme ${providerId}`,
        logoPath: null,
        monetization: "flatrate" as const,
      }));
    },
  };
}
