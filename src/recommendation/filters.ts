/**
 * Filtres DURS (§13).
 *
 * Un hard constraint n'est jamais cassé silencieusement : soit il est respecté,
 * soit l'utilisateur est prévenu via le mécanisme d'assouplissement (§37).
 *
 * Seules les contraintes listées dans `preferences.hardConstraints` sont
 * appliquées, plus les exclusions structurelles (genre interdit, catégorie
 * interdite) qui, elles, sont toujours strictes.
 *
 * RÈGLE « INCONNU ≠ CONFORME »
 * ----------------------------
 * En mode TMDB, `discover` ne fournit ni la durée d'un film, ni les saisons, ni
 * le statut d'une série, ni les plateformes : ces champs valent `null` tant que
 * l'œuvre n'a pas été enrichie (`candidate.verified === false`).
 *
 * Or `null` ne signifie pas « rien à signaler ». Si l'utilisateur demande
 * « maximum 2 saisons » et qu'on ignore le nombre de saisons, on ne peut pas le
 * lui promettre : le candidat est écarté. Sans cette règle, TONIGHT affichait
 * des séries annulées de 4 saisons en réponse à « une petite série terminée »,
 * simplement parce que le champ était inconnu.
 */

import type { Candidate, HardConstraintId, MediaType, TonightSearchPreferences } from "@/types/tonight";
import { GENRE, classifySeriesStatus } from "@/utils/constants";
import { canonicalGenres } from "@/utils/canonical";
import { calculateMoodFit } from "./moodScore";

export interface FilterOutcome {
  passed: Candidate[];
  rejected: number;
  /** Raison de rejet la plus fréquente (diagnostic). */
  mainReason: HardConstraintId | null;
}

function has(preferences: TonightSearchPreferences, constraint: HardConstraintId): boolean {
  return preferences.hardConstraints.includes(constraint);
}

/**
 * Une contrainte dure est-elle invérifiable pour ce candidat ?
 *
 * Vrai quand la donnée nécessaire manque ET que le candidat n'a pas été
 * enrichi. Un candidat `verified` dont le champ est `null` (TMDB ne connaît pas
 * la donnée) reste traité comme avant : on ne sanctionne pas l'absence de
 * données chez la source.
 */
function unknownAndUnverified(candidate: Candidate, value: unknown): boolean {
  return value === null && !candidate.verified;
}

/** Vérifie toutes les contraintes dures d'un candidat. */
export function violatedConstraint(
  candidate: Candidate,
  preferences: TonightSearchPreferences,
): HardConstraintId | null {
  if (preferences.mediaType !== "any" && candidate.mediaType !== preferences.mediaType) {
    return "mediaType";
  }

  if (has(preferences, "maxRuntime") && preferences.maxRuntime !== null && candidate.mediaType === "movie") {
    if (unknownAndUnverified(candidate, candidate.runtime)) return "maxRuntime";
    if (candidate.runtime !== null && candidate.runtime > preferences.maxRuntime) return "maxRuntime";
  }
  if (has(preferences, "minRuntime") && preferences.minRuntime !== null && candidate.mediaType === "movie") {
    if (unknownAndUnverified(candidate, candidate.runtime)) return "minRuntime";
    if (candidate.runtime !== null && candidate.runtime < preferences.minRuntime) return "minRuntime";
  }
  if (candidate.mediaType === "tv" && preferences.targetEpisodeRuntime !== null) {
    if (unknownAndUnverified(candidate, candidate.episodeRuntime)) return "maxRuntime";
    const tolerance = preferences.episodeRuntimeTolerance || 12;
    if (candidate.episodeRuntime !== null && candidate.episodeRuntime > preferences.targetEpisodeRuntime + tolerance) {
      return "maxRuntime";
    }
  }

  if (has(preferences, "minYear") && preferences.minYear !== null && candidate.year !== null) {
    if (candidate.year < preferences.minYear) return "minYear";
  }
  if (has(preferences, "maxYear") && preferences.maxYear !== null && candidate.year !== null) {
    if (candidate.year > preferences.maxYear) return "maxYear";
  }

  if (candidate.mediaType === "tv") {
    if (has(preferences, "maxSeasons") && preferences.maxSeasons !== null) {
      if (unknownAndUnverified(candidate, candidate.seasons)) return "maxSeasons";
      if (candidate.seasons !== null && candidate.seasons > preferences.maxSeasons) return "maxSeasons";
    }
    if (has(preferences, "minSeasons") && preferences.minSeasons !== null) {
      if (unknownAndUnverified(candidate, candidate.seasons)) return "minSeasons";
      if (candidate.seasons !== null && candidate.seasons < preferences.minSeasons) return "minSeasons";
    }
    if (has(preferences, "seriesEnded")) {
      if (unknownAndUnverified(candidate, candidate.status)) return "seriesEnded";
      const kind = classifySeriesStatus(candidate.status);
      // Une série annulée sans fin n'est PAS équivalente à une série terminée (§26).
      if (kind !== "ended") return "seriesEnded";
    }
  }

  // Exclusions de genres : toujours strictes.
  const genres = canonicalGenres(candidate.genres);
  if (preferences.hardExcludedGenres.some((genre) => genres.includes(genre))) return "excludeGenres";

  if (has(preferences, "requireGenre") && preferences.genres.length) {
    const wanted = preferences.genres.map((genre) => genre);
    if (!wanted.some((genre) => genres.includes(genre))) return "requireGenre";
  }

  // « Avoir peur » est une intention catégorique, pas une simple couleur
  // d'ambiance. Sans ce garde-fou, la qualité générale pouvait faire gagner un
  // drame extrêmement bien noté (comme Les Évadés) malgré un fit horreur nul.
  // Le genre, un keyword ou des indices suffisamment forts dans le synopsis
  // peuvent tous valider le mood, ce qui fonctionne aussi pour les séries TMDB
  // qui ne disposent pas d'un genre « Horreur » dédié.
  if (preferences.moods.includes("horror") && calculateMoodFit(candidate, "horror") < 0.5) {
    return "requireGenre";
  }

  if (preferences.excludeAnimation && genres.includes(GENRE.ANIMATION)) return "excludeAnimation";
  if (preferences.excludeDocumentary && genres.includes(GENRE.DOCUMENTARY)) return "excludeDocumentary";
  if (preferences.excludeMusical && genres.includes(GENRE.MUSIC)) return "excludeMusical";

  if (has(preferences, "minRating") && preferences.minRating !== null) {
    if (candidate.voteAverage > 0 && candidate.voteAverage < preferences.minRating) return "minRating";
  }

  if (has(preferences, "originalLanguage") && preferences.originalLanguage) {
    if (candidate.originalLanguage && candidate.originalLanguage !== preferences.originalLanguage) {
      return "originalLanguage";
    }
  }
  if (has(preferences, "originCountry") && preferences.originCountry) {
    if (candidate.originCountry.length && !candidate.originCountry.includes(preferences.originCountry)) {
      return "originCountry";
    }
  }

  if (has(preferences, "providers") && preferences.providers.length) {
    // Sans enrichissement, `discover` ne dit RIEN des plateformes : on ne peut
    // pas affirmer « c'est dispo sur Netflix ». Candidat écarté.
    if (!candidate.verified && !candidate.providers.length) return "providers";
    if (candidate.providers.length) {
      const allowed = preferences.monetizationTypes.length ? preferences.monetizationTypes : ["flatrate", "free", "ads"];
      const available = candidate.providers.some(
        (provider) =>
          preferences.providers.includes(provider.providerId) &&
          (allowed as string[]).includes(provider.monetization),
      );
      // Une œuvre vérifiée dont TMDB ne liste aucune plateforme en FR a des
      // disponibilités vides : c'est une absence d'information de la source, on
      // ne la rejette donc pas.
      if (!available) return "providers";
    }
  }

  return null;
}

/** Applique tous les filtres durs et renvoie le pool exploitable. */
export function applyHardFilters(
  candidates: Candidate[],
  preferences: TonightSearchPreferences,
): FilterOutcome {
  const passed: Candidate[] = [];
  const reasons = new Map<HardConstraintId, number>();
  let rejected = 0;

  for (const candidate of candidates) {
    const violation = violatedConstraint(candidate, preferences);
    if (violation) {
      rejected += 1;
      reasons.set(violation, (reasons.get(violation) ?? 0) + 1);
      continue;
    }
    passed.push(candidate);
  }

  let mainReason: HardConstraintId | null = null;
  let best = 0;
  for (const [reason, count] of reasons) {
    if (count > best) {
      best = count;
      mainReason = reason;
    }
  }

  return { passed, rejected, mainReason };
}

/** Exclusions de session : « Un autre » ne repropose jamais la même œuvre (§42). */
export function excludeSession(
  candidates: Candidate[],
  sessionExcluded: string[],
  alreadyOffered: Array<{ mediaType: MediaType; id: number }> = [],
): Candidate[] {
  const excluded = new Set(sessionExcluded);
  alreadyOffered.forEach((item) => excluded.add(`${item.mediaType}:${item.id}`));
  if (!excluded.size) return candidates;
  return candidates.filter((candidate) => !excluded.has(`${candidate.mediaType}:${candidate.id}`));
}
