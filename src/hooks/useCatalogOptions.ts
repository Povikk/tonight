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

    // Le média change : on repart d'options vierges pour ne jamais afficher les
    // genres ou plateformes de l'autre type pendant le chargement.
    setState({ genres: [], providers: [], loading: true, error: null });

    const cachedGenres = readBrowserCache<GenreOption[]>(`genres:${mediaType}`);
    const cachedProviders = readBrowserCache<ProviderOption[]>(`providers:${mediaType}`);

    if (cachedGenres?.length || cachedProviders?.length) {
      setState({
        genres: cachedGenres ?? [],
        providers: cachedProviders ?? [],
        loading: !(cachedGenres?.length && cachedProviders?.length),
        error: null,
      });
    }
    if (cachedGenres?.length && cachedProviders?.length) {
      return () => {
        cancelled = true;
      };
    }

    let pending = 2;
    const settle = (patch: Partial<OptionsState>) => {
      if (cancelled) return;
      setState((previous) => ({ ...previous, ...patch }));
      pending -= 1;
      if (pending === 0) setState((previous) => ({ ...previous, loading: false }));
    };

    const load = async (kind: "genres" | "providers") => {
      try {
        const response = await fetch(`/api/catalog?kind=${kind}&mediaType=${mediaType}`);
        if (cancelled) return;
        // Une erreur HTTP était auparavant traitée comme une liste vide.
        if (!response.ok) throw new Error(`catalog ${response.status}`);
        const payload = (await response.json()) as Record<string, unknown>;
        if (cancelled) return;
        if (kind === "genres") {
          const genres = (payload.genres as GenreOption[]) ?? [];
          writeBrowserCache(`genres:${mediaType}`, genres, ONE_DAY);
          settle({ genres });
        } else {
          const providers = (payload.providers as ProviderOption[]) ?? [];
          writeBrowserCache(`providers:${mediaType}`, providers, ONE_DAY);
          settle({ providers });
        }
      } catch {
        settle({ error: "Impossible de charger les options pour le moment." });
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
