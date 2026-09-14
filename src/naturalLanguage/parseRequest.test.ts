/**
 * Tests du parser français (§70, §72).
 *
 * Les cas listés dans le cahier des charges sont tous couverts, avec une
 * attention particulière portée aux NÉGATIONS.
 */

import { describe, expect, it } from "vitest";
import { GENRE } from "@/utils/constants";
import { parseNaturalLanguageRequest } from "./parseRequest";

function parse(query: string) {
  return parseNaturalLanguageRequest(query);
}

describe("parseNaturalLanguageRequest, cas du cahier des charges", () => {
  it("« Je veux un film récent avec un peu d'amour mais pas un truc triste »", () => {
    const { preferences } = parse(
      "Je veux un film récent avec un peu d'amour mais pas un truc triste",
    );
    expect(preferences.mediaType).toBe("movie");
    expect(preferences.genres).toContain(GENRE.ROMANCE);
    expect(preferences.softRecent).toBe(true);
    expect(preferences.excludedMoods).toContain("sad");
    // « pas triste » ne doit PAS devenir un « aimer le drame »
    expect(preferences.moods).not.toContain("sad");
  });

  it("« Une série drôle avec des épisodes de 20 minutes »", () => {
    const { preferences } = parse("Une série drôle avec des épisodes de 20 minutes");
    expect(preferences.mediaType).toBe("tv");
    expect(preferences.moods).toContain("funny");
    expect(preferences.targetEpisodeRuntime).toBe(20);
    expect(preferences.hardConstraints).toContain("maxRuntime");
  });

  it("« Un thriller des années 90 de moins de deux heures »", () => {
    const { preferences } = parse("Un thriller des années 90 de moins de deux heures");
    expect(preferences.mediaType).toBe("movie");
    expect(preferences.minYear).toBe(1990);
    expect(preferences.maxYear).toBe(1999);
    expect(preferences.hardConstraints).toContain("minYear");
    expect(preferences.hardConstraints).toContain("maxYear");
    expect(preferences.maxRuntime).toBe(120);
    expect(preferences.hardConstraints).toContain("maxRuntime");
  });

  it("« Une petite série terminée pas trop sérieuse »", () => {
    const { preferences } = parse("Une petite série terminée pas trop sérieuse");
    expect(preferences.mediaType).toBe("tv");
    expect(preferences.maxSeasons).toBe(2);
    expect(preferences.commitment).toBe("small");
    expect(preferences.seriesStatus).toBe("ended");
    // « pas trop sérieuse » → pénalité sur les contenus lourds
    expect(preferences.excludedMoods.some((mood) => ["heavy", "drama"].includes(mood))).toBe(true);
  });

  it("« terminée » est un critère, « si possible » en fait une préférence (§13)", () => {
    const hard = parse("Une petite série terminée");
    expect(hard.preferences.seriesStatus).toBe("ended");
    expect(hard.preferences.hardConstraints).toContain("seriesEnded");

    // Une formule tempérée reste souple : TONIGHT pourra assouplir si rien ne
    // correspond, au lieu de rendre une liste vide.
    const soft = parse("Une petite série terminée si possible");
    expect(soft.preferences.seriesStatus).toBe("ended");
    expect(soft.preferences.hardConstraints).not.toContain("seriesEnded");
    expect(soft.preferences.softPreferences).toContain("strongEnding");
  });

  it("« Un vieux film de science-fiction »", () => {
    const { preferences } = parse("Un vieux film de science-fiction");
    expect(preferences.mediaType).toBe("movie");
    expect(preferences.genres).toContain(GENRE.SCIENCE_FICTION);
    expect(preferences.softOld).toBe(true);
  });

  it("« Quelque chose de beau visuellement et récent »", () => {
    const { preferences } = parse("Quelque chose de beau visuellement et récent");
    expect(preferences.moods).toContain("beautiful");
    expect(preferences.softRecent).toBe(true);
    expect(preferences.softPreferences).toContain("beautiful");
  });

  it("« Pas d'horreur et pas trop long »", () => {
    const { preferences } = parse("Pas d'horreur et pas trop long");
    expect(preferences.hardExcludedGenres).toContain(GENRE.HORROR);
    expect(preferences.hardConstraints).toContain("excludeGenres");
    // « pas trop long » est une préférence SOUPLE, pas une contrainte dure
    expect(preferences.maxRuntime).toBeNull();
    expect(preferences.softMaxRuntime).toBeGreaterThan(0);
    expect(preferences.softPreferences).toContain("shortRuntime");
  });

  it("« Un film très bien noté que je ne connais probablement pas »", () => {
    const { preferences } = parse("Un film très bien noté que je ne connais probablement pas");
    expect(preferences.mediaType).toBe("movie");
    expect(preferences.discoveryLevel).toBe("hidden_gem");
    expect(preferences.softPreferences).toContain("hiddenGem");
  });

  it("« Une série récente avec maximum 3 saisons »", () => {
    const { preferences } = parse("Une série récente avec maximum 3 saisons");
    expect(preferences.mediaType).toBe("tv");
    expect(preferences.maxSeasons).toBe(3);
    expect(preferences.hardConstraints).toContain("maxSeasons");
    expect(preferences.softRecent).toBe(true);
  });

  it("« Je veux juste un truc léger à regarder ce soir »", () => {
    const { preferences, needsMediaTypeQuestion } = parse("Je veux juste un truc léger à regarder ce soir");
    // Information essentielle manquante : TONIGHT doit poser UNE question
    expect(needsMediaTypeQuestion).toBe(true);
    expect(preferences.moods.some((mood) => ["easy_watch", "feel_good"].includes(mood))).toBe(true);
  });

  it("« Un bon film français »", () => {
    const { preferences } = parse("Un bon film français");
    expect(preferences.mediaType).toBe("movie");
    expect(preferences.originalLanguage).toBe("fr");
    expect(preferences.originCountry).toBe("FR");
  });

  it("« Une série policière pas trop sombre »", () => {
    const { preferences } = parse("Une série policière pas trop sombre");
    expect(preferences.mediaType).toBe("tv");
    expect(preferences.moods.some((mood) => ["detective", "investigation"].includes(mood))).toBe(true);
    // « pas trop sombre » = pénalité, pas exclusion stricte
    expect(preferences.excludedMoods).toContain("dark");
    expect(preferences.excludedMoods).not.toContain("heavy");
  });

  it("« Un film des années 80 ou 90 »", () => {
    const { preferences } = parse("Un film des années 80 ou 90");
    expect(preferences.mediaType).toBe("movie");
    expect(preferences.minYear).toBe(1980);
    expect(preferences.maxYear).toBe(1999);
  });

  it("« Une mini-série avec une vraie fin »", () => {
    const { preferences } = parse("Une mini-série avec une vraie fin");
    expect(preferences.mediaType).toBe("tv");
    expect(preferences.commitment).toBe("mini");
    expect(preferences.maxSeasons).toBe(1);
    expect(preferences.seriesStatus).toBe("ended");
  });

  it("« Un film romantique mais pas une comédie romantique »", () => {
    const { preferences } = parse("Un film romantique mais pas une comédie romantique");
    expect(preferences.mediaType).toBe("movie");
    // Romance conservée… c'est tout l'enjeu de cette phrase
    expect(preferences.genres).toContain(GENRE.ROMANCE);
    expect(preferences.hardExcludedGenres).not.toContain(GENRE.ROMANCE);
    // …mais la combinaison romance + comédie est pénalisée
    expect(preferences.excludedGenreCombos.some(
      ([a, b]) => a === GENRE.ROMANCE && b === GENRE.COMEDY,
    )).toBe(true);
  });

  it("« Un film récent de moins d'1h45 »", () => {
    const { preferences } = parse("Un film récent de moins d'1h45");
    expect(preferences.mediaType).toBe("movie");
    expect(preferences.maxRuntime).toBe(105);
    expect(preferences.hardConstraints).toContain("maxRuntime");
  });

  it("« Une série avec des épisodes de maximum 30 minutes »", () => {
    const { preferences } = parse("Une série avec des épisodes de maximum 30 minutes");
    expect(preferences.mediaType).toBe("tv");
    expect(preferences.targetEpisodeRuntime).toBe(30);
    expect(preferences.episodeRuntimeTolerance).toBeLessThanOrEqual(10);
  });

  it("« Un vieux classique mais pas en noir et blanc »", () => {
    const { preferences, needsMediaTypeQuestion } = parse("Un vieux classique mais pas en noir et blanc");
    // Aucun média nommé : TONIGHT doit demander plutôt que deviner.
    expect(needsMediaTypeQuestion).toBe(true);
    expect(preferences.softOld).toBe(true);
    // « pas en noir et blanc » remonte la borne basse des années
    expect(preferences.minYear).toBeGreaterThanOrEqual(1960);
  });
});

describe("parseNaturalLanguageRequest, négations subtiles (§12)", () => {
  it("« pas de romance » exclut strictement le genre", () => {
    const { preferences } = parse("Un film pas de romance");
    expect(preferences.hardExcludedGenres).toContain(GENRE.ROMANCE);
    expect(preferences.genres).not.toContain(GENRE.ROMANCE);
  });

  it("« pas trop vieux » veut du récent, sans dureté", () => {
    const { preferences } = parse("Un film pas trop vieux");
    expect(preferences.softRecent).toBe(true);
    expect(preferences.softOld).toBe(false);
    expect(preferences.minYear).toBeNull();
    expect(preferences.hardConstraints).not.toContain("minYear");
  });

  it("« pas forcément récent » n'implique PAS du récent", () => {
    const { preferences } = parse("Un film pas forcément récent, ce soir");
    expect(preferences.softRecent).toBe(false);
    expect(preferences.softOld).toBe(false);
  });

  it("« pas prise de tête » pénalise le cérébral", () => {
    const { preferences } = parse("Un film pas prise de tête");
    expect(preferences.excludedMoods).toContain("mind_bending");
  });

  it("« sans film d'horreur ni de violence » reste lisible", () => {
    const { preferences } = parse("Je veux un film sans horreur ni violence");
    expect(preferences.hardExcludedGenres).toContain(GENRE.HORROR);
  });

  it("« je ne veux pas de documentaire » exclut la catégorie", () => {
    const { preferences } = parse("Un film, je ne veux pas de documentaire");
    expect(preferences.excludeDocumentary).toBe(true);
    expect(preferences.hardConstraints).toContain("excludeDocumentary");
  });

  it("« pas mal » n'est pas une négation", () => {
    const { preferences } = parse("Un film pas mal du tout, assez récent");
    expect(preferences.softRecent).toBe(true);
  });
});

describe("parseNaturalLanguageRequest, plateformes et confiance", () => {
  it("détecte Netflix et la localisation/achat", () => {
    const { preferences } = parse("Un film dispo sur Netflix, location acceptée");
    expect(preferences.providers).toContain(8);
    expect(preferences.monetizationTypes).toContain("rent");
    expect(preferences.hardConstraints).toContain("providers");
  });

  it("produit des chips lisibles pour l'utilisateur", () => {
    const { chips } = parse("Un film récent joli avec un peu d'amour pas triste de moins de 2h");
    const labels = chips.map((chip) => chip.label);
    expect(labels).toContain("Film");
    expect(labels.some((label) => label.includes("2h"))).toBe(true);
    expect(chips.some((chip) => chip.kind === "mood")).toBe(true);
  });

  it("une demande riche obtient une confiance élevée", () => {
    const { preferences } = parse(
      "Un film récent, joli, avec un peu d'amour, pas triste et moins de 2 heures",
    );
    expect(preferences.confidence).toBeGreaterThan(0.6);
    expect(preferences.hardConstraints).toContain("mediaType");
  });
});

describe("chips « J'ai compris », lisibilité (§14)", () => {
  const label = (query: string) =>
    parse(query).chips.map((chip) => chip.label);

  it("ne répète pas un genre déjà couvert par un mood", () => {
    const labels = label("Un vieux film de science-fiction mystérieux");
    // « Science-fiction » (mood) suffit : pas de chip « Science-Fiction » en plus.
    const scienceFiction = labels.filter((entry) => entry.toLowerCase().includes("science"));
    expect(scienceFiction).toHaveLength(1);
    const mystery = labels.filter((entry) => entry.toLowerCase().includes("myst"));
    expect(mystery).toHaveLength(1);
  });

  it("garde les deux signaux quand ils ne se recouvrent pas", () => {
    const labels = label("Un thriller des années 90 de moins de deux heures");
    expect(labels.some((entry) => entry.includes("Thriller"))).toBe(true);
    expect(labels.some((entry) => entry.includes("1990"))).toBe(true);
  });
});
