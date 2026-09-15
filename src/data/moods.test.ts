import { describe, expect, it } from "vitest";
import { MOVIE_MOODS, SERIES_MOODS } from "@/types/tonight";
import { moodDefinition } from "./moods";

describe("moodDefinition", () => {
  it("fournit un emoji visible pour chaque mood proposé dans l'interface", () => {
    const selectableMoods = [...new Set([...MOVIE_MOODS, ...SERIES_MOODS])];

    for (const mood of selectableMoods) {
      expect(moodDefinition(mood).emoji.trim(), mood).not.toBe("");
    }
  });
});
