/**
 * Choix de la proposition suivante pour « 🎲 UN AUTRE ».
 *
 * POURQUOI UN TIRAGE, ET PAS L'INDEX SUIVANT
 * -----------------------------------------
 * Avancer d'un cran revenait à dérouler « Mes idées pour ce soir » dans l'ordre :
 * l'utilisateur voyait la liste défiler et n'avait plus l'impression que TONIGHT
 * tranchait pour lui. Or c'est tout le produit.
 *
 * On tire donc au hasard parmi les propositions que l'on n'a PAS encore montrées,
 * en excluant la proposition courante. Les candidates viennent toutes de la même
 * bande de pertinence (§36) : le tirage reste donc de qualité, il n'est juste
 * plus prévisible.
 *
 * Fonction pure et sans état : la fonction de tirage est injectable, ce qui rend
 * le comportement testable sans dépendre du hasard.
 *
 * @param total         nombre de propositions du lot courant
 * @param currentIndex  proposition actuellement affichée
 * @param shownIndexes  propositions déjà passées à l'écran
 * @param random        source d'aléa, `Math.random` par défaut
 * @returns l'index tiré, ou `null` si tout le lot a déjà été vu
 */
export function pickNextOfferIndex(
  total: number,
  currentIndex: number,
  shownIndexes: readonly number[],
  random: () => number = Math.random,
): number | null {
  const remaining: number[] = [];
  for (let index = 0; index < total; index += 1) {
    if (index === currentIndex) continue;
    if (shownIndexes.includes(index)) continue;
    remaining.push(index);
  }

  if (remaining.length === 0) return null;

  // On borne la source d'aléa : une valeur hors [0, 1) ne doit jamais produire
  // d'index invalide (et donc un écran vide).
  const draw = random();
  const bounded = Number.isFinite(draw) ? Math.min(Math.max(draw, 0), 0.999999) : 0;
  return remaining[Math.floor(bounded * remaining.length)];
}
