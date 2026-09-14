/**
 * Tests de l'assouplissement (§37).
 *
 * L'invariant central : quand TONIGHT desserre un critère, il garde la
 * contrainte DURE sur la valeur élargie, et il annonce ce qu'il a lâché.
 *
 * Bug d'origine (trouvé en vérification live) : `maxSeasons` était purement
 * retiré des contraintes dures, si bien que « une mini-série avec une vraie
 * fin » (1 saison) recevait Dr. House (8 saisons) puis Supernatural (15) :
 * l'assouplissement faisait pire que la réponse stricte.
 */

import { describe, expect, it } from "vitest";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import { buildAttempts } from "./relaxation";

describe("assouplissement : desserrer sans lâcher (§37)", () => {
  const seriesPreferences = () =>
    createEmptyPreferences("natural_language", {
      mediaType: "tv",
      maxSeasons: 1,
      seriesStatus: "ended",
      hardConstraints: ["mediaType", "maxSeasons", "seriesEnded"],
    });

  it("la première tentative est la plus stricte", () => {
    const [first] = buildAttempts(seriesPreferences());
    expect(first.label).toBe("strict");
    expect(first.relaxations).toHaveLength(0);
    expect(first.preferences.maxSeasons).toBe(1);
    expect(first.preferences.hardConstraints).toContain("seriesEnded");
  });

  it("élargit le nombre de saisons en gardant la contrainte DURE", () => {
    const attempt = buildAttempts(seriesPreferences()).find((item) => item.label === "seasons");

    expect(attempt).toBeDefined();
    expect(attempt!.preferences.maxSeasons).toBe(3);
    // Le point capital : la valeur élargie reste vérifiable.
    expect(attempt!.preferences.hardConstraints).toContain("maxSeasons");
    // Et le format n'entraîne pas le statut dans sa chute.
    expect(attempt!.preferences.hardConstraints).toContain("seriesEnded");
    expect(attempt!.relaxations.some((item) => item.message.includes("3 saisons"))).toBe(true);
  });

  it("ne relâche le statut « terminée » qu'à une étape dédiée, et le dit", () => {
    const attempts = buildAttempts(seriesPreferences());
    const status = attempts.find((item) => item.label === "status");

    expect(status).toBeDefined();
    expect(status!.preferences.seriesStatus).toBe("any");
    expect(status!.preferences.hardConstraints).not.toContain("seriesEnded");
    expect(status!.relaxations.some((item) => item.kind === "seriesStatus")).toBe(true);
    // Une série terminée reste préférée, même quand elle n'est plus exigée.
    expect(status!.preferences.softPreferences).toContain("strongEnding");
  });

  it("la tentative finale lâche les critères secondaires mais garde le FORMAT", () => {
    const preferences = createEmptyPreferences("natural_language", {
      mediaType: "tv",
      minYear: 2015,
      maxSeasons: 1,
      seriesStatus: "ended",
      hardConstraints: ["mediaType", "maxSeasons", "seriesEnded", "minYear"],
    });
    const last = buildAttempts(preferences).at(-1);

    expect(last!.label).toBe("all");
    expect(last!.soft).toBe(true);
    expect(last!.relaxations.some((item) => item.kind === "all")).toBe(true);
    // Les critères secondaires tombent…
    expect(last!.preferences.hardConstraints).not.toContain("minYear");
    expect(last!.preferences.hardConstraints).not.toContain("seriesEnded");
    // …mais le FORMAT reste borné : une série de 15 saisons n'est pas une
    // réponse à « une mini-série », même en dernier recours. La valeur élargie
    // (3) reste donc une contrainte dure.
    expect(last!.preferences.maxSeasons).toBe(3);
    expect(last!.preferences.hardConstraints).toContain("maxSeasons");
  });

  it("ne fabrique aucune tentative inutile quand rien n'est contraint", () => {
    const attempts = buildAttempts(
      createEmptyPreferences("natural_language", { mediaType: "movie", hardConstraints: ["mediaType"] }),
    );

    // Seule la tentative stricte, puis le dernier recours : pas de bruit.
    expect(attempts.map((item) => item.label)).toEqual(["strict", "all"]);
    expect(attempts[0].relaxations).toHaveLength(0);
  });

  it("élargit la durée des épisodes plutôt que de changer de format", () => {
    const attempts = buildAttempts(
      createEmptyPreferences("natural_language", {
        mediaType: "tv",
        targetEpisodeRuntime: 30,
        episodeRuntimeTolerance: 14,
        hardConstraints: ["mediaType", "maxRuntime"],
      }),
    );
    const widened = attempts.find((item) => item.label === "runtime");

    expect(widened).toBeDefined();
    expect(widened!.preferences.episodeRuntimeTolerance).toBe(26);
    expect(widened!.preferences.targetEpisodeRuntime).toBe(30);
    // La contrainte de durée reste dure : seule la tolérance s'élargit.
    expect(widened!.preferences.hardConstraints).toContain("maxRuntime");
    expect(widened!.relaxations.some((item) => item.kind === "maxRuntime")).toBe(true);
  });
});
