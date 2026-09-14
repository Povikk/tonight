/**
 * Score de plateforme (§22, §33).
 *
 * Règles :
 *  - si l'utilisateur a choisi des plateformes, une disponibilité en abonnement
 *    (flatrate) vaut le maximum, en gratuit/avec pub un peu moins, en
 *    location/achat uniquement si l'utilisateur l'a accepté ;
 *  - si aucune disponibilité n'est connue, on ne pénalise pas : l'information
 *    manque souvent pour les petits titres.
 */

import type { Candidate, MonetizationType, TonightSearchPreferences } from "@/types/tonight";
import { clamp01 } from "./qualityScore";

const MONETIZATION_VALUE: Record<MonetizationType, number> = {
  flatrate: 1,
  free: 0.95,
  ads: 0.9,
  rent: 0.55,
  buy: 0.5,
};

export interface ProviderScore {
  value: number;
  /** Nom de la plateforme réellement trouvée, pour l'affichage et l'explication. */
  matched: { name: string; monetization: MonetizationType } | null;
}

export function calculateProviderScore(
  candidate: Candidate,
  preferences: TonightSearchPreferences,
): ProviderScore {
  const requested = preferences.providers;
  const allowed = preferences.monetizationTypes.length
    ? preferences.monetizationTypes
    : (["flatrate", "free", "ads"] as MonetizationType[]);

  if (!requested.length) {
    // Aucune contrainte : on valorise légèrement la disponibilité connue.
    const best = bestAvailability(candidate, ["flatrate", "free", "ads", "rent", "buy"]);
    return { value: best ? 0.9 : 0.7, matched: best ? { name: best.name, monetization: best.monetization } : null };
  }

  if (!candidate.providers.length) {
    // Disponibilité inconnue : neutre plutôt que pénalisant.
    return { value: 0.6, matched: null };
  }

  const matching = candidate.providers.filter(
    (provider) => requested.includes(provider.providerId) && allowed.includes(provider.monetization),
  );
  if (matching.length) {
    const best = matching.reduce((current, provider) =>
      MONETIZATION_VALUE[provider.monetization] > MONETIZATION_VALUE[current.monetization] ? provider : current,
    );
    return { value: MONETIZATION_VALUE[best.monetization], matched: { name: best.name, monetization: best.monetization } };
  }

  // Présent ailleurs, mais pas chez les plateformes demandées.
  const elsewhere = bestAvailability(candidate, allowed);
  if (elsewhere && allowed.includes("rent")) {
    return { value: 0.45, matched: { name: elsewhere.name, monetization: elsewhere.monetization } };
  }
  return { value: 0.15, matched: null };
}

function bestAvailability(candidate: Candidate, allowed: MonetizationType[]) {
  const candidates = candidate.providers.filter((provider) => allowed.includes(provider.monetization));
  if (!candidates.length) return null;
  return candidates.reduce((current, provider) =>
    MONETIZATION_VALUE[provider.monetization] > MONETIZATION_VALUE[current.monetization] ? provider : current,
  );
}

/** Libellé humain d'un type de diffusion. */
export function monetizationLabel(monetization: MonetizationType): string {
  switch (monetization) {
    case "flatrate":
      return "inclus dans l'abonnement";
    case "free":
      return "gratuit";
    case "ads":
      return "gratuit avec pub";
    case "rent":
      return "en location";
    case "buy":
      return "à l'achat";
    default:
      return "disponible";
  }
}

/** Score de l'époque (§33). */
export function calculateEraScore(
  candidate: Candidate,
  preferences: TonightSearchPreferences,
): { value: number; note: string | null } {
  const year = candidate.year;
  if (!year) return { value: 0.5, note: null };

  const { softRecent, softOld, softMinYear, softMaxYear, minYear, maxYear } = preferences;

  // Contraintes dures déjà filtrées : ici on nuance.
  if (softRecent && softMinYear !== null) {
    if (year >= softMinYear) return { value: 1 - Math.min((year - softMinYear) / 40, 0.15), note: "récent" };
    return { value: clamp01(1 - (softMinYear - year) / 25), note: null };
  }
  if (softOld && softMaxYear !== null) {
    if (year <= softMaxYear) return { value: 1, note: "plutôt ancien" };
    return { value: clamp01(1 - (year - softMaxYear) / 25), note: null };
  }
  if (minYear !== null && maxYear === null) {
    return { value: clamp01(0.6 + Math.min((year - minYear) / 40, 0.4)), note: null };
  }
  if (maxYear !== null) {
    return { value: clamp01(0.6 + Math.min((maxYear - year) / 40, 0.4)), note: null };
  }
  return { value: 0.7, note: null };
}
