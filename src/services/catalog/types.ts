/**
 * Abstraction « source de catalogue ».
 *
 * TONIGHT peut fonctionner avec deux sources :
 *   - `tmdb` : la vraie source (mode normal) ;
 *   - `demo` : un petit catalogue local embarqué, utilisé quand aucun token TMDB
 *     n'est configuré, pour que le moteur, le parser et toute l'interface
 *     restent 100 % utilisables.
 *
 * Le moteur de recommandation ne connaît que `CatalogSource`, il ne sait jamais
 * d'où viennent les données.
 */

import type {
  Candidate,
  CandidateDetails,
  MediaType,
  ProviderAvailability,
  TonightSearchPreferences,
} from "@/types/tonight";

export type CatalogMode = "tmdb" | "demo";

export interface PoolRequest {
  mediaType: MediaType;
  prefs: TonightSearchPreferences;
  /** Ignore les contraintes dures (assouplissement §37). */
  soft?: boolean;
  /** Ignore le filtre plateformes (assouplissement §37). */
  skipProviders?: boolean;
}

export interface ProviderOption {
  providerId: number;
  name: string;
  logoPath: string | null;
  displayPriority: number;
}

export interface CatalogSource {
  readonly mode: CatalogMode;

  /** Construit un pool de candidats large mais borné pour le scoring. */
  buildPool(request: PoolRequest): Promise<Candidate[]>;

  /** Recherche manuelle (exigence §54). */
  search(query: string, mediaType: MediaType | "any"): Promise<Candidate[]>;

  /** Fiche détaillée. */
  getDetails(mediaType: MediaType, id: number): Promise<CandidateDetails>;

  /** Genres disponibles, dans la langue courante. */
  getGenres(mediaType: MediaType): Promise<Array<{ id: number; name: string }>>;

  /** Plateformes disponibles dans la région (FR). */
  getProviders(mediaType: MediaType): Promise<ProviderOption[]>;

  /** Disponibilités d'une œuvre précise. */
  getWatchProviders(mediaType: MediaType, id: number): Promise<ProviderAvailability[]>;
}
