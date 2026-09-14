import { z } from "zod";

const mediaType = z.enum(["movie", "tv", "any"]);
const source = z.enum(["natural_language", "questionnaire", "express", "yolo"]);
const mood = z.enum([
  "funny", "romance", "feel_good", "easy_watch", "comfort", "mystery",
  "investigation", "mind_bending", "action", "scifi", "fantasy", "adventure",
  "emotion", "suspense", "horror", "drama", "family", "beautiful", "intense",
  "historical", "detective", "justice", "medical", "workplace", "sad", "dark",
  "heavy", "romcom", "gore", "childish",
]);
const discovery = z.enum(["mainstream", "safe", "hidden_gem", "obscure", "surprise"]);
const quality = z.enum(["risky", "solid", "very_solid", "no_risk"]);
const seriesStatus = z.enum(["ended", "ongoing_ok", "any"]);
const commitment = z.enum(["mini", "small", "medium", "long", "any"]);
const monetization = z.enum(["flatrate", "free", "ads", "rent", "buy"]);
const hardConstraint = z.enum([
  "mediaType", "maxRuntime", "minRuntime", "minYear", "maxYear", "maxSeasons",
  "minSeasons", "seriesEnded", "excludeGenres", "requireGenre", "providers",
  "minRating", "excludeAnimation", "excludeDocumentary", "excludeMusical",
  "originalLanguage", "originCountry",
]);
const softPreference = z.enum([
  "recent", "old", "shortRuntime", "longRuntime", "comfortableRuntime", "wellRated",
  "notHeavy", "light", "fewSeasons", "shortEpisodes", "hiddenGem", "mainstream",
  "beautiful", "strongEnding", "availableNow",
]);

const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
const id = z.number().int().positive().max(10_000_000);
const ids = z.array(id).max(50);
const mediaKey = z.string().regex(/^(movie|tv):\d{1,10}$/).max(20);

export const preferencesSchema = z.object({
  mediaType: mediaType.optional(),
  genres: ids.optional(),
  excludedGenres: ids.optional(),
  hardExcludedGenres: ids.optional(),
  excludedGenreCombos: z.array(z.tuple([id, id])).max(20).optional(),
  moods: z.array(mood).max(20).optional(),
  excludedMoods: z.array(mood).max(20).optional(),
  minYear: nullableInt(1870, 2200).optional(),
  maxYear: nullableInt(1870, 2200).optional(),
  softMinYear: nullableInt(1870, 2200).optional(),
  softMaxYear: nullableInt(1870, 2200).optional(),
  softRecent: z.boolean().optional(),
  softOld: z.boolean().optional(),
  minRuntime: nullableInt(1, 1_000).optional(),
  maxRuntime: nullableInt(1, 1_000).optional(),
  softMinRuntime: nullableInt(1, 1_000).optional(),
  softMaxRuntime: nullableInt(1, 1_000).optional(),
  targetEpisodeRuntime: nullableInt(1, 500).optional(),
  episodeRuntimeTolerance: z.number().int().min(0).max(180).optional(),
  minSeasons: nullableInt(1, 100).optional(),
  maxSeasons: nullableInt(1, 100).optional(),
  seriesStatus: seriesStatus.nullable().optional(),
  commitment: commitment.nullable().optional(),
  discoveryLevel: discovery.nullable().optional(),
  qualityPreference: quality.nullable().optional(),
  providers: ids.optional(),
  monetizationTypes: z.array(monetization).max(5).optional(),
  minRating: z.number().min(0).max(10).nullable().optional(),
  originalLanguage: z.string().regex(/^[a-z]{2,3}$/i).nullable().optional(),
  originCountry: z.string().regex(/^[a-z]{2}$/i).transform((value) => value.toUpperCase()).nullable().optional(),
  excludeAnimation: z.boolean().optional(),
  excludeDocumentary: z.boolean().optional(),
  excludeMusical: z.boolean().optional(),
  hardConstraints: z.array(hardConstraint).max(20).optional(),
  softPreferences: z.array(softPreference).max(20).optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: source.optional(),
  rawQuery: z.string().max(600).optional(),
}).strict();
const refusalReason = z.enum([
  "too_old", "too_recent", "too_long", "too_serious", "too_light", "too_known",
  "not_known_enough", "wrong_mood", "wrong_genre", "already_seen", "not_available",
]);

const feedback = z.object({
  candidateId: id,
  mediaType: z.enum(["movie", "tv"]),
  title: z.string().max(200),
  reasons: z.array(refusalReason).max(11),
  at: z.string().datetime({ offset: true }),
}).strict();

const numericRecord = z.record(
  z.string().regex(/^\d{1,10}$/),
  z.number().finite().min(-10_000).max(10_000),
);
// Le profil ne contient que les moods pour lesquels un signal existe. Avec
// Zod 4, `z.record(enum, ...)` exige toutes les clés de l'enum ; `partialRecord`
// correspond au type réel `Partial<Record<Mood, number>>`.
const moodWeights = z.partialRecord(mood, z.number().finite().min(-1).max(1));

const tasteProfile = z.object({
  genreWeights: numericRecord,
  moodWeights,
  preferredEra: z.object({ min: z.number().int().min(1870).max(2200), max: z.number().int().min(1870).max(2200) }).strict().nullable(),
  averageRuntime: z.number().finite().min(1).max(1_000).nullable(),
  preferredDiscovery: discovery.nullable(),
  preferredSeasons: z.number().finite().min(1).max(100).nullable(),
  providerIds: ids.max(20),
  watchedIds: z.array(mediaKey).max(500),
  favoriteIds: z.array(mediaKey).max(500),
  refusedIds: z.array(mediaKey).max(500),
  refusedGenreCounts: numericRecord,
  likedGenreCounts: numericRecord,
  stats: z.object({
    accepted: z.number().int().nonnegative().max(100_000),
    refused: z.number().int().nonnegative().max(100_000),
    watched: z.number().int().nonnegative().max(100_000),
    favorites: z.number().int().nonnegative().max(100_000),
  }).strict(),
}).strict();

export const recommendBodySchema = z.object({
  preferences: preferencesSchema.optional(),
  context: z.object({
    sessionExcluded: z.array(mediaKey).max(500).optional(),
    feedback: z.array(feedback).max(20).optional(),
    profile: tasteProfile.nullable().optional(),
    allowRelaxation: z.boolean().optional(),
  }).strict().optional(),
  count: z.number().int().min(1).max(20).optional(),
  seed: z.number().int().min(0).max(100_000_000).optional(),
}).strict();

export const parseBodySchema = z.object({
  query: z.string().trim().min(1).max(600),
  forcedMediaType: mediaType.optional(),
  source: source.optional(),
}).strict();
