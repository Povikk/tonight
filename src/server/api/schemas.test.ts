import { describe, expect, it } from "vitest";
import { recommendBodySchema } from "./schemas";

const emptyTasteProfile = {
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
};

describe("recommendBodySchema", () => {
  it("accepte le profil de goûts clairsemé produit par le navigateur", () => {
    const result = recommendBodySchema.safeParse({
      context: {
        sessionExcluded: [],
        feedback: [],
        profile: emptyTasteProfile,
        allowRelaxation: true,
      },
      count: 8,
      seed: 42,
    });

    expect(result.success).toBe(true);
  });

  it("accepte uniquement les moods connus dans un profil partiel", () => {
    expect(
      recommendBodySchema.safeParse({
        context: {
          profile: { ...emptyTasteProfile, moodWeights: { feel_good: 0.75 } },
        },
      }).success,
    ).toBe(true);

    expect(
      recommendBodySchema.safeParse({
        context: {
          profile: { ...emptyTasteProfile, moodWeights: { inconnu: 0.75 } },
        },
      }).success,
    ).toBe(false);
  });

  it("refuse des bornes incohérentes", () => {
    expect(recommendBodySchema.safeParse({ preferences: { minYear: 2020, maxYear: 1990 } }).success).toBe(false);
    expect(recommendBodySchema.safeParse({ preferences: { minRuntime: 120, maxRuntime: 90 } }).success).toBe(false);
    expect(recommendBodySchema.safeParse({ preferences: { minSeasons: 5, maxSeasons: 2 } }).success).toBe(false);
    expect(recommendBodySchema.safeParse({ preferences: { minYear: 1990, maxYear: 2020 } }).success).toBe(true);
  });

  it("refuse une période incohérente dans le profil de goûts", () => {
    expect(
      recommendBodySchema.safeParse({
        context: { profile: { ...emptyTasteProfile, preferredEra: { min: 2020, max: 1990 } } },
      }).success,
    ).toBe(false);
  });
});
