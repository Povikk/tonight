/**
 * Préférences par défaut.
 *
 * Un seul point de création : garantit qu'aucun champ n'est oublié et que le
 * moteur de recommandation ne reçoit jamais un objet partiel.
 */

import type { PreferencesSource, TonightSearchPreferences } from "@/types/tonight";

export function createEmptyPreferences(
  source: PreferencesSource = "questionnaire",
  overrides: Partial<TonightSearchPreferences> = {},
): TonightSearchPreferences {
  return {
    mediaType: "any",

    genres: [],
    excludedGenres: [],
    hardExcludedGenres: [],
    excludedGenreCombos: [],

    moods: [],
    excludedMoods: [],

    minYear: null,
    maxYear: null,
    softMinYear: null,
    softMaxYear: null,
    softRecent: false,
    softOld: false,

    minRuntime: null,
    maxRuntime: null,
    softMinRuntime: null,
    softMaxRuntime: null,

    targetEpisodeRuntime: null,
    episodeRuntimeTolerance: 12,

    minSeasons: null,
    maxSeasons: null,
    seriesStatus: null,
    commitment: null,

    discoveryLevel: null,
    qualityPreference: null,

    providers: [],
    monetizationTypes: [],

    minRating: null,
    originalLanguage: null,
    originCountry: null,

    excludeAnimation: false,
    excludeDocumentary: false,
    excludeMusical: false,

    hardConstraints: [],
    softPreferences: [],

    confidence: 0.5,

    source,
    ...overrides,
  };
}

/** Ajoute une contrainte dure sans doublon. */
export function withHardConstraint(
  preferences: TonightSearchPreferences,
  constraint: TonightSearchPreferences["hardConstraints"][number],
): TonightSearchPreferences {
  if (preferences.hardConstraints.includes(constraint)) return preferences;
  return { ...preferences, hardConstraints: [...preferences.hardConstraints, constraint] };
}

/** Ajoute une préférence souple sans doublon. */
export function withSoftPreference(
  preferences: TonightSearchPreferences,
  preference: TonightSearchPreferences["softPreferences"][number],
): TonightSearchPreferences {
  if (preferences.softPreferences.includes(preference)) return preferences;
  return { ...preferences, softPreferences: [...preferences.softPreferences, preference] };
}

/** Fusionne des préférences (les valeurs non nulles de `patch` écrasent). */
export function mergePreferences(
  base: TonightSearchPreferences,
  patch: Partial<TonightSearchPreferences>,
): TonightSearchPreferences {
  const merged: TonightSearchPreferences = { ...base, ...patch };
  merged.hardConstraints = [...new Set([...base.hardConstraints, ...(patch.hardConstraints ?? [])])];
  merged.softPreferences = [...new Set([...base.softPreferences, ...(patch.softPreferences ?? [])])];
  return merged;
}
