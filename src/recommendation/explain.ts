/**
 * « Pourquoi Tonight l'a choisi » (§40).
 *
 * Les phrases sont construites à partir des critères RÉELLEMENT responsables du
 * score. Aucune IA externe n'est nécessaire.
 */

import { genreCoveredByMoods, moodDefinition } from "@/data/moods";
import type { Candidate, Mood, ScoredCandidate, TonightSearchPreferences } from "@/types/tonight";
import { genreName, classifySeriesStatus } from "@/utils/constants";
import { joinFr } from "@/utils/text";
import { formatRuntime } from "@/utils/format";

function pronoun(candidate: Candidate): string {
  return candidate.mediaType === "movie" ? "Celui-ci" : "Celle-ci";
}

/**
 * Expression d'un mood dans une phrase commençant par « Tu voulais… ».
 *
 * On n'écrit PAS « quelque chose de + libellé » : les libellés du questionnaire
 * (« Un peu d'amour », « Faire rire »…) ne s'y prêtent pas. Chaque mood a donc sa
 * tournure naturelle, écrite à la main.
 */
const MOOD_PHRASES: Partial<Record<Mood, string>> = {
  funny: "quelque chose de drôle",
  romance: "un peu d'amour",
  feel_good: "quelque chose de feel-good",
  easy_watch: "quelque chose de facile à regarder",
  comfort: "quelque chose de confortable",
  mystery: "du mystère",
  investigation: "de l'enquête",
  mind_bending: "un truc qui retourne le cerveau",
  action: "de l'action",
  scifi: "de la science-fiction",
  fantasy: "de la fantasy",
  adventure: "de l'aventure",
  emotion: "de l'émotion",
  suspense: "du suspense",
  horror: "de l'horreur",
  drama: "du drame",
  family: "du familial",
  beautiful: "quelque chose de beau visuellement",
  intense: "quelque chose d'intense",
  historical: "de l'historique",
  detective: "du policier",
  justice: "de la justice",
  medical: "du médical",
  workplace: "du travail et du quotidien",
};

/**
 * Moods refusés : formulation rassurante. « Pas triste » se lit mieux que
 * « pas triste / déprimant » (le libellé du questionnaire).
 */
const AVOIDED_PHRASES: Partial<Record<Mood, string>> = {
  sad: "pas triste",
  dark: "pas trop sombre",
  heavy: "pas trop lourd",
  romcom: "pas une comédie romantique",
  gore: "pas gore",
  childish: "pas trop enfantin",
};

/** Décrit ce que l'utilisateur voulait, en français naturel. */
export function describeWanted(preferences: TonightSearchPreferences): string[] {
  const wanted: string[] = [];

  for (const mood of preferences.moods.slice(0, 3)) {
    const phrase = MOOD_PHRASES[mood] ?? moodDefinition(mood)?.label.toLowerCase();
    if (phrase) wanted.push(phrase);
  }

  // « côté comédie », « côté thriller » : tournure volontairement neutre, TMDB
  // mélangeant les genres masculins et féminins. On saute les genres déjà
  // couverts par un mood (« un peu d'amour » plutôt que « côté romance »).
  for (const genre of preferences.genres.slice(0, 2)) {
    if (preferences.moods.length && wanted.length >= 3) break;
    if (genreCoveredByMoods(genre, preferences.moods)) continue;
    wanted.push(`côté ${genreName(genre).toLowerCase()}`);
  }
  if (preferences.softRecent && preferences.minYear === null) wanted.push("d'assez récent");
  if (preferences.maxRuntime !== null) {
    wanted.push(`de moins de ${formatRuntime(preferences.maxRuntime) ?? `${preferences.maxRuntime} min`}`);
  } else if (preferences.softMaxRuntime !== null) {
    wanted.push("pas trop long");
  }
  if (preferences.targetEpisodeRuntime !== null) {
    wanted.push(`des épisodes de ${preferences.targetEpisodeRuntime} minutes`);
  }
  if (preferences.maxSeasons !== null && preferences.maxSeasons <= 2) wanted.push("une série courte");
  if (preferences.seriesStatus === "ended") wanted.push("une histoire terminée");
  if (preferences.discoveryLevel === "hidden_gem") wanted.push("une pépite peu connue");
  if (preferences.discoveryLevel === "obscure") wanted.push("un truc que personne ne connaît");
  if (preferences.discoveryLevel === "mainstream") wanted.push("valeur sûre");
  if (preferences.qualityPreference === "no_risk") wanted.push("du solide sans risque");
  if (preferences.minRating !== null) wanted.push(`une note au-dessus de ${String(preferences.minRating).replace(".", ",")}`);
  if (preferences.providers.length) wanted.push("disponible sur ta plateforme");

  if (!wanted.length) wanted.push("un truc qui te ressemble");

  // Les moods et genres refusés méritent d'être rappelés, c'est rassurant.
  const avoided: string[] = [];
  for (const mood of preferences.excludedMoods.slice(0, 2)) {
    const phrase = AVOIDED_PHRASES[mood] ?? `pas ${moodDefinition(mood)?.label.toLowerCase() ?? ""}`.trim();
    if (phrase && phrase !== "pas") avoided.push(phrase);
  }
  if (preferences.hardExcludedGenres.length) {
    avoided.push(`sans ${preferences.hardExcludedGenres.map((genre) => genreName(genre).toLowerCase()).join(" ni ")}`);
  }
  if (avoided.length) wanted.push(...avoided);

  return wanted;
}

/** Phrase de conclusion, modulée par la qualité de la correspondance. */
function closingSentence(scored: ScoredCandidate): string {
  const percent = scored.matchPercent;
  if (percent >= 90) return "Celui-là coche presque toutes les cases.";
  if (percent >= 80) return "Il colle vraiment bien à ce que tu cherchais.";
  if (percent >= 70) return "Il coche l'essentiel.";
  if (percent >= 60) return "Ce n'est pas parfait sur le papier, mais ça devrait faire le job.";
  return "Je n'ai rien trouvé de parfait : voilà ce que j'ai de plus proche.";
}

/** Phrase « gros atout » construite sur la meilleure dimension du score. */
function highlightSentence(scored: ScoredCandidate): string | null {
  const candidate = scored.candidate;
  const sorted = [...scored.components].filter((component) => component.weight > 0).sort((a, b) => b.value - a.value);
  const best = sorted[0];
  if (!best) return null;

  const suffix = candidate.mediaType === "movie" ? "le film" : "la série";

  switch (best.key) {
    case "moodMatch":
      return `Et surtout, ${suffix} tombe pile dans le mood que tu as décrit.`;
    case "qualityScore":
      return `Sa note est solide et repose sur assez de votes pour être fiable.`;
    case "discoveryScore":
      return `C'est exactement le niveau de découverte que tu demandais.`;
    case "runtimeMatch": {
      const runtime = formatRuntime(candidate.runtime);
      if (runtime) return `En plus, il tient en ${runtime}.`;
      return `En plus, ses épisodes sont faciles à caser dans une soirée.`;
    }
    case "providerMatch":
      return candidate.providers.length
        ? `Il est dispo sur ${candidate.providers[0].name}.`
        : `Il est facile à trouver en streaming.`;
    case "eraMatch":
      return candidate.year ? `Et il est sorti en ${candidate.year}.` : null;
    case "personalTaste":
      return `Il correspond bien à ce que tu regardes d'habitude.`;
    default:
      return null;
  }
}

/** Assemble l'explication complète affichée sous la recommandation. */
export function buildExplanation(
  scored: ScoredCandidate,
  preferences: TonightSearchPreferences,
  relaxations: string[] = [],
): string {
  const wanted = describeWanted(preferences);
  const intro = `Tu voulais ${joinFr(wanted)}.`;
  const parts = [intro, closingSentence(scored)];

  const highlight = highlightSentence(scored);
  if (highlight) parts.push(highlight);

  if (relaxations.length) parts.push(relaxations[0]);

  const candidate = scored.candidate;
  if (candidate.mediaType === "tv" && classifySeriesStatus(candidate.status) === "ended") {
    parts.push("Et tu peux la finir : elle est terminée.");
  }

  return parts.join(" ");
}

/** Résumé court affiché sur la fiche détaillée. */
export function buildShortWhy(scored: ScoredCandidate): string {
  const reasons = scored.reasons.slice(0, 3);
  if (!reasons.length) return "Recommandé par Tonight.";
  return `${pronoun(scored.candidate)} a été choisi pour : ${joinFr(reasons)}.`;
}
