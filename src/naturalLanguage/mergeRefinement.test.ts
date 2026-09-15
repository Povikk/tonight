import { describe, expect, it } from "vitest";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import { GENRE } from "@/utils/constants";
import { parseNaturalLanguageRequest } from "./parseRequest";
import { mergeRefinementPreferences, progressiveRecentYear } from "./mergeRefinement";

describe("progressiveRecentYear", () => {
  it("remplace un vieux résultat par une vraie borne récente", () => {
    expect(progressiveRecentYear(1994, 2026)).toBe(2014);
  });

  it("avance d'une année par rapport au résultat courant", () => {
    expect(progressiveRecentYear(2020, 2026)).toBe(2021);
  });

  it("ne demande jamais une année future", () => {
    expect(progressiveRecentYear(2026, 2026)).toBe(2026);
  });
});

describe("mergeRefinementPreferences", () => {
  it("conserve YOLO et ajoute une préférence plus récente", () => {
    const base = createEmptyPreferences("yolo", {
      mediaType: "movie",
      discoveryLevel: "surprise",
      minRating: 6,
    });
    const parsed = parseNaturalLanguageRequest("plus récent", {
      forcedMediaType: "movie",
      source: "yolo",
    }).preferences;

    const merged = mergeRefinementPreferences(base, parsed);

    expect(merged.mediaType).toBe("movie");
    expect(merged.discoveryLevel).toBe("surprise");
    expect(merged.minRating).toBe(6);
    expect(merged.softRecent).toBe(true);
  });

  it("comprend 'qui fait moins peur' comme une pénalité d'horreur", () => {
    const base = createEmptyPreferences("yolo", { mediaType: "any" });
    const parsed = parseNaturalLanguageRequest("qui fait moins peur", {
      forcedMediaType: "any",
      source: "yolo",
    }).preferences;

    const merged = mergeRefinementPreferences(base, parsed);

    expect(merged.excludedGenres).toContain(GENRE.HORROR);
    expect(merged.excludedMoods).toContain("horror");
    expect(merged.hardExcludedGenres).not.toContain(GENRE.HORROR);
  });

  it("conserve l'origine d'un questionnaire", () => {
    const base = createEmptyPreferences("questionnaire", { mediaType: "tv" });
    const parsed = parseNaturalLanguageRequest("plus récent", {
      forcedMediaType: "tv",
      source: "questionnaire",
    }).preferences;

    expect(mergeRefinementPreferences(base, parsed).source).toBe("questionnaire");
  });
});
