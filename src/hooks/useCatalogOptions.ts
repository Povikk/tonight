"use client";

import { useEffect, useState } from "react";
import { readBrowserCache, writeBrowserCache } from "@/utils/cache";
import type { MediaType } from "@/types/tonight";

export interface GenreOption {
  id: number;
  name: string;
}

export interface ProviderOption {
  providerId: number;
  name: string;
  logoPath: string | null;
  displayPriority: number;
}

const ONE_DAY = 24 * 60 * 60 * 1000;

interface OptionsState {
  genres: GenreOption[];
  providers: ProviderOption[];
  loading: boolean;
  error: string | null;
}

/**
 * Genres + plateformes d'un média, avec cache localStorage (§63).
 * On ne rappelle pas l'API à chaque rendu.
 */
export function useCatalogOptions(mediaType: MediaType): OptionsState {
  const [state, setState] = useState<OptionsState>({ genres: [], providers: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    const cachedGenres = readBrowserCache<GenreOption[]>(`genres:${mediaType}`);
    const cachedProviders = readBrowserCache<ProviderOption[]>(`providers:${mediaType}`);

    if (cachedGenres?.length) {
      setState((previous) => ({ ...previous, genres: cachedGenres, loading: !cachedProviders?.length }));
    }
    if (cachedProviders?.length) {
      setState({ genres: cachedGenres ?? [], providers: cachedProviders, loading: false, error: null });
    }
    if (cachedGenres?.length && cachedProviders?.length) return () => {
      cancelled = true;
    };

    const load = async (kind: "genres" | "providers") => {
      try {
        const response = await fetch(`/api/catalog?kind=${kind}&mediaType=${mediaType}`);
        const payload = (await response.json()) as Record<string, unknown>;
        if (cancelled) return;
        if (kind === "genres") {
          const genres = (payload.genres as GenreOption[]) ?? [];
          writeBrowserCache(`genres:${mediaType}`, genres, ONE_DAY);
          setState((previous) => ({ ...previous, genres, loading: false }));
        } else {
          const providers = (payload.providers as ProviderOption[]) ?? [];
          writeBrowserCache(`providers:${mediaType}`, providers, ONE_DAY);
          setState((previous) => ({ ...previous, providers, loading: false }));
        }
      } catch {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            loading: false,
            error: previous.genres.length ? null : "Impossible de charger les options pour le moment.",
          }));
        }
      }
    };

    void load("genres");
    void load("providers");

    return () => {
      cancelled = true;
    };
  }, [mediaType]);

  return state;
}
