/**
 * Tests du moteur de recommandation (§71) et du parcours critique (§72).
 *
 * Ces tests tournent sur le catalogue de démonstration : aucun réseau, aucune
 * clé TMDB. Ils vérifient que le parcours complet fonctionne, demande en
 * français → préférences → pool → scoring → UNE recommandation → « un autre » →
 * refus → nouvelle recommandation.
 */

import { describe, expect, it } from "vitest";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import { parseNaturalLanguageRequest } from "@/naturalLanguage/parseRequest";
import type { RecommendationContext, TasteProfile } from "@/types/tonight";
import { recommend } from "./engine";
import { GENRE } from "@/utils/constants";

const emptyContext: RecommendationContext = {
  sessionExcluded: [],
  feedback: [],
  profile: null,
  allowRelaxation: true,
};

function profileWith(overrides: Partial<TasteProfile> = {}): TasteProfile {
  return {
    genreWeights: {},
    moodWeights: {},
    preferredEra: null,
    averageRuntime: null,
    preferredDiscovery: null,
    preferredSeasons: null,
    providerIds: [],
    watchedIds: [],
    favoriteIds: [],
    refusedIds: [],
    refusedGenreCounts: {},
    likedGenreCounts: {},
    stats: { accepted: 0, refused: 0, watched: 0, favorites: 0 },
    ...overrides,
  };
}

describe("parcours critique, langage naturel → recommandation (§72)", () => {
  it("« Je veux un film récent, joli, avec un peu d'amour, pas triste et moins de 2h »", async () => {
    const { preferences } = parseNaturalLanguageRequest(
      "Je veux un film récent, joli à regarder, avec un peu d'amour, pas déprimant et moins de deux heures",
    );

    expect(preferences.mediaType).toBe("movie");
    expect(preferences.maxRuntime).toBe(120);
    expect(preferences.excludedMoods).toContain("sad");

    const response = await recommend({ preferences, context: emptyContext, seed: 1 });

    expect(response.empty).toBe(false);
    expect(response.top).not.toBeNull();

    const top = response.top!;
    expect(top.candidate.mediaType).toBe("movie");
    // Contrainte dure respectée
    expect(top.candidate.runtime ?? 0).toBeLessThanOrEqual(120);
    // Le contenu ne doit pas être un film « triste »
    expect(top.candidate.genres).not.toContain(GENRE.HORROR);
    expect(top.matchPercent).toBeGreaterThan(45);
    expect(top.explanation.length).toBeGreaterThan(20);
    expect(response.poolSize).toBeGreaterThan(5);
  });

  it("« Une petite série feel-good terminée avec des épisodes d'environ 30 minutes »", async () => {
    const { preferences } = parseNaturalLanguageRequest(
      "Une petite série feel-good terminée avec des épisodes d'environ 30 minutes",
    );

    expect(preferences.mediaType).toBe("tv");
    expect(preferences.maxSeasons).toBe(2);
    expect(preferences.seriesStatus).toBe("ended");
    expect(preferences.targetEpisodeRuntime).toBe(30);

    const response = await recommend({ preferences, context: emptyContext, seed: 2 });
    const top = response.top;
    expect(top).not.toBeNull();
    expect(top!.candidate.mediaType).toBe("tv");
    // Série terminée et courte
    expect((top!.candidate.seasons ?? 99)).toBeLessThanOrEqual(2);
    expect(top!.candidate.status?.toLowerCase()).toContain("ended");
    // Episodes proches de 30 minutes
    expect(Math.abs((top!.candidate.episodeRuntime ?? 30) - 30)).toBeLessThanOrEqual(14);
  });
});

describe("« un autre » et exclusions de session (§42)", () => {
  it("ne repropose pas la même œuvre et respecte les exclusions de session", async () => {
    const preferences = createEmptyPreferences("questionnaire", {
      mediaType: "movie",
      moods: ["funny", "feel_good"],
      maxRuntime: 130,
      hardConstraints: ["mediaType", "maxRuntime"],
      confidence: 0.9,
    });

    const first = await recommend({ preferences, context: emptyContext, seed: 11 });
    expect(first.top).not.toBeNull();

    const firstKey = `${first.top!.candidate.mediaType}:${first.top!.candidate.id}`;
    const second = await recommend({
      preferences,
      context: { ...emptyContext, sessionExcluded: [firstKey] },
      seed: 12,
    });

    expect(second.top).not.toBeNull();
    expect(`${second.top!.candidate.mediaType}:${second.top!.candidate.id}`).not.toBe(firstKey);
  });

  it("écarte les œuvres déjà vues ou déjà refusées", async () => {
    const preferences = createEmptyPreferences("questionnaire", {
      mediaType: "movie",
      hardConstraints: ["mediaType"],
    });
    // On interdit la moitié du catalogue : le moteur doit continuer à répondre.
    const blocked = Array.from({ length: 40 }, (_, index) => `movie:${900101 + index}`);
    const response = await recommend({
      preferences,
      context: { ...emptyContext, profile: profileWith({ watchedIds: blocked, refusedIds: blocked }) },
      seed: 3,
    });
    expect(response.top).not.toBeNull();
    expect(blocked).not.toContain(`movie:${response.top!.candidate.id}`);
  });
});

describe("assouplissement intelligent (§37)", () => {
  it("assouplit plutôt que de renvoyer un écran vide", async () => {
    const preferences = createEmptyPreferences("natural_language", {
      mediaType: "movie",
      genres: [GENRE.DOCUMENTARY],
      maxRuntime: 70,
      minRating: 8.5,
      minYear: 2015,
      hardConstraints: ["mediaType", "requireGenre", "maxRuntime", "minRating", "minYear"],
      confidence: 0.9,
    });

    const response = await recommend({ preferences, context: emptyContext, seed: 5 });
    expect(response.empty).toBe(false);
    expect(response.top).not.toBeNull();
    // L'assouplissement est TRACÉ et expliqué à l'utilisateur.
    expect(response.relaxations.length).toBeGreaterThan(0);
    expect(response.relaxations[0].message.length).toBeGreaterThan(10);
  });

  it("respecte une contrainte dure tant qu'elle est tenable", async () => {
    const preferences = createEmptyPreferences("questionnaire", {
      mediaType: "movie",
      maxRuntime: 95,
      hardConstraints: ["mediaType", "maxRuntime"],
    });
    const response = await recommend({ preferences, context: emptyContext, seed: 4 });
    expect(response.top!.candidate.runtime ?? 0).toBeLessThanOrEqual(95);
    expect(response.relaxations).toHaveLength(0);
  });

  it("ne relâche rien quand l'utilisateur l'a explicitement interdit", async () => {
    const preferences = createEmptyPreferences("natural_language", {
      mediaType: "movie",
      genres: [GENRE.DOCUMENTARY],
      maxRuntime: 70,
      minRating: 8.5,
      minYear: 2015,
      hardConstraints: ["mediaType", "requireGenre", "maxRuntime", "minRating", "minYear"],
      confidence: 0.9,
    });

    const response = await recommend({
      preferences,
      context: { ...emptyContext, allowRelaxation: false },
      seed: 5,
    });

    // Aucune tentative d'assouplissement n'a été jouée.
    expect(response.relaxations).toHaveLength(0);
    expect(response.fullyRelaxed).toBe(false);
    expect(response.appliedPreferences.maxRuntime).toBe(70);
    expect(response.appliedPreferences.minRating).toBe(8.5);
    expect(response.appliedPreferences.hardConstraints).toContain("maxRuntime");
  });

  it("sert d'abord les plateformes demandées quand c'est possible", async () => {
    const preferences = createEmptyPreferences("questionnaire", {
      mediaType: "movie",
      providers: [8],
      monetizationTypes: ["flatrate"],
      hardConstraints: ["mediaType", "providers"],
    });
    const response = await recommend({ preferences, context: emptyContext, seed: 6 });
    expect(response.top).not.toBeNull();
    expect(response.top!.candidate.providers.some((provider) => provider.providerId === 8)).toBe(true);
  });
});

describe("moteur SÉRIE (§23 → §30)", () => {
  it("respecte l'engagement demandé (longue série)", async () => {
    const preferences = createEmptyPreferences("questionnaire", {
      mediaType: "tv",
      commitment: "long",
      minSeasons: 4,
      hardConstraints: ["mediaType", "minSeasons"],
      softPreferences: ["longRuntime"],
    });
    const response = await recommend({ preferences, context: emptyContext, seed: 8 });
    expect(response.top!.candidate.seasons ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("ne casse pas une contrainte dure de durée d'épisode sans le dire", async () => {
    const preferences = createEmptyPreferences("questionnaire", {
      mediaType: "tv",
      targetEpisodeRuntime: 22,
      episodeRuntimeTolerance: 8,
      hardConstraints: ["mediaType", "maxRuntime"],
    });
    const response = await recommend({ preferences, context: emptyContext, seed: 9 });
    const top = response.top!;
    const runtime = top.candidate.episodeRuntime ?? 0;
    if (runtime > 30) {
      // Si la contrainte a dû être lâchée, l'utilisateur en est informé.
      expect(response.relaxations.length).toBeGreaterThan(0);
    } else {
      expect(runtime).toBeLessThanOrEqual(30);
    }
  });
});

describe("mode YOLO (§52)", () => {
  it("n'est pas du hasard : jamais mal noté, jamais sans votes", async () => {
    const preferences = createEmptyPreferences("yolo", {
      mediaType: "any",
      discoveryLevel: "surprise",
      qualityPreference: "solid",
      minRating: 6,
      hardConstraints: ["minRating"],
      confidence: 0.75,
    });
    for (let seed = 1; seed <= 5; seed += 1) {
      const response = await recommend({
        preferences,
        context: emptyContext,
        seed: seed * 17,
      });
      const top = response.top;
      expect(top).not.toBeNull();
      expect(top!.candidate.voteAverage).toBeGreaterThanOrEqual(6);
      expect(top!.candidate.voteCount).toBeGreaterThanOrEqual(100);
    }
  });
});
