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

  it("garde le mood 'Avoir peur' dans les dix choix rapides d'Express", () => {
    expect(MOVIE_MOODS.slice(0, 10)).toContain("horror");
    expect(SERIES_MOODS.slice(0, 10)).toContain("horror");
    expect(moodDefinition("horror")).toMatchObject({ label: "Avoir peur", emoji: "😱" });
  });
});
