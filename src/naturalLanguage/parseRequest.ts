/**
 * `parseNaturalLanguageRequest()`, point d'entrée du parser français.
 *
 * Pipeline :
 *   normalize → détecteurs indépendants → assemblage en `TonightSearchPreferences`
 *   → chips « J'ai compris » → score de confiance.
 *
 * Aucune API IA payante n'est nécessaire (§9). L'architecture est prévue pour
 * brancher plus tard un LLM : il suffirait de produire le même objet de
 * préférences, le moteur de recommandation ne changerait pas.
 */

import { createEmptyPreferences, withHardConstraint, withSoftPreference } from "@/data/defaultPreferences";
import { GENRE } from "@/utils/constants";
import type { MediaTypeChoice, MonetizationType, Mood, PreferencesSource, TonightSearchPreferences } from "@/types/tonight";
import type { ParsedRequest } from "@/types/tonight";
import { buildChips } from "./chips";
import { COUNTRY_PHRASES, LANGUAGE_PHRASES } from "./dictionaries";
import { detectDates } from "./detectDates";
import { detectDiscovery } from "./detectDiscovery";
import { detectExclusions } from "./detectExclusions";
import { detectGenres } from "./detectGenres";
import { detectMediaType } from "./detectMediaType";
import { detectMoods } from "./detectMoods";
import { detectProviders } from "./detectProviders";
import { detectQuality } from "./detectQuality";
import { detectRuntime } from "./detectRuntime";
import { detectSeriesPreferences } from "./detectSeriesPreferences";
import { createTextContext, findPhrase, negationState } from "./normalizeText";

const CURRENT_YEAR = new Date().getFullYear();
/** Fenêtre « récent » par défaut. */
const RECENT_WINDOW_YEARS = 12;
/** Durée visée quand l'utilisateur dit « pas trop long ». */
const SHORT_TARGET_MINUTES = 110;

export interface ParseOptions {
  /** Média imposé par le parcours (choix de l'utilisateur, questionnaire, YOLO). */
  forcedMediaType?: MediaTypeChoice;
  source?: PreferencesSource;
}

/**
 * Analyse une demande en français et produit des préférences structurées.
 */
export function parseNaturalLanguageRequest(query: string, options: ParseOptions = {}): ParsedRequest {
  const { forcedMediaType, source = "natural_language" } = options;
  const context = createTextContext(query);

  const media = detectMediaType(context);
  const runtime = detectRuntime(context);
  const dates = detectDates(context);
  const genres = detectGenres(context);
  const moods = detectMoods(context);
  const exclusions = detectExclusions(context);
  const series = detectSeriesPreferences(context);
  const discovery = detectDiscovery(context);
  const quality = detectQuality(context);
  const providers = detectProviders(context);

  /* ---------------------------------------------------------------- */
  /* Langue et pays d'origine                                          */
  /* ---------------------------------------------------------------- */
  let originalLanguage: string | null = null;
  let originCountry: string | null = null;
  const languageEvidence: string[] = [];
  const countryEvidence: string[] = [];

  for (const entry of LANGUAGE_PHRASES) {
    const matches = entry.phrases.flatMap((phrase) => findPhrase(context, phrase));
    if (matches.some((match) => negationState(match) !== "negated" && negationState(match) !== "neutralized")) {
      originalLanguage = entry.code;
      languageEvidence.push(entry.code);
    }
  }
  for (const entry of COUNTRY_PHRASES) {
    const matches = entry.phrases.flatMap((phrase) => findPhrase(context, phrase));
    if (matches.some((match) => negationState(match) !== "negated" && negationState(match) !== "neutralized")) {
      originCountry = entry.code;
      countryEvidence.push(entry.code);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Type de média                                                     */
  /* ---------------------------------------------------------------- */
  let mediaType: MediaTypeChoice = forcedMediaType ?? media.value ?? "any";
  if (!forcedMediaType && mediaType === "any" && !media.explicit) {
    // Inférence : des signaux de série (saisons, statut, épisodes) sans durée de
    // film indiquent une série, et inversement.
    const seriesSignals = series.explicit;
    const movieSignals = runtime.explicit;
    if (seriesSignals && !movieSignals) mediaType = "tv";
    else if (movieSignals && !seriesSignals) mediaType = "movie";
  }

  const needsMediaTypeQuestion =
    !forcedMediaType && (media.value === null) && mediaType === "any";

  /* ---------------------------------------------------------------- */
  /* Assemblage des préférences                                        */
  /* ---------------------------------------------------------------- */
  let preferences = createEmptyPreferences(source, {
    mediaType,
    rawQuery: query,
  });

  // Genres
  preferences.genres = genres.value.genres;
  preferences.excludedGenres = genres.value.excluded;
  preferences.hardExcludedGenres = genres.value.hardExcluded;
  preferences.excludedGenreCombos = [...exclusions.value.combos, ...exclusions.value.softCombos];
  preferences.excludeAnimation = exclusions.value.excludeAnimation;
  preferences.excludeDocumentary = exclusions.value.excludeDocumentary;
  preferences.excludeMusical = exclusions.value.excludeMusical;

  // Moods
  preferences.moods = moods.value.filter((mood) => !moods.excluded.includes(mood));
  preferences.excludedMoods = moods.excluded;

  // Époque
  preferences.minYear = dates.value.minYear;
  preferences.maxYear = dates.value.maxYear;
  preferences.softRecent = dates.value.softRecent;
  preferences.softOld = dates.value.softOld;
  if (dates.value.softRecent && dates.value.minYear === null) {
    preferences.softMinYear = CURRENT_YEAR - RECENT_WINDOW_YEARS;
  }
  if (dates.value.softOld && dates.value.maxYear === null) {
    preferences.softMaxYear = 2005;
  }

  // Durée
  const movieRuntime = mediaType === "tv" ? { min: null, max: null } : { min: runtime.value.min, max: runtime.value.max };
  preferences.minRuntime = movieRuntime.min;
  preferences.maxRuntime = movieRuntime.max;

  // Durée d'épisode : explicite, sinon une durée courte annoncée pour une série.
  if (series.value.episodeRuntime !== null) {
    preferences.targetEpisodeRuntime = series.value.episodeRuntime;
    preferences.episodeRuntimeTolerance = series.value.episodeTolerance;
  } else if (mediaType === "tv" && runtime.value.max !== null && runtime.value.max <= 45) {
    preferences.targetEpisodeRuntime = runtime.value.max;
    preferences.episodeRuntimeTolerance = 12;
    preferences.maxRuntime = null;
  }
  if (runtime.value.softShort) {
    preferences.softMaxRuntime = SHORT_TARGET_MINUTES;
  }
  if (runtime.value.softLong) {
    preferences.softMinRuntime = 130;
  }

  // Séries
  preferences.minSeasons = series.value.minSeasons;
  preferences.maxSeasons = series.value.maxSeasons;
  preferences.seriesStatus = series.value.status;
  preferences.commitment = series.value.commitment;

  // Découverte / qualité
  preferences.discoveryLevel = discovery.value;
  preferences.qualityPreference = quality.value.preference;
  preferences.minRating = quality.value.minRating;

  // Plateformes
  preferences.providers = providers.value.providers.filter(
    (id) => !providers.value.excludedProviders.includes(id),
  );
  preferences.monetizationTypes = providers.value.monetization as MonetizationType[];

  // Langue / pays
  preferences.originalLanguage = originalLanguage;
  preferences.originCountry = originCountry;

  /* ---------------------------------------------------------------- */
  /* Contraintes dures                                                 */
  /* ---------------------------------------------------------------- */
  if (mediaType !== "any") preferences = withHardConstraint(preferences, "mediaType");
  if (preferences.maxRuntime !== null) preferences = withHardConstraint(preferences, "maxRuntime");
  if (preferences.minRuntime !== null) preferences = withHardConstraint(preferences, "minRuntime");
  // La durée des épisodes est un critère de format : on la traite comme dure,
  // avec la tolérance exprimée par l'utilisateur (« environ », « maximum »).
  if (preferences.targetEpisodeRuntime !== null) preferences = withHardConstraint(preferences, "maxRuntime");
  if (dates.explicit && preferences.minYear !== null) preferences = withHardConstraint(preferences, "minYear");
  if (dates.explicit && preferences.maxYear !== null) preferences = withHardConstraint(preferences, "maxYear");
  if (preferences.maxSeasons !== null && series.explicit) preferences = withHardConstraint(preferences, "maxSeasons");
  if (preferences.minSeasons !== null && series.explicit) preferences = withHardConstraint(preferences, "minSeasons");
  if (preferences.seriesStatus === "ended" && series.value.statusIsHard) {
    preferences = withHardConstraint(preferences, "seriesEnded");
  }
  if (preferences.hardExcludedGenres.length) preferences = withHardConstraint(preferences, "excludeGenres");
  if (preferences.genres.length) preferences = withHardConstraint(preferences, "requireGenre");
  if (preferences.providers.length) preferences = withHardConstraint(preferences, "providers");
  if (preferences.minRating !== null) preferences = withHardConstraint(preferences, "minRating");
  if (preferences.excludeAnimation) preferences = withHardConstraint(preferences, "excludeAnimation");
  if (preferences.excludeDocumentary) preferences = withHardConstraint(preferences, "excludeDocumentary");
  if (preferences.excludeMusical) preferences = withHardConstraint(preferences, "excludeMusical");
  if (preferences.originalLanguage) preferences = withHardConstraint(preferences, "originalLanguage");
  if (preferences.originCountry) preferences = withHardConstraint(preferences, "originCountry");

  /* ---------------------------------------------------------------- */
  /* Préférences souples                                               */
  /* ---------------------------------------------------------------- */
  if (preferences.softRecent) preferences = withSoftPreference(preferences, "recent");
  if (preferences.softOld) preferences = withSoftPreference(preferences, "old");
  if (preferences.softMaxRuntime !== null) preferences = withSoftPreference(preferences, "shortRuntime");
  if (preferences.softMinRuntime !== null) preferences = withSoftPreference(preferences, "longRuntime");
  if (preferences.moods.includes("feel_good") || preferences.moods.includes("easy_watch")) {
    preferences = withSoftPreference(preferences, "light");
  }
  if (preferences.moods.includes("beautiful") || dates.value.avoidBlackAndWhite) {
    preferences = withSoftPreference(preferences, "beautiful");
  }
  if (preferences.excludedMoods.some((mood) => ["sad", "heavy", "dark"].includes(mood))) {
    preferences = withSoftPreference(preferences, "notHeavy");
  }
  if (preferences.qualityPreference && preferences.qualityPreference !== "risky") {
    preferences = withSoftPreference(preferences, "wellRated");
  }
  if (preferences.discoveryLevel === "hidden_gem" || preferences.discoveryLevel === "obscure") {
    preferences = withSoftPreference(preferences, "hiddenGem");
  }
  if (preferences.discoveryLevel === "mainstream" || preferences.discoveryLevel === "safe") {
    preferences = withSoftPreference(preferences, "mainstream");
  }
  if (preferences.seriesStatus === "ended" && !preferences.hardConstraints.includes("seriesEnded")) {
    preferences = withSoftPreference(preferences, "strongEnding");
  }
  if (preferences.maxSeasons !== null && preferences.maxSeasons <= 2 && preferences.commitment) {
    preferences = withSoftPreference(preferences, "fewSeasons");
  }
  if (preferences.targetEpisodeRuntime !== null && preferences.targetEpisodeRuntime <= 32) {
    preferences = withSoftPreference(preferences, "shortEpisodes");
  }
  if (preferences.providers.length) preferences = withSoftPreference(preferences, "availableNow");

  /* ---------------------------------------------------------------- */
  /* Confiance                                                         */
  /* ---------------------------------------------------------------- */
  const confidence = computeConfidence({
    query,
    mediaTypeDetected: media.explicit || Boolean(forcedMediaType),
    hasDimensions: genres.value.genres.length + moods.value.length + moods.excluded.length > 0,
    explicitNumbers: runtime.explicit || dates.explicit || quality.explicit || series.explicit,
    hasProviders: providers.value.providers.length > 0,
    hasAxes: Boolean(discovery.value) || Boolean(quality.value.preference),
  });
  preferences.confidence = confidence;

  const chips = buildChips(preferences);

  return {
    preferences,
    chips,
    needsMediaTypeQuestion,
    question: needsMediaTypeQuestion ? "Plutôt ?" : null,
    matches: [
      ...media.evidence,
      ...genres.evidence,
      ...moods.evidence,
      ...dates.evidence,
      ...runtime.evidence,
      ...series.evidence,
      ...discovery.evidence,
      ...quality.evidence,
      ...providers.evidence,
      ...languageEvidence,
      ...countryEvidence,
    ],
  };
}

interface ConfidenceInput {
  query: string;
  mediaTypeDetected: boolean;
  hasDimensions: boolean;
  explicitNumbers: boolean;
  hasProviders: boolean;
  hasAxes: boolean;
}

/**
 * Score de confiance interne (§15).
 *
 * Sous 0.55, TONIGHT pose UNE question au lieu de partir dans la mauvaise
 * direction. Il ne s'agit pas d'une probabilité mais d'un indicateur de
 * richesse de la compréhension.
 */
export function computeConfidence(input: ConfidenceInput): number {
  let score = 0.28;
  if (input.mediaTypeDetected) score += 0.22;
  if (input.hasDimensions) score += 0.18;
  if (input.explicitNumbers) score += 0.16;
  if (input.hasProviders) score += 0.06;
  if (input.hasAxes) score += 0.06;

  const wordCount = input.query.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount >= 5) score += 0.06;
  if (wordCount >= 9) score += 0.06;

  return Math.max(0, Math.min(0.97, Number(score.toFixed(2))));
}

/** Question unique générée quand une information essentielle manque. */
export function buildMediaTypeQuestion(): { question: string; options: Array<{ value: MediaTypeChoice; label: string }> } {
  return {
    question: "Plutôt ?",
    options: [
      { value: "movie", label: "🎬 FILM" },
      { value: "tv", label: "📺 SÉRIE" },
      { value: "any", label: "🎲 CHOISIS POUR MOI" },
    ],
  };
}

export type { ParsedRequest };
export { GENRE };
export type { Mood };
