/**
 * Client HTTP TMDB.
 *
 * SÉCURITÉ : ce module n'est importé QUE par du code serveur (route handlers
 * `src/app/api/*` et server components). Le token reste donc côté serveur et
 * n'est jamais envoyé au navigateur.
 */

import { TMDB_LANGUAGE } from "@/utils/constants";

const TMDB_API_BASE = "https://api.themoviedb.org/3";

/** Le token n'est pas configuré. */
export class TmdbNotConfiguredError extends Error {
  constructor() {
    super("Aucun identifiant TMDB configuré (TMDB_READ_ACCESS_TOKEN ou TMDB_API_KEY).");
    this.name = "TmdbNotConfiguredError";
  }
}

/** Erreur TMDB (HTTP ou réseau), avec le code de statut quand il existe. */
export class TmdbError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "TmdbError";
    this.status = status;
  }
}

export type TmdbParams = Record<string, string | number | boolean | null | undefined>;

function readCredentials(): { bearer?: string; apiKey?: string } {
  const bearer = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim();
  return {
    bearer: bearer || undefined,
    apiKey: apiKey || undefined,
  };
}

/** TMDB est-il utilisable ? Sinon TONIGHT bascule en mode démo. */
export function hasTmdbCredentials(): boolean {
  const { bearer, apiKey } = readCredentials();
  return Boolean(bearer || apiKey);
}

function buildUrl(path: string, params: TmdbParams, apiKey?: string): string {
  const url = new URL(`${TMDB_API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  if (apiKey) url.searchParams.set("api_key", apiKey);
  return url.toString();
}

export interface TmdbFetchOptions {
  /** Durée de mise en cache Next (secondes). 0 = pas de cache. */
  revalidate?: number;
  /** Timeout de la requête en ms. */
  timeoutMs?: number;
  /** Nombre de tentatives supplémentaires en cas d'erreur réseau / 5xx. */
  retries?: number;
  /** Force une langue différente de la langue par défaut. */
  language?: string;
}

/**
 * Appel TMDB de bas niveau.
 *
 * - authentification par bearer token (v4) ou clé API (v3) ;
 * - timeout systématique pour ne jamais bloquer l'interface ;
 * - un retry sur erreur réseau / 5xx (TMDB est parfois capricieux) ;
 * - erreurs typées pour un traitement propre côté UI.
 */
export async function tmdbFetch<T>(
  path: string,
  params: TmdbParams = {},
  options: TmdbFetchOptions = {},
): Promise<T> {
  const { bearer, apiKey } = readCredentials();
  if (!bearer && !apiKey) throw new TmdbNotConfiguredError();

  const { revalidate = 3600, timeoutMs = 9000, retries = 1 } = options;
  const url = buildUrl(path, { language: options.language ?? TMDB_LANGUAGE, ...params }, apiKey);

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: bearer
          ? { Authorization: `Bearer ${bearer}`, accept: "application/json" }
          : { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        // `no-store` quand revalidate vaut 0 (recherche dynamique).
        ...(revalidate > 0 ? { next: { revalidate } } : { cache: "no-store" as RequestCache }),
      });

      if (response.status === 404) {
        throw new TmdbError("Ressource introuvable sur TMDB.", 404);
      }
      if (response.status === 429) {
        throw new TmdbError("Trop de requêtes envoyées à TMDB. Réessaie dans un instant.", 429);
      }
      if (!response.ok) {
        throw new TmdbError(`TMDB a répondu ${response.status}.`, response.status);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      const retryable =
        !(error instanceof TmdbError) || error.status === 429 || error.status >= 500;
      if (attempt >= retries || !retryable) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  if (lastError instanceof TmdbError) throw lastError;
  throw new TmdbError("TMDB est injoignable pour le moment.", 503);
}
