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
});
