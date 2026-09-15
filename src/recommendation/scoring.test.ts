/**
 * Tests du moteur de scoring (§71).
 * Chaque brique est testable indépendamment, sans interface et sans réseau.
 */

import { describe, expect, it } from "vitest";
import { GENRE } from "@/utils/constants";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import type { Candidate, RecommendationContext, RefusalFeedback } from "@/types/tonight";
import {
  bayesianRating,
  calculateQualityConfidence,
  calculateQualityScore,
  qualityPreferenceFit,
} from "./qualityScore";
import { calculateDiscoveryScore } from "./discoveryScore";
import { calculateMoodFit, calculateMoodPenalty, calculateMoodScore } from "./moodScore";
import { calculateEpisodeRuntimeScore, calculateRuntimeScore, calculateSeasonsScore } from "./runtimeScore";
import { calculateProviderScore } from "./providerScore";
import { calculateHistoryPenalty, feedbackAdjustment } from "./personalizationScore";
import { selectRecommendations, scoreCandidate, weightsFor } from "./ranking";
import { applyHardFilters } from "./filters";

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 1,
    mediaType: "movie",
    title: "Test",
    originalTitle: "Test",
    year: 2015,
    endYear: null,
    runtime: 110,
    episodeRuntime: null,
    seasons: null,
    episodes: null,
    status: null,
    genres: [GENRE.COMEDY],
    genreNames: ["Comédie"],
    keywordSlugs: [],
    overview: "",
    voteAverage: 7.5,
    voteCount: 2000,
    popularity: 20,
    posterPath: null,
    backdropPath: null,
    originalLanguage: "en",
    originCountry: ["US"],
    director: null,
    creators: [],
    cast: [],
    providers: [],
    // Par défaut les fixtures sont enrichies : durée et saisons sont fiables.
    verified: true,
    ...overrides,
  };
}

const context: RecommendationContext = {
  sessionExcluded: [],
  feedback: [],
  profile: null,
  allowRelaxation: true,
};

describe("qualité (§34)", () => {
  it("ne se laisse pas piéger par une note élevée sur très peu de votes", () => {
    const lucky = candidate({ voteAverage: 9.8, voteCount: 8 });
    const solid = candidate({ voteAverage: 8.2, voteCount: 95_000 });
    expect(bayesianRating(solid)).toBeGreaterThan(bayesianRating(lucky));
    expect(calculateQualityScore(solid)).toBeGreaterThan(calculateQualityScore(lucky));
  });

  it("donne une confiance statistique forte au grand nombre de votes", () => {
    expect(calculateQualityConfidence(candidate({ voteCount: 50_000 }))).toBeGreaterThan(0.9);
    expect(calculateQualityConfidence(candidate({ voteCount: 30 }))).toBeLessThan(0.1);
  });

  it("« je ne veux pas me louper » refuse un film moyennement noté", () => {
    const mediocre = candidate({ voteAverage: 6.1, voteCount: 900 });
    const excellent = candidate({ voteAverage: 8.3, voteCount: 12_000 });
    expect(qualityPreferenceFit(excellent, "no_risk")).toBeGreaterThan(qualityPreferenceFit(mediocre, "no_risk"));
    expect(qualityPreferenceFit(mediocre, "no_risk")).toBeLessThan(0.2);
  });
});

describe("découverte (§35)", () => {
  const blockbuster = candidate({ id: 10, voteAverage: 8.4, voteCount: 90_000, popularity: 85 });
  const gem = candidate({ id: 11, voteAverage: 8.1, voteCount: 1200, popularity: 9 });
  const trash = candidate({ id: 12, voteAverage: 4.5, voteCount: 40, popularity: 3 });

  it("mode incontournable : favorise le blockbuster", () => {
    expect(calculateDiscoveryScore(blockbuster, "mainstream")).toBeGreaterThan(
      calculateDiscoveryScore(gem, "mainstream"),
    );
  });

  it("mode pépite : favorise la bonne note peu populaire, jamais un navet confidentiel", () => {
    expect(calculateDiscoveryScore(gem, "hidden_gem")).toBeGreaterThan(
      calculateDiscoveryScore(blockbuster, "hidden_gem"),
    );
    expect(calculateDiscoveryScore(gem, "hidden_gem")).toBeGreaterThan(
      calculateDiscoveryScore(trash, "hidden_gem"),
    );
  });

  it("mode valeur sûre : ne récompense pas un film sans preuve statistique", () => {
    expect(calculateDiscoveryScore(gem, "safe")).toBeGreaterThan(0.5);
    expect(calculateDiscoveryScore(trash, "safe")).toBeLessThan(0.35);
  });

  it("mode pépite : un blockbuster ne peut pas gagner le score FINAL", () => {
    // Le score de découverte seul ne suffit pas : si son poids reste faible
    // face à la qualité, le film le mieux noté du monde remporte la mise. C'est
    // exactement ce qui se produisait en direct (The Dark Knight en réponse à
    // « un très bon film que je ne connais probablement pas »).
    const preferences = createEmptyPreferences("natural_language", {
      mediaType: "movie",
      discoveryLevel: "hidden_gem",
    });
    const weights = weightsFor("movie", preferences, context);
    expect(scoreCandidate(gem, preferences, context, weights).score).toBeGreaterThan(
      scoreCandidate(blockbuster, preferences, context, weights).score,
    );
  });
});

describe("moods (§19)", () => {
  it("reconnaît un mood par genre, par keyword ou par synopsis", () => {
    const comedy = candidate({ genres: [GENRE.COMEDY], overview: "Une comédie hilarante et absurde." });
    expect(calculateMoodFit(comedy, "funny")).toBeGreaterThan(0.7);

    const keyworded = candidate({ genres: [GENRE.DRAMA], keywordSlugs: ["mind-bending"] });
    expect(calculateMoodFit(keyworded, "mind_bending")).toBeGreaterThan(0.35);

    const described = candidate({ genres: [GENRE.THRILLER], overview: "Un thriller sur la mémoire et le temps." });
    expect(calculateMoodFit(described, "mind_bending")).toBeGreaterThan(0.2);
  });

  it("pénalise fortement les moods refusés (« pas triste »)", () => {
    const sad = candidate({
      genres: [GENRE.DRAMA],
      overview: "Un homme brisé par le deuil, une histoire déchirante et tragique.",
    });
    const preferences = createEmptyPreferences("natural_language", { excludedMoods: ["sad"] });
    const penalty = calculateMoodPenalty(sad, preferences);
    expect(penalty.value).toBeGreaterThan(0.6);
    expect(penalty.hit).toContain("sad");
  });

  it("crédite les moods voisins sans les confondre", () => {
    const feelGood = candidate({ genres: [GENRE.COMEDY, GENRE.FAMILY] });
    const preferences = createEmptyPreferences("natural_language", { moods: ["easy_watch"] });
    expect(calculateMoodScore(feelGood, preferences).value).toBeGreaterThan(0.3);
  });
});

describe("durée (§18, §25)", () => {
  it("valorise ce qui tient dans la durée annoncée", () => {
    const preferences = createEmptyPreferences("questionnaire", { maxRuntime: 120 });
    expect(calculateRuntimeScore(candidate({ runtime: 95 }), preferences).value).toBeGreaterThan(
      calculateRuntimeScore(candidate({ runtime: 120 }), preferences).value,
    );
  });

  it("« pas trop long » est une préférence souple", () => {
    const preferences = createEmptyPreferences("natural_language", { softMaxRuntime: 110 });
    expect(calculateRuntimeScore(candidate({ runtime: 88 }), preferences).value).toBe(1);
    expect(calculateRuntimeScore(candidate({ runtime: 165 }), preferences).value).toBeLessThan(0.2);
  });

  it("raisonne en fourchette pour les épisodes", () => {
    const preferences = createEmptyPreferences("questionnaire", {
      targetEpisodeRuntime: 30,
      episodeRuntimeTolerance: 12,
    });
    expect(calculateEpisodeRuntimeScore(candidate({ episodeRuntime: 28 }), preferences).value).toBe(1);
    expect(calculateEpisodeRuntimeScore(candidate({ episodeRuntime: 60 }), preferences).value).toBeLessThan(0.6);
  });

  it("préfère une petite série quand l'utilisateur la demande", () => {
    const preferences = createEmptyPreferences("questionnaire", { commitment: "small", maxSeasons: 2 });
    expect(calculateSeasonsScore(candidate({ seasons: 2 }), preferences).value).toBe(1);
    expect(calculateSeasonsScore(candidate({ seasons: 9 }), preferences).value).toBeLessThan(0.3);
  });
});

describe("plateformes (§22)", () => {
  const netflix = [{ providerId: 8, name: "Netflix", logoPath: null, monetization: "flatrate" as const }];
  const rentalOnly = [{ providerId: 9, name: "Prime Video", logoPath: null, monetization: "rent" as const }];

  it("récompense l'abonnement demandé", () => {
    const preferences = createEmptyPreferences("questionnaire", { providers: [8], monetizationTypes: ["flatrate"] });
    expect(calculateProviderScore(candidate({ providers: netflix }), preferences).value).toBe(1);
    expect(calculateProviderScore(candidate({ providers: rentalOnly }), preferences).value).toBeLessThan(0.6);
  });

  it("n'invente pas de pénalité quand la disponibilité est inconnue", () => {
    const preferences = createEmptyPreferences("questionnaire", { providers: [8], monetizationTypes: ["flatrate"] });
    expect(calculateProviderScore(candidate({ providers: [] }), preferences).value).toBeGreaterThan(0.5);
  });
});

describe("feedback et historique (§43, §44)", () => {
  it("pénalise un film trop connu après ce refus", () => {
    const feedback: RefusalFeedback[] = [
      { candidateId: 5, mediaType: "movie", title: "X", reasons: ["too_known"], at: new Date().toISOString() },
    ];
    const popular = candidate({ popularity: 70, voteCount: 25_000 });
    const quiet = candidate({ popularity: 8, voteCount: 800 });
    expect(feedbackAdjustment(popular, { ...context, feedback }).value).toBeGreaterThan(0);
    expect(feedbackAdjustment(quiet, { ...context, feedback }).value).toBe(0);
  });

  it("écarte les contenus déjà vus", () => {
    const seen = candidate({ id: 42 });
    const profile = {
      ...{
        genreWeights: {},
        moodWeights: {},
        preferredEra: null,
        averageRuntime: null,
        preferredDiscovery: null,
        preferredSeasons: null,
        providerIds: [],
        favoriteIds: [],
        refusedIds: [],
        refusedGenreCounts: {},
        likedGenreCounts: {},
        stats: { accepted: 0, refused: 0, watched: 1, favorites: 0 },
      },
      watchedIds: ["movie:42"],
    };
    expect(calculateHistoryPenalty(seen, { ...context, profile }).value).toBeGreaterThan(0.5);
  });
});

describe("contraintes dures (§13)", () => {
  it("rejette un film trop long et signal la raison", () => {
    const preferences = createEmptyPreferences("questionnaire", {
      maxRuntime: 100,
      hardConstraints: ["maxRuntime"],
    });
    const outcome = applyHardFilters(
      [candidate({ id: 1, runtime: 95 }), candidate({ id: 2, runtime: 160 })],
      preferences,
    );
    expect(outcome.passed.map((item) => item.id)).toEqual([1]);
    expect(outcome.mainReason).toBe("maxRuntime");
  });

  it("n'exclut pas la romance quand seule la comédie romantique est visée par une pénalité", () => {
    const preferences = createEmptyPreferences("natural_language", {
      hardExcludedGenres: [GENRE.HORROR],
      excludedGenreCombos: [[GENRE.ROMANCE, GENRE.COMEDY]],
    });
    const romcom = candidate({ id: 3, genres: [GENRE.ROMANCE, GENRE.COMEDY] });
    const romance = candidate({ id: 4, genres: [GENRE.ROMANCE, GENRE.DRAMA] });
    const outcome = applyHardFilters([romcom, romance], preferences);
    expect(outcome.passed).toHaveLength(2);
  });

  it("« maximum 2 saisons » n'est PAS satisfait par une série dont on ignore les saisons", () => {
    const preferences = createEmptyPreferences("natural_language", {
      mediaType: "tv",
      maxSeasons: 2,
      hardConstraints: ["mediaType", "maxSeasons"],
    });
    // Non enrichie : `seasons` vaut `null` (c'est ce que renvoie `discover`).
    // On ne peut pas promettre « 2 saisons maximum » → la candidate est écartée.
    const unknown = candidate({ id: 10, mediaType: "tv", runtime: null, seasons: null, verified: false });
    const conforms = candidate({ id: 11, mediaType: "tv", runtime: null, seasons: 2, verified: true });

    const outcome = applyHardFilters([unknown, conforms], preferences);
    expect(outcome.passed.map((item) => item.id)).toEqual([11]);
    expect(outcome.mainReason).toBe("maxSeasons");
  });

  it("« terminée » n'est PAS satisfait par une série au statut inconnu", () => {
    const preferences = createEmptyPreferences("natural_language", {
      mediaType: "tv",
      hardConstraints: ["mediaType", "seriesEnded"],
    });
    const unknown = candidate({ id: 12, mediaType: "tv", runtime: null, status: null, verified: false });
    const ended = candidate({ id: 13, mediaType: "tv", runtime: null, status: "Ended", verified: true });
    const canceled = candidate({ id: 14, mediaType: "tv", runtime: null, status: "Canceled", verified: true });

    const outcome = applyHardFilters([unknown, ended, canceled], preferences);
    expect(outcome.passed.map((item) => item.id)).toEqual([13]);
  });

  it("une donnée absente CHEZ LA SOURCE ne pénalise pas un candidat enrichi", () => {
    // Ici l'œuvre a été enrichie mais TMDB ne connaît pas sa durée : c'est une
    // absence de donnée, pas une violation de contrainte.
    const preferences = createEmptyPreferences("questionnaire", {
      maxRuntime: 100,
      hardConstraints: ["maxRuntime"],
    });
    const outcome = applyHardFilters([candidate({ id: 15, runtime: null, verified: true })], preferences);
    expect(outcome.passed.map((item) => item.id)).toEqual([15]);
  });

  it("« Avoir peur » rejette un drame sans aucun signal horrifique", () => {
    const preferences = createEmptyPreferences("questionnaire", {
      moods: ["horror"],
    });
    const drama = candidate({ id: 16, genres: [GENRE.DRAMA], overview: "Deux détenus se lient d'amitié." });
    const horror = candidate({ id: 17, genres: [GENRE.HORROR, GENRE.THRILLER] });

    const outcome = applyHardFilters([drama, horror], preferences);

    expect(outcome.passed.map((item) => item.id)).toEqual([17]);
    expect(outcome.mainReason).toBe("requireGenre");
  });
});

describe("variété (§36)", () => {
  it("ne renvoie jamais deux fois le même candidat", () => {
    const preferences = createEmptyPreferences("questionnaire", { moods: ["funny"] });
    const scored = Array.from({ length: 12 }, (_, index) =>
      scoreCandidate(candidate({ id: index + 1 }), preferences, context, weightsFor("movie", preferences, context)),
    );
    const selected = selectRecommendations(scored, { count: 5, seed: 3, random: () => 0.4 });
    expect(selected).toHaveLength(5);
    expect(new Set(selected.map((item) => item.candidate.id)).size).toBe(5);
  });

  it("classe les alternatives par score, sans jamais dépasser la reco principale", () => {
    const preferences = createEmptyPreferences("questionnaire", {});
    const weights = weightsFor("movie", preferences, context);
    const scored = [0.91, 0.9, 0.88, 0.85, 0.8].map((score, index) => ({
      ...scoreCandidate(candidate({ id: index + 1 }), preferences, context, weights),
      score,
    }));

    const selected = selectRecommendations(scored, { count: 5, seed: 11, random: () => 0.15 });
    const [primary, ...alternatives] = selected;
    expect(primary).toBeDefined();
    expect(alternatives.every((item) => item.score <= primary.score)).toBe(true);
    const scores = alternatives.map((item) => item.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("conserve un candidat bien mieux noté dans la sélection", () => {
    const preferences = createEmptyPreferences("questionnaire", {});
    const good = scoreCandidate(candidate({ id: 1 }), preferences, context, weightsFor("movie", preferences, context));
    const great = { ...scoreCandidate(candidate({ id: 2 }), preferences, context, weightsFor("movie", preferences, context)), score: 0.95 };
    const selected = selectRecommendations([good, great], { count: 2, seed: 7, random: () => 0.5 });
    expect(selected.some((item) => item.candidate.id === 2)).toBe(true);
  });
});
