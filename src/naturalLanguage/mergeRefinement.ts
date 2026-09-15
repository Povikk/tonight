import type { TonightSearchPreferences } from "@/types/tonight";

/**
 * Le raccourci « Plus récent » doit réellement avancer à chaque clic.
 * On exige au minimum les 12 dernières années, puis une année de plus que
 * l'œuvre actuellement affichée (sans dépasser l'année courante).
 */
export function progressiveRecentYear(
  candidateYear: number | null,
  currentYear = new Date().getFullYear(),
): number {
  const recentBaseline = currentYear - 12;
  if (candidateYear === null) return recentBaseline;
  return Math.min(currentYear, Math.max(recentBaseline, candidateYear + 1));
}

function union<T>(left: T[], right: T[]): T[] {
  return [...new Set([...left, ...right])];
}

/**
 * Ajoute une demande courte ("plus récent", "moins effrayant"…) aux
 * préférences en cours sans effacer ce que l'utilisateur avait déjà choisi.
 */
export function mergeRefinementPreferences(
  base: TonightSearchPreferences,
  refinement: TonightSearchPreferences,
): TonightSearchPreferences {
  const excludedGenres = union(base.excludedGenres, refinement.excludedGenres);
  const hardExcludedGenres = union(base.hardExcludedGenres, refinement.hardExcludedGenres);
  const forbiddenGenres = new Set([...excludedGenres, ...hardExcludedGenres]);
  const excludedMoods = union(base.excludedMoods, refinement.excludedMoods);

  const softRecent = refinement.softRecent ? true : refinement.softOld ? false : base.softRecent;
  const softOld = refinement.softOld ? true : refinement.softRecent ? false : base.softOld;

  return {
    ...base,
    genres: union(base.genres, refinement.genres).filter((id) => !forbiddenGenres.has(id)),
    excludedGenres,
    hardExcludedGenres,
    excludedGenreCombos: union(base.excludedGenreCombos, refinement.excludedGenreCombos),
    moods: union(base.moods, refinement.moods).filter((mood) => !excludedMoods.includes(mood)),
    excludedMoods,
    minYear: refinement.minYear ?? base.minYear,
    maxYear: refinement.maxYear ?? base.maxYear,
    softMinYear: refinement.softMinYear ?? base.softMinYear,
    softMaxYear: refinement.softMaxYear ?? base.softMaxYear,
    softRecent,
    softOld,
    minRuntime: refinement.minRuntime ?? base.minRuntime,
    maxRuntime: refinement.maxRuntime ?? base.maxRuntime,
    softMinRuntime: refinement.softMinRuntime ?? base.softMinRuntime,
    softMaxRuntime: refinement.softMaxRuntime ?? base.softMaxRuntime,
    targetEpisodeRuntime: refinement.targetEpisodeRuntime ?? base.targetEpisodeRuntime,
    episodeRuntimeTolerance:
      refinement.targetEpisodeRuntime !== null
        ? refinement.episodeRuntimeTolerance
        : base.episodeRuntimeTolerance,
    minSeasons: refinement.minSeasons ?? base.minSeasons,
    maxSeasons: refinement.maxSeasons ?? base.maxSeasons,
    seriesStatus: refinement.seriesStatus ?? base.seriesStatus,
    commitment: refinement.commitment ?? base.commitment,
    discoveryLevel: refinement.discoveryLevel ?? base.discoveryLevel,
    qualityPreference: refinement.qualityPreference ?? base.qualityPreference,
    providers: union(base.providers, refinement.providers),
    monetizationTypes: union(base.monetizationTypes, refinement.monetizationTypes),
    minRating: refinement.minRating ?? base.minRating,
    originalLanguage: refinement.originalLanguage ?? base.originalLanguage,
    originCountry: refinement.originCountry ?? base.originCountry,
    excludeAnimation: base.excludeAnimation || refinement.excludeAnimation,
    excludeDocumentary: base.excludeDocumentary || refinement.excludeDocumentary,
    excludeMusical: base.excludeMusical || refinement.excludeMusical,
    hardConstraints: union(base.hardConstraints, refinement.hardConstraints),
    softPreferences: union(base.softPreferences, refinement.softPreferences),
    confidence: Math.max(base.confidence, refinement.confidence),
    // L'affinage est disponible depuis tous les parcours : questionnaire,
    // Express, langage naturel et YOLO gardent leur origine.
    source: base.source,
    rawQuery: refinement.rawQuery,
  };
}
