/**
 * Sélection de la source de catalogue.
 *
 * - token TMDB présent → mode `tmdb` (source réelle) ;
 * - aucun token → mode `demo` (catalogue local, application pleinement
 *   fonctionnelle).
 *
 * L'information est exposée à l'UI (`/api/status`) pour prévenir honnêtement
 * l'utilisateur quand il tourne en mode démo.
 */

import { hasTmdbCredentials } from "@/services/tmdb/client";
import { createDemoCatalog } from "./demoSource";
import { createTmdbCatalog } from "./tmdbSource";
import type { CatalogMode, CatalogSource } from "./types";

let cached: CatalogSource | null = null;
let cachedMode: CatalogMode | null = null;

export function getCatalog(): CatalogSource {
  const mode: CatalogMode = hasTmdbCredentials() ? "tmdb" : "demo";
  if (!cached || cachedMode !== mode) {
    cached = mode === "tmdb" ? createTmdbCatalog() : createDemoCatalog();
    cachedMode = mode;
  }
  return cached;
}

export function getCatalogMode(): CatalogMode {
  return hasTmdbCredentials() ? "tmdb" : "demo";
}

export type { CatalogMode, CatalogSource, PoolRequest, ProviderOption } from "./types";
