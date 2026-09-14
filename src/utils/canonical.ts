/**
 * TMDB possède deux espaces de genres : films et séries.
 * TONIGHT raisonne dans l'espace « film » (canonique) et traduit seulement au
 * moment des requêtes. Ce module fait la traduction inverse pour le scoring.
 */

import { GENRE } from "./constants";

const TV_TO_CANONICAL: Record<number, number[]> = {
  [GENRE.ACTION_ADVENTURE]: [GENRE.ACTION, GENRE.ADVENTURE],
  [GENRE.SCI_FI_FANTASY]: [GENRE.SCIENCE_FICTION, GENRE.FANTASY],
  [GENRE.WAR_POLITICS]: [GENRE.WAR],
  [GENRE.KIDS]: [GENRE.FAMILY],
  [GENRE.SOAP]: [GENRE.DRAMA],
  [GENRE.NEWS]: [],
  [GENRE.REALITY]: [],
  [GENRE.TALK]: [],
};

/** Renvoie les genres d'un candidat dans l'espace canonique (film). */
export function canonicalGenres(genres: number[]): number[] {
  const output = new Set<number>();
  for (const genre of genres) {
    const mapped = TV_TO_CANONICAL[genre];
    if (mapped) {
      if (!mapped.length) continue;
      mapped.forEach((item) => output.add(item));
    } else {
      output.add(genre);
    }
  }
  return [...output];
}
