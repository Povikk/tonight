import { describe, expect, it } from "vitest";
import { apiErrorMessage, isRecommendApiResponse } from "./recommendResponse";

const validResponse = {
  top: null,
  alternatives: [],
  relaxations: [],
  fullyRelaxed: false,
  appliedPreferences: {},
  poolSize: 0,
  empty: true,
};

describe("isRecommendApiResponse", () => {
  it("accepte la structure complète renvoyée par le moteur", () => {
    expect(isRecommendApiResponse(validResponse)).toBe(true);
  });

  it("refuse une erreur générique sans alternatives", () => {
    expect(isRecommendApiResponse({ error: "Trop de requêtes." })).toBe(false);
  });

  it("refuse les contenus non structurés", () => {
    expect(isRecommendApiResponse(null)).toBe(false);
    expect(isRecommendApiResponse("erreur proxy")).toBe(false);
  });
});

describe("apiErrorMessage", () => {
  it("récupère uniquement un message d'erreur texte non vide", () => {
    expect(apiErrorMessage({ error: "Réessaie dans un instant." })).toBe("Réessaie dans un instant.");
    expect(apiErrorMessage({ error: "" })).toBeNull();
  });
});
