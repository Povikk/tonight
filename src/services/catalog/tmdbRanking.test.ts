import { describe, expect, it } from "vitest";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import type { Candidate } from "@/types/tonight";
import { rankPoolForEnrichment } from "./tmdbSource";

function candidate(id: number, voteAverage: number): Candidate {
  return {
    id,
    mediaType: "movie",
    title: `Film ${id}`,
    originalTitle: `Film ${id}`,
    year: 2020,
    endYear: null,
    runtime: null,
    episodeRuntime: null,
    seasons: null,
    episodes: null,
    status: null,
    genres: [],
    genreNames: [],
    keywordSlugs: [],
    overview: "",
    voteAverage,
    voteCount: 10_000,
    popularity: 50,
    posterPath: null,
    backdropPath: null,
    originalLanguage: "fr",
    originCountry: ["FR"],
    director: null,
    creators: [],
    cast: [],
    providers: [],
    verified: false,
  };
}

describe("rankPoolForEnrichment", () => {
  it("fait tourner le pool avant enrichissement sans dégrader l'ordre des inédits", () => {
    const preferences = createEmptyPreferences("yolo", { mediaType: "movie" });
    const ranked = rankPoolForEnrichment(
      [candidate(1, 9), candidate(2, 8), candidate(3, 7)],
      preferences,
      ["movie:1"],
    );

    expect(ranked.map((item) => item.id)).toEqual([2, 3, 1]);
  });
});
