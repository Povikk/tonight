/**
 * Assouplissement intelligent (§37).
 *
 * Si rien ne correspond, TONIGHT ne dit pas « Aucun résultat ». Il relâche des
 * critères SOUPLES, dans un ordre réfléchi, et PRÉVIENT toujours l'utilisateur
 * de ce qu'il a lâché. Les contraintes dures ne sont cassées qu'en dernier
 * recours, avec un message explicite.
 */

import { providerName } from "@/utils/providers";
import type { Relaxation, TonightSearchPreferences } from "@/types/tonight";

export interface Attempt {
  label: string;
  preferences: TonightSearchPreferences;
  /** Interroger la source sans filtres durs distants. */
  soft: boolean;
  /** Ignorer le filtre plateformes. */
  skipProviders: boolean;
  /** Assouplissements cumulés, affichés à l'utilisateur. */
  relaxations: Relaxation[];
}

function clone(preferences: TonightSearchPreferences): TonightSearchPreferences {
  return {
    ...preferences,
    genres: [...preferences.genres],
    excludedGenres: [...preferences.excludedGenres],
    hardExcludedGenres: [...preferences.hardExcludedGenres],
    excludedGenreCombos: preferences.excludedGenreCombos.map(([a, b]) => [a, b] as [number, number]),
    moods: [...preferences.moods],
    excludedMoods: [...preferences.excludedMoods],
    providers: [...preferences.providers],
    monetizationTypes: [...preferences.monetizationTypes],
    hardConstraints: [...preferences.hardConstraints],
    softPreferences: [...preferences.softPreferences],
  };
}

function dropConstraint(preferences: TonightSearchPreferences, constraint: string): void {
  preferences.hardConstraints = preferences.hardConstraints.filter((item) => item !== constraint);
}

/**
 * Construit la séquence de tentatives.
 * La première est la plus stricte ; chacune relâche un cran de plus.
 */
export function buildAttempts(preferences: TonightSearchPreferences): Attempt[] {
  const attempts: Attempt[] = [
    { label: "strict", preferences: clone(preferences), soft: false, skipProviders: false, relaxations: [] },
  ];
  let current = clone(preferences);
  let relaxations: Relaxation[] = [];

  if (preferences.providers.length) {
    current = clone(current);
    current.providers = [];
    dropConstraint(current, "providers");
    current.softPreferences = current.softPreferences.filter((item) => item !== "availableNow");
    relaxations = [
      ...relaxations,
      {
        kind: "providers",
        message: `Je n'ai rien trouvé sur ${preferences.providers.map(providerName).join(" ou ")}, alors j'ai regardé partout.`,
      },
    ];
    attempts.push({ label: "providers", preferences: clone(current), soft: false, skipProviders: true, relaxations: [...relaxations] });
  }

  if (current.targetEpisodeRuntime !== null) {
    // Épisodes : on élargit la fourchette plutôt que de changer de format.
    const widened = current.episodeRuntimeTolerance + 12;
    const original = current.episodeRuntimeTolerance;
    current = clone(current);
    current.episodeRuntimeTolerance = widened;
    relaxations = [
      ...relaxations,
      {
        kind: "maxRuntime",
        message: `J'ai élargi la durée acceptée des épisodes (au lieu de ±${original} min).`,
      },
    ];
    attempts.push({ label: "runtime", preferences: clone(current), soft: false, skipProviders: true, relaxations: [...relaxations] });
  }

  if (current.maxRuntime !== null) {
    // On transforme la contrainte dure en préférence souple un peu élargie.
    const widened = Math.round((current.maxRuntime * 1.2) / 5) * 5;
    const original = current.maxRuntime;
    current = clone(current);
    current.maxRuntime = null;
    current.softMaxRuntime = widened;
    current.softPreferences = [...new Set([...current.softPreferences, "shortRuntime" as const])];
    dropConstraint(current, "maxRuntime");
    relaxations = [
      ...relaxations,
      {
        kind: "maxRuntime",
        message: `Je n'ai rien trouvé sous ${original} minutes, alors j'ai élargi un peu la durée.`,
      },
    ];
    attempts.push({ label: "runtime", preferences: clone(current), soft: false, skipProviders: true, relaxations: [...relaxations] });
  }

  const requestedRating = current.minRating;
  if (requestedRating !== null) {
    current = clone(current);
    const relaxed = Math.max(5.5, requestedRating - 0.6);
    current.minRating = relaxed;
    dropConstraint(current, "minRating");
    relaxations = [
      ...relaxations,
      { kind: "minRating", message: `J'ai descendu la note minimale à ${relaxed.toFixed(1).replace(".", ",")}.` },
    ];
    attempts.push({ label: "rating", preferences: clone(current), soft: false, skipProviders: true, relaxations: [...relaxations] });
  }

  if (current.minYear !== null || current.maxYear !== null) {
    current = clone(current);
    if (current.minYear !== null) current.minYear = Math.max(1900, current.minYear - 8);
    if (current.maxYear !== null) current.maxYear = current.maxYear + 8;
    dropConstraint(current, "minYear");
    dropConstraint(current, "maxYear");
    relaxations = [
      ...relaxations,
      { kind: "years", message: "J'ai élargi la période pour te trouver quelque chose de mieux." },
    ];
    attempts.push({ label: "years", preferences: clone(current), soft: false, skipProviders: true, relaxations: [...relaxations] });
  }

  // Nombre de saisons : on DESSERRE la contrainte au lieu de la lâcher.
  //
  // La distinction est essentielle. En retirant la contrainte, « une mini-série
  // avec une vraie fin » (1 saison) renvoyait Dr. House (8 saisons) ou
  // Supernatural (15 saisons) : l'assouplissement avait fait pire que le strict.
  // En gardant la contrainte dure sur une valeur élargie, la promesse tenue
  // reste vérifiable, et le message dit exactement ce qui a été élargi.
  if (current.maxSeasons !== null) {
    const widened = current.maxSeasons + 2;
    current = clone(current);
    current.maxSeasons = widened;
    relaxations = [
      ...relaxations,
      {
        kind: "seriesStatus",
        message: `Je n'ai pas trouvé de série aussi courte, alors j'ai élargi jusqu'à ${widened} saisons.`,
      },
    ];
    attempts.push({ label: "seasons", preferences: clone(current), soft: false, skipProviders: true, relaxations: [...relaxations] });
  }

  // Statut : « terminée » devient « en cours acceptée », mais seulement APRÈS
  // les tentatives sur le format : une série en cours de 12 saisons n'aiderait
  // personne sur une demande de petite série.
  if (current.seriesStatus === "ended") {
    current = clone(current);
    current.seriesStatus = "any";
    dropConstraint(current, "seriesEnded");
    current.softPreferences = [...new Set([...current.softPreferences, "strongEnding" as const])];
    relaxations = [
      ...relaxations,
      {
        kind: "seriesStatus",
        message: "Je n'ai pas trouvé de série terminée : je regarde aussi les séries en cours.",
      },
    ];
    attempts.push({ label: "status", preferences: clone(current), soft: false, skipProviders: true, relaxations: [...relaxations] });
  }

  // Dernier recours : on interroge la source sans filtres tour et on ne garde
  // que le média et les exclusions vraiment non négociables.
  current = clone(current);
  dropConstraint(current, "requireGenre");
  dropConstraint(current, "minRuntime");
  dropConstraint(current, "originalLanguage");
  dropConstraint(current, "originCountry");
  dropConstraint(current, "minSeasons");
  current.genres = [];
  current.minSeasons = null;
  attempts.push({
    label: "all",
    preferences: clone(current),
    soft: true,
    skipProviders: true,
    relaxations: [
      ...relaxations,
      { kind: "all", message: "J'ai lâché la plupart de tes critères pour te trouver quelque chose malgré tout." },
    ],
  });

  return attempts;
}

/** Toutes les contraintes ont-elles été lâchées ? */
export function isFullyRelaxed(attempt: Attempt, preferences: TonightSearchPreferences): boolean {
  if (attempt.label !== "all") return false;
  return (
    preferences.maxRuntime !== null ||
    preferences.minYear !== null ||
    preferences.minRating !== null ||
    preferences.providers.length > 0 ||
    preferences.maxSeasons !== null
  );
}
