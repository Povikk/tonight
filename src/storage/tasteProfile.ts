/**
 * Profil de goûts (§44, §46).
 *
 * Ce n'est PAS du machine learning : ce sont des compteurs et des poids
 * évolutifs, calculés à partir de l'historique, des favoris et des refus.
 * Le résultat est un objet simple, lisible et affichable dans « Mes goûts ».
 */

import { MOOD_DEFINITIONS } from "@/data/moods";
import type { DiscoveryLevel, Mood, TasteProfile } from "@/types/tonight";
import { canonicalGenres } from "@/utils/canonical";
import { historyStore, type HistoryEntry } from "./history";
import { favoritesStore } from "./favorites";
import { getSettings } from "./preferences";

/** Poids d'un statut dans la construction des goûts. */
const SIGNAL_WEIGHT: Record<HistoryEntry["status"], number> = {
  favorite: 1,
  watched: 0.7,
  accepted: 0.5,
  refused: -0.5,
};

/** Moods « présents » dans une œuvre, déduits de ses genres. */
function moodsOfGenres(genres: number[]): Mood[] {
  const canonical = canonicalGenres(genres);
  const moods: Mood[] = [];
  for (const definition of Object.values(MOOD_DEFINITIONS)) {
    if (definition.genres.some((genre) => canonical.includes(genre))) moods.push(definition.id);
  }
  return moods;
}

const average = (values: number[]): number | null =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/** Construit le profil complet à partir de tout ce qui est stocké localement. */
export function computeTasteProfile(): TasteProfile {
  const history = historyStore.get();
  const favorites = favoritesStore.get();

  const genreScores = new Map<number, number>();
  const likedGenreCounts: Record<number, number> = {};
  const refusedGenreCounts: Record<number, number> = {};
  const moodScores = new Map<Mood, number>();
  const providerCounts = new Map<number, number>();
  const years: number[] = [];
  const runtimes: number[] = [];
  const seasons: number[] = [];
  const popularities: number[] = [];

  for (const entry of history) {
    const genres = canonicalGenres(entry.genres ?? []);
    const weight = SIGNAL_WEIGHT[entry.status] ?? 0.3;

    for (const genre of genres) {
      genreScores.set(genre, (genreScores.get(genre) ?? 0) + weight);
      if (entry.status === "refused") {
        refusedGenreCounts[genre] = (refusedGenreCounts[genre] ?? 0) + 1;
      } else {
        likedGenreCounts[genre] = (likedGenreCounts[genre] ?? 0) + 1;
      }
    }

    if (entry.status !== "refused") {
      for (const mood of moodsOfGenres(genres)) {
        moodScores.set(mood, (moodScores.get(mood) ?? 0) + weight * 0.5);
      }
      if (entry.year) years.push(entry.year);
      if (typeof entry.runtime === "number" && entry.runtime > 0) runtimes.push(entry.runtime);
      if (typeof entry.seasons === "number" && entry.seasons > 0) seasons.push(entry.seasons);
      if (typeof entry.popularity === "number") popularities.push(entry.popularity);
      for (const provider of entry.providers ?? []) {
        providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);
      }
    }
  }

  for (const entry of favorites) {
    for (const genre of canonicalGenres(entry.genres ?? [])) {
      genreScores.set(genre, (genreScores.get(genre) ?? 0) + 0.8);
      likedGenreCounts[genre] = (likedGenreCounts[genre] ?? 0) + 1;
    }
  }

  // Corrections manuelles : elles comptent comme un signal fort.
  const overrides = getSettings().tasteOverrides;
  for (const genre of overrides.likedGenres) {
    genreScores.set(genre, (genreScores.get(genre) ?? 0) + 1.4);
    likedGenreCounts[genre] = (likedGenreCounts[genre] ?? 0) + 2;
  }
  for (const genre of overrides.dislikedGenres) {
    genreScores.set(genre, (genreScores.get(genre) ?? 0) - 1.4);
    refusedGenreCounts[genre] = (refusedGenreCounts[genre] ?? 0) + 1;
  }

  // Normalisation des affinités dans [-1, 1].
  const maxGenre = Math.max(1, ...[...genreScores.values()].map((value) => Math.abs(value)));
  const genreWeights: Record<number, number> = {};
  for (const [genre, score] of genreScores) {
    genreWeights[genre] = Math.max(-1, Math.min(1, score / maxGenre));
  }

  const maxMood = Math.max(1, ...[...moodScores.values()].map((value) => Math.abs(value)));
  const moodWeights: Partial<Record<Mood, number>> = {};
  for (const [mood, score] of moodScores) {
    moodWeights[mood] = Math.max(-1, Math.min(1, score / maxMood));
  }

  // Niveau de découverte déduit de la popularité moyenne des œuvres acceptées.
  const averagePopularity = average(popularities);
  let preferredDiscovery: DiscoveryLevel | null = null;
  if (averagePopularity !== null) {
    if (averagePopularity >= 35) preferredDiscovery = "mainstream";
    else if (averagePopularity <= 15) preferredDiscovery = "hidden_gem";
    else preferredDiscovery = "safe";
  }

  return {
    genreWeights,
    moodWeights,
    preferredEra: years.length >= 3 ? { min: Math.min(...years) - 2, max: Math.max(...years) + 2 } : null,
    averageRuntime: average(runtimes),
    preferredDiscovery,
    preferredSeasons: average(seasons),
    providerIds: [...providerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id),
    watchedIds: history.filter((entry) => entry.status === "watched").map((entry) => entry.key),
    favoriteIds: favorites.map((entry) => entry.key),
    refusedIds: history.filter((entry) => entry.status === "refused").map((entry) => entry.key),
    refusedGenreCounts,
    likedGenreCounts,
    stats: {
      accepted: history.filter((entry) => entry.status === "accepted").length,
      refused: history.filter((entry) => entry.status === "refused").length,
      watched: history.filter((entry) => entry.status === "watched").length,
      favorites: favorites.length,
    },
  };
}

/** Les genres que TONIGHT pense que l'utilisateur aime, du plus marqué au moins. */
export function topLikedGenres(profile: TasteProfile, limit = 5): number[] {
  return Object.entries(profile.likedGenreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre]) => Number(genre));
}

/** Les genres refusés de façon répétée. */
export function topRefusedGenres(profile: TasteProfile, limit = 4): Array<{ genre: number; count: number }> {
  return Object.entries(profile.refusedGenreCounts)
    .map(([genre, count]) => ({ genre: Number(genre), count }))
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Moods les plus marqués du profil. */
export function topMoods(profile: TasteProfile, limit = 4): Mood[] {
  return Object.entries(profile.moodWeights)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, limit)
    .map(([mood]) => mood as Mood);
}
