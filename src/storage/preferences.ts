/**
 * Préférences d'application (§30, §69).
 *
 * On mémorise ce qui évite de tout redemander : plateformes habituelles,
 * dernier média utilisé, et le fait que l'utilisateur a déjà vu l'accueil.
 */

import type { DiscoveryLevel, MediaTypeChoice, MonetizationType, TonightSearchPreferences } from "@/types/tonight";
import { STORAGE_KEYS, storageKey } from "./storageVersion";
import { createLocalStore } from "./safeStorage";

export interface AppSettings {
  /** L'utilisateur a déjà validé l'écran de premier lancement. */
  onboarded: boolean;
  /** Plateformes habituelles, mémorisées entre les sessions (§30). */
  defaultProviders: number[];
  defaultMonetization: MonetizationType[];
  defaultDiscovery: DiscoveryLevel | null;
  /** Dernier type de média choisi (Film / Série). */
  lastMediaType: MediaTypeChoice;
  /** Dernière recherche en langage naturel (confort d'usage). */
  lastQuery: string;
  /**
   * Corrections manuelles de goûts (§46) : l'utilisateur peut dire « j'aime
   * plus ce genre » ou « je n'aime pas ça » sans effacer son historique.
   */
  tasteOverrides: { likedGenres: number[]; dislikedGenres: number[] };
  /** Version du format au moment de l'écriture. */
  version: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  defaultProviders: [],
  defaultMonetization: [],
  defaultDiscovery: null,
  lastMediaType: "movie",
  lastQuery: "",
  tasteOverrides: { likedGenres: [], dislikedGenres: [] },
  version: 1,
};

function migrate(raw: unknown): AppSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const entry = raw as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...entry,
    defaultProviders: Array.isArray(entry.defaultProviders) ? entry.defaultProviders : [],
    defaultMonetization: Array.isArray(entry.defaultMonetization) ? entry.defaultMonetization : [],
    tasteOverrides: {
      likedGenres: Array.isArray(entry.tasteOverrides?.likedGenres) ? entry.tasteOverrides.likedGenres : [],
      dislikedGenres: Array.isArray(entry.tasteOverrides?.dislikedGenres) ? entry.tasteOverrides.dislikedGenres : [],
    },
  };
}

/** Ajoute/retire un goût explicite. */
export function overrideTaste(genreId: number, like: boolean | null): void {
  settingsStore.set((previous) => {
    const liked = previous.tasteOverrides.likedGenres.filter((id) => id !== genreId);
    const disliked = previous.tasteOverrides.dislikedGenres.filter((id) => id !== genreId);
    if (like === true) liked.push(genreId);
    if (like === false) disliked.push(genreId);
    return { ...previous, tasteOverrides: { likedGenres: liked, dislikedGenres: disliked } };
  });
}

export const settingsStore = createLocalStore<AppSettings>(
  storageKey(STORAGE_KEYS.settings),
  DEFAULT_SETTINGS,
  { migrate },
);

export function getSettings(): AppSettings {
  return settingsStore.get();
}

export function updateSettings(patch: Partial<AppSettings>): void {
  settingsStore.set((previous) => ({ ...previous, ...patch, version: 1 }));
}

/** Mémorise les plateformes choisies pour les prochaines recherches. */
export function rememberProviders(preferences: TonightSearchPreferences): void {
  if (!preferences.providers.length) return;
  updateSettings({
    defaultProviders: preferences.providers,
    defaultMonetization: preferences.monetizationTypes,
  });
}

/** Applique les préférences mémorisées à une nouvelle recherche. */
export function applyRememberedDefaults(preferences: TonightSearchPreferences): TonightSearchPreferences {
  const settings = getSettings();
  if (!settings.defaultProviders.length) return preferences;
  return {
    ...preferences,
    providers: preferences.providers.length ? preferences.providers : settings.defaultProviders,
    monetizationTypes: preferences.monetizationTypes.length
      ? preferences.monetizationTypes
      : settings.defaultMonetization,
  };
}

export function completeOnboarding(): void {
  updateSettings({ onboarded: true });
}
