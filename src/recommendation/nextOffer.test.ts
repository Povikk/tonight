/**
 * « 🎲 UN AUTRE » doit surprendre.
 *
 * Ce qui était reproché : le bouton suivait l'ordre de « Mes idées pour ce
 * soir ». Ces tests verrouillent le contraire : un tirage, sans répétition, qui
 * couvre bien tout le lot.
 */

import { describe, expect, it } from "vitest";
import { pickNextOfferIndex } from "./nextOffer";

/** Suite d'aléas déterministes, pour tester sans dépendre du hasard. */
function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("pickNextOfferIndex", () => {
  it("ne repropose jamais la proposition affichée", () => {
    for (let draw = 0; draw < 20; draw += 1) {
      const pick = pickNextOfferIndex(8, 3, [3], () => draw / 20);
      expect(pick).not.toBe(3);
    }
  });

  it("ne repropose jamais une proposition déjà passée à l'écran", () => {
    const shown = [0, 1, 4, 5];
    for (let draw = 0; draw < 20; draw += 1) {
      const pick = pickNextOfferIndex(8, 4, shown, () => draw / 20);
      expect(shown).not.toContain(pick);
    }
  });

  it("ne se contente pas de l'index suivant", () => {
    // Le cœur du correctif : avec un aléa qui balaie la plage, le tirage doit
    // pouvoir tomber sur N'IMPORTE quelle proposition restante, pas seulement
    // sur la suivante.
    const seen = new Set<number>();
    for (let step = 0; step < 100; step += 1) {
      const pick = pickNextOfferIndex(8, 0, [0], () => step / 100);
      if (pick !== null) seen.add(pick);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("explore tout le lot avant de rendre la main", () => {
    // Simulation d'un utilisateur qui spamme « un autre » : chaque tirage doit
    // être inédit, et la fonction ne signale l'épuisement qu'à la fin.
    const total = 5;
    let current = 0;
    const shown = [0];
    const order = [current];

    for (let guard = 0; guard < 20; guard += 1) {
      const pick = pickNextOfferIndex(total, current, shown, sequence(0.7, 0.1, 0.42, 0.99));
      if (pick === null) break;
      expect(shown).not.toContain(pick);
      shown.push(pick);
      current = pick;
      order.push(pick);
    }

    expect(order).toHaveLength(total);
    expect(new Set(order).size).toBe(total);
  });

  it("signale l'épuisement du lot plutôt que de boucler", () => {
    expect(pickNextOfferIndex(3, 1, [0, 1, 2])).toBeNull();
  });

  it("gère un lot d'une seule proposition", () => {
    // Un seul résultat, pas d'alternative : rien à tirer, on relance une recherche.
    expect(pickNextOfferIndex(1, 0, [0])).toBeNull();
  });

  it("borne une source d'aléa défaillante au lieu de renvoyer un index invalide", () => {
    // Un `Math.random` cassé (NaN, 1, valeur négative) ne doit jamais produire
    // `undefined` : le lot serait alors affiché vide.
    for (const broken of [Number.NaN, 1, 1.5, -3, Number.POSITIVE_INFINITY]) {
      const pick = pickNextOfferIndex(4, 0, [0], () => broken);
      expect(pick).toBeGreaterThanOrEqual(0);
      expect(pick).toBeLessThanOrEqual(3);
      expect(pick).not.toBe(0);
    }
  });
});
