/**
 * Chips « J'ai compris ».
 *
 * Elles rendent la compréhension du parser VÉRIFIABLE et ÉDITABLE : chaque chip
 * porte un identifiant stable qui permet de la retirer des préférences
 * (exigence §14).
 */

import { genreCoveredByMoods, moodDefinition } from "@/data/moods";
import type { Mood, TonightSearchPreferences, UnderstoodChip } from "@/types/tonight";
import { GENRE_NAMES_FR, genreName } from "@/utils/constants";
import { formatRuntime } from "@/utils/format";
import { providerName } from "@/utils/providers";

const CURRENT_YEAR = new Date().getFullYear();

export function mediaTypeChip(preferences: TonightSearchPreferences): UnderstoodChip | null {
  if (preferences.mediaType === "movie") {
    return { id: "mediaType:movie", emoji: "🎬", label: "Film", kind: "mediaType", tone: "neutral" };
  }
  if (preferences.mediaType === "tv") {
    return { id: "mediaType:tv", emoji: "📺", label: "Série", kind: "mediaType", tone: "neutral" };
  }
  return null;
}

/** Construit la liste complète des chips à partir des préférences. */
export function buildChips(preferences: TonightSearchPreferences): UnderstoodChip[] {
  const chips: UnderstoodChip[] = [];
  const push = (chip: UnderstoodChip | null) => {
    if (chip) chips.push(chip);
  };

  push(mediaTypeChip(preferences));

  // Époque
  if (preferences.softRecent && preferences.minYear === null) {
    push({ id: "era:recent", emoji: "🔥", label: "Récent", kind: "era", tone: "positive" });
  } else if (preferences.softOld && preferences.maxYear === null) {
    push({ id: "era:old", emoji: "📼", label: "Plutôt ancien", kind: "era", tone: "positive" });
  }
  if (preferences.minYear !== null || preferences.maxYear !== null) {
    const min = preferences.minYear;
    const max = preferences.maxYear;
    let label: string;
    if (min !== null && max !== null) {
      label = min === max ? `Année ${min}` : `${min}-${max}`;
    } else if (min !== null) {
      label = `Depuis ${min}`;
    } else {
      label = `Avant ${max! + 1}`;
    }
    chips.push({
      id: `era:range:${min ?? ""}:${max ?? ""}`,
      emoji: min !== null && min >= CURRENT_YEAR - 3 ? "🔥" : "🎞️",
      label,
      kind: "era",
      tone: "neutral",
    });
  }

  // Durée film
  if (preferences.maxRuntime !== null) {
    chips.push({
      id: `runtime:max:${preferences.maxRuntime}`,
      emoji: "⏱️",
      label: `Moins de ${formatRuntime(preferences.maxRuntime) ?? `${preferences.maxRuntime} min`}`,
      kind: "runtime",
      tone: "neutral",
    });
  }
  if (preferences.minRuntime !== null) {
    chips.push({
      id: `runtime:min:${preferences.minRuntime}`,
      emoji: "⏱️",
      label: `Plus de ${formatRuntime(preferences.minRuntime) ?? `${preferences.minRuntime} min`}`,
      kind: "runtime",
      tone: "neutral",
    });
  }
  if (preferences.softMaxRuntime !== null && preferences.maxRuntime === null) {
    chips.push({ id: "runtime:softShort", emoji: "⚡", label: "Plutôt court", kind: "runtime", tone: "positive" });
  }

  // Durée d'épisode
  if (preferences.targetEpisodeRuntime !== null) {
    const tolerance = preferences.episodeRuntimeTolerance || 12;
    chips.push({
      id: `episode:${preferences.targetEpisodeRuntime}`,
      emoji: "📺",
      label: `Épisodes d'environ ${preferences.targetEpisodeRuntime} min (±${tolerance})`,
      kind: "episodeRuntime",
      tone: "neutral",
    });
  }

  // Saisons
  if (preferences.maxSeasons !== null || preferences.minSeasons !== null) {
    const min = preferences.minSeasons;
    const max = preferences.maxSeasons;
    let label: string;
    if (min !== null && max !== null) label = min === max ? `${min} saison${min > 1 ? "s" : ""}` : `${min} à ${max} saisons`;
    else if (max !== null) label = `Maximum ${max} saison${max > 1 ? "s" : ""}`;
    else label = `Au moins ${min} saison${min! > 1 ? "s" : ""}`;
    chips.push({
      id: `seasons:${min ?? ""}:${max ?? ""}`,
      emoji: "📺",
      label,
      kind: "seasons",
      tone: "neutral",
    });
  }

  // Statut
  if (preferences.seriesStatus === "ended") {
    chips.push({ id: "status:ended", emoji: "✅", label: "Terminée", kind: "status", tone: "positive" });
  } else if (preferences.seriesStatus === "ongoing_ok") {
    chips.push({ id: "status:ongoing", emoji: "🔴", label: "En cours acceptée", kind: "status", tone: "neutral" });
  }

  // Moods souhaités
  for (const mood of preferences.moods) {
    const definition = moodDefinition(mood);
    chips.push({
      id: `mood:${mood}`,
      emoji: definition?.emoji ?? "✨",
      label: definition?.label ?? mood,
      kind: "mood",
      tone: "positive",
    });
  }

  // Genres souhaités : on masque ceux qu'un mood déjà affiché recouvre, pour
  // ne pas montrer deux fois la même intention (« Science-fiction » +
  // « Science-Fiction », « Un peu d'amour » + « Romance »).
  for (const genre of preferences.genres) {
    if (genreCoveredByMoods(genre, preferences.moods)) continue;
    chips.push({
      id: `genre:${genre}`,
      emoji: "🎯",
      label: GENRE_NAMES_FR[genre] ?? genreName(genre),
      kind: "genre",
      tone: "positive",
    });
  }

  // Exclusions
  for (const mood of preferences.excludedMoods) {
    const definition = moodDefinition(mood);
    chips.push({
      id: `excluded:mood:${mood}`,
      emoji: "🚫",
      label: `Pas ${definition?.label.toLowerCase() ?? mood}`,
      kind: "excludedMood",
      tone: "negative",
    });
  }
  for (const genre of preferences.hardExcludedGenres) {
    chips.push({
      id: `excluded:genre:${genre}`,
      emoji: "🚫",
      label: `Pas de ${(GENRE_NAMES_FR[genre] ?? genreName(genre)).toLowerCase()}`,
      kind: "excludedGenre",
      tone: "negative",
    });
  }
  for (const genre of preferences.excludedGenres) {
    if (preferences.hardExcludedGenres.includes(genre)) continue;
    chips.push({
      id: `penalty:genre:${genre}`,
      emoji: "🚫",
      label: `Peu de ${(GENRE_NAMES_FR[genre] ?? genreName(genre)).toLowerCase()}`,
      kind: "excludedGenre",
      tone: "negative",
    });
  }
  for (const [a, b] of preferences.excludedGenreCombos) {
    const label = `${genreName(a)} + ${genreName(b)}`;
    chips.push({ id: `combo:${a}:${b}`, emoji: "🚫", label: `Pas de ${label.toLowerCase()}`, kind: "excludedGenre", tone: "negative" });
  }
  if (preferences.excludeAnimation) chips.push({ id: "exclude:animation", emoji: "🚫", label: "Pas d'animation", kind: "excludedGenre", tone: "negative" });
  if (preferences.excludeDocumentary) chips.push({ id: "exclude:documentary", emoji: "🚫", label: "Pas de documentaire", kind: "excludedGenre", tone: "negative" });
  if (preferences.excludeMusical) chips.push({ id: "exclude:musical", emoji: "🚫", label: "Pas de comédie musicale", kind: "excludedGenre", tone: "negative" });

  // Découverte / qualité
  if (preferences.discoveryLevel) {
    const labels: Record<string, { emoji: string; label: string }> = {
      mainstream: { emoji: "🏆", label: "Incontournable" },
      safe: { emoji: "⭐", label: "Valeur sûre" },
      hidden_gem: { emoji: "💎", label: "Pépite" },
      obscure: { emoji: "🕳️", label: "Peu connu" },
      surprise: { emoji: "🎲", label: "Surprends-moi" },
    };
    const entry = labels[preferences.discoveryLevel];
    if (entry) chips.push({ id: `discovery:${preferences.discoveryLevel}`, emoji: entry.emoji, label: entry.label, kind: "discovery", tone: "neutral" });
  }
  if (preferences.qualityPreference) {
    const labels: Record<string, string> = {
      risky: "😈 Prêt à prendre des risques",
      solid: "🙂 Un bon film",
      very_solid: "⭐ Du très solide",
      no_risk: "🏆 Ne pas se louper",
    };
    chips.push({
      id: `quality:${preferences.qualityPreference}`,
      emoji: "🎚️",
      label: labels[preferences.qualityPreference] ?? preferences.qualityPreference,
      kind: "quality",
      tone: "neutral",
    });
  }
  if (preferences.minRating !== null) {
    chips.push({
      id: `rating:${preferences.minRating}`,
      emoji: "⭐",
      label: `Note ≥ ${String(preferences.minRating).replace(".", ",")}`,
      kind: "rating",
      tone: "neutral",
    });
  }

  // Plateformes
  for (const provider of preferences.providers) {
    chips.push({ id: `provider:${provider}`, emoji: "🍿", label: providerName(provider), kind: "provider", tone: "neutral" });
  }
  if (preferences.monetizationTypes.includes("rent")) {
    chips.push({ id: "monetization:rent", emoji: "💰", label: "Location / achat accepté", kind: "provider", tone: "neutral" });
  }

  // Langue / pays
  if (preferences.originalLanguage) {
    chips.push({
      id: `language:${preferences.originalLanguage}`,
      emoji: "🇫🇷",
      label: languageLabel(preferences.originalLanguage),
      kind: "language",
      tone: "neutral",
    });
  }

  return chips;
}

export { providerName };

function languageLabel(code: string): string {
  const labels: Record<string, string> = {
    fr: "Français",
    en: "Anglais",
    ja: "Japonais",
    ko: "Coréen",
    es: "Espagnol",
    it: "Italien",
    de: "Allemand",
  };
  return labels[code] ?? code.toUpperCase();
}

/**
 * Retire un critère des préférences à partir de l'identifiant d'une chip.
 * Renvoie de nouvelles préférences (aucune mutation).
 */
export function removeChip(preferences: TonightSearchPreferences, chipId: string): TonightSearchPreferences {
  const next: TonightSearchPreferences = { ...preferences };
  const soft = (id: string) => next.softPreferences.filter((item) => item !== id);

  if (chipId.startsWith("mood:")) {
    const mood = chipId.slice(5) as Mood;
    next.moods = next.moods.filter((item) => item !== mood);
    return next;
  }
  if (chipId.startsWith("excluded:mood:")) {
    const mood = chipId.slice(14) as Mood;
    next.excludedMoods = next.excludedMoods.filter((item) => item !== mood);
    if (mood === "sad" || mood === "heavy" || mood === "dark") {
      next.softPreferences = soft("notHeavy");
    }
    return next;
  }
  if (chipId.startsWith("genre:")) {
    const genre = Number(chipId.slice(6));
    next.genres = next.genres.filter((item) => item !== genre);
    return next;
  }
  if (chipId.startsWith("excluded:genre:")) {
    const genre = Number(chipId.slice(15));
    next.hardExcludedGenres = next.hardExcludedGenres.filter((item) => item !== genre);
    next.excludedGenres = next.excludedGenres.filter((item) => item !== genre);
    return next;
  }
  if (chipId.startsWith("penalty:genre:")) {
    const genre = Number(chipId.slice(14));
    next.excludedGenres = next.excludedGenres.filter((item) => item !== genre);
    return next;
  }
  if (chipId.startsWith("combo:")) {
    const [, a, b] = chipId.split(":");
    next.excludedGenreCombos = next.excludedGenreCombos.filter(
      ([first, second]) => !(first === Number(a) && second === Number(b)),
    );
    return next;
  }
  if (chipId === "exclude:animation") {
    next.excludeAnimation = false;
    next.hardConstraints = next.hardConstraints.filter((item) => item !== "excludeAnimation");
    return next;
  }
  if (chipId === "exclude:documentary") {
    next.excludeDocumentary = false;
    next.hardConstraints = next.hardConstraints.filter((item) => item !== "excludeDocumentary");
    return next;
  }
  if (chipId === "exclude:musical") {
    next.excludeMusical = false;
    next.hardConstraints = next.hardConstraints.filter((item) => item !== "excludeMusical");
    return next;
  }
  if (chipId === "era:recent") {
    next.softRecent = false;
    next.softPreferences = soft("recent");
    return next;
  }
  if (chipId === "era:old") {
    next.softOld = false;
    next.softPreferences = soft("old");
    return next;
  }
  if (chipId.startsWith("era:range")) {
    next.minYear = null;
    next.maxYear = null;
    next.hardConstraints = next.hardConstraints.filter((item) => item !== "minYear" && item !== "maxYear");
    return next;
  }
  if (chipId.startsWith("runtime:max:")) {
    next.maxRuntime = null;
    next.hardConstraints = next.hardConstraints.filter((item) => item !== "maxRuntime");
    return next;
  }
  if (chipId.startsWith("runtime:min:")) {
    next.minRuntime = null;
    next.hardConstraints = next.hardConstraints.filter((item) => item !== "minRuntime");
    return next;
  }
  if (chipId === "runtime:softShort") {
    next.softMaxRuntime = null;
    next.softPreferences = soft("shortRuntime");
    return next;
  }
  if (chipId.startsWith("episode:")) {
    next.targetEpisodeRuntime = null;
    return next;
  }
  if (chipId.startsWith("seasons:")) {
    next.minSeasons = null;
    next.maxSeasons = null;
    next.commitment = null;
    next.hardConstraints = next.hardConstraints.filter((item) => item !== "minSeasons" && item !== "maxSeasons");
    return next;
  }
  if (chipId === "status:ended" || chipId === "status:ongoing") {
    next.seriesStatus = null;
    next.hardConstraints = next.hardConstraints.filter((item) => item !== "seriesEnded");
    next.softPreferences = soft("strongEnding");
    return next;
  }
  if (chipId.startsWith("discovery:")) {
    next.discoveryLevel = null;
    next.softPreferences = soft("hiddenGem");
    next.softPreferences = next.softPreferences.filter((item) => item !== "mainstream");
    return next;
  }
  if (chipId.startsWith("quality:")) {
    next.qualityPreference = null;
    next.softPreferences = soft("wellRated");
    return next;
  }
  if (chipId.startsWith("rating:")) {
    next.minRating = null;
    next.hardConstraints = next.hardConstraints.filter((item) => item !== "minRating");
    return next;
  }
  if (chipId.startsWith("provider:")) {
    const provider = Number(chipId.slice(9));
    next.providers = next.providers.filter((item) => item !== provider);
    if (!next.providers.length) {
      next.hardConstraints = next.hardConstraints.filter((item) => item !== "providers");
    }
    return next;
  }
  if (chipId === "monetization:rent") {
    next.monetizationTypes = ["flatrate", "free", "ads"];
    return next;
  }
  if (chipId.startsWith("language:")) {
    next.originalLanguage = null;
    next.originCountry = null;
    next.hardConstraints = next.hardConstraints.filter((item) => item !== "originalLanguage" && item !== "originCountry");
    return next;
  }
  if (chipId.startsWith("mediaType:")) {
    next.mediaType = "any";
    next.hardConstraints = next.hardConstraints.filter((item) => item !== "mediaType");
    return next;
  }
  return next;
}
