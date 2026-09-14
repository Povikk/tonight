/**
 * Score de découverte (§35).
 *
 * Une « pépite » n'est PAS simplement un film avec une popularité basse :
 * c'est une œuvre BIEN NOTÉE, avec SUFFISAMMENT de votes pour être crédible,
 * mais MOINS POPULAIRE que les blockbusters.
 *
 * On croise donc trois signaux :
 *   1. la qualité lissée (qualité) ;
 *   2. la confiance statistique (nombre de votes) ;
 *   3. la popularité (demande du public, échelle logarithmique).
 */

import type { Candidate, DiscoveryLevel } from "@/types/tonight";
import { clamp01, calculateQualityConfidence, calculateQualityScore } from "./qualityScore";

/** Popularité TMDB ~0-100 : on la compresse en 0-1 (log). */
function popularityNorm(popularity: number): number {
  return clamp01(Math.log10(Math.max(popularity, 1)) / 2.35);
}

/** Votes compressés en 0-1 : 10 votes → 0, 1 000 → ~0,66, 100 000 → 1. */
function voteNorm(voteCount: number): number {
  return clamp01(Math.log10(Math.max(voteCount, 1)) / 5);
}

function ratingNorm(voteAverage: number): number {
  return clamp01((voteAverage - 5.5) / 3.6);
}

export function calculateDiscoveryScore(candidate: Candidate, level: DiscoveryLevel | null): number {
  const quality = calculateQualityScore(candidate);
  const popularity = popularityNorm(candidate.popularity);
  const votes = voteNorm(candidate.voteCount);
  const rating = ratingNorm(candidate.voteAverage);

  switch (level) {
    case "mainstream":
      // Très connu ET très bien noté : popularité + preuve statistique.
      return clamp01(0.25 + popularity * 0.45 + quality * 0.2 + votes * 0.1);

    case "safe": {
      // Bien noté ET statistiquement fiable : les deux facteurs se multiplient,
      // sinon une note de 4,5 sur 40 votes serait considérée comme rassurante.
      const statistical = calculateQualityConfidence(candidate);
      const base = 0.25 + quality * 0.55;
      return clamp01(base * (0.55 + 0.45 * statistical) + votes * 0.15);
    }

    case "hidden_gem": {
      // Bonne note + assez de votes + popularité contenue…
      if (candidate.voteCount < 250) return clamp01(0.15 + rating * 0.2);
      const rarity = 1 - popularity; // plus c'est confidentiel, mieux c'est
      const credibility = clamp01(votes / 0.75); // ~4000 votes suffisent pour être « crédible »
      // …et surtout : un blockbuster n'est PAS une pépite, même très bien noté.
      // Le veto est MULTIPLICATIF : plus l'œuvre est célèbre, plus le score
      // s'effondre, et aucune autre dimension ne peut le rattraper. Une simple
      // soustraction ne suffisait pas : un film à 50 de popularité et 36 000
      // votes restait en tête d'une recherche de pépite.
      const tooFamous = clamp01((popularity - 0.45) / 0.55);
      const score = quality * 0.4 + rarity * 0.42 + credibility * 0.18;
      return clamp01(score * (1 - 0.75 * tooFamous));
    }

    case "obscure": {
      // Peu connu, mais il faut encore un minimum d'avis pour ne pas recommander n'importe quoi.
      if (candidate.voteCount < 150) return clamp01(0.1 + rating * 0.15);
      if (candidate.voteCount > 60_000) return clamp01(0.15 + (1 - popularity) * 0.2);
      const rarity = 1 - popularity;
      return clamp01(rating * 0.35 + rarity * 0.5 + clamp01(votes / 0.55) * 0.15);
    }

    case "surprise":
      // On privilégie les œuvres de milieu de tableau : ni blockbuster, ni fond de tiroir.
      return clamp01(1 - Math.abs(popularity - 0.45) * 1.6) * 0.7 + quality * 0.3;

    default:
      // Pas de consigne : léger bonus aux valeurs sûres sans écraser la variété.
      return clamp01(0.5 + quality * 0.35 + votes * 0.15);
  }
}

/** Le candidat correspond-il bien au niveau demandé ? (utilisé pour l'explication) */
export function matchesDiscoveryLevel(candidate: Candidate, level: DiscoveryLevel | null): boolean {
  if (!level) return false;
  switch (level) {
    case "mainstream":
      return candidate.popularity >= 25 || candidate.voteCount >= 8000;
    case "safe":
      return candidate.voteAverage >= 7 && candidate.voteCount >= 1000;
    case "hidden_gem":
      return candidate.voteAverage >= 7 && candidate.voteCount >= 250 && candidate.popularity < 35;
    case "obscure":
      return candidate.popularity < 20 && candidate.voteCount >= 150;
    case "surprise":
      return true;
  }
}
