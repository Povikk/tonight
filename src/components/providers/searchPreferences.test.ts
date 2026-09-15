import { describe, expect, it } from "vitest";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import { resolveSearchPreferences } from "./searchPreferences";

describe("resolveSearchPreferences", () => {
  it("fait des préférences Express la nouvelle référence de session", () => {
    const current = createEmptyPreferences("natural_language", { mediaType: "any" });
    const express = createEmptyPreferences("express", { mediaType: "movie", moods: ["horror"] });

    const resolved = resolveSearchPreferences(current, express, "express");

    expect(resolved).toBe(express);
    expect(resolved.mediaType).toBe("movie");
    expect(resolved.moods).toEqual(["horror"]);
  });

  it("applique la source demandée sans muter les préférences", () => {
    const questionnaire = createEmptyPreferences("questionnaire", { mediaType: "tv" });
    const resolved = resolveSearchPreferences(questionnaire, questionnaire, "yolo");

    expect(resolved).not.toBe(questionnaire);
    expect(resolved.source).toBe("yolo");
    expect(questionnaire.source).toBe("questionnaire");
  });
});
