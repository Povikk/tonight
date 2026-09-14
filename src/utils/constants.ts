/**
 * Constantes partagées : identifiants de genres TMDB, tailles d'images,
 * configuration langues/région, statuts de séries.
 */

/* -------------------------------------------------------------------------- */
/* Genres TMDB                                                                */
/* -------------------------------------------------------------------------- */

export const GENRE = {
  ACTION: 28,
  ADVENTURE: 12,
  ANIMATION: 16,
  COMEDY: 35,
  CRIME: 80,
  DOCUMENTARY: 99,
  DRAMA: 18,
  FAMILY: 10751,
  FANTASY: 14,
  HISTORY: 36,
  HORROR: 27,
  MUSIC: 10402,
  MYSTERY: 9648,
  ROMANCE: 10749,
  SCIENCE_FICTION: 878,
  TV_MOVIE: 10770,
  THRILLER: 53,
  WAR: 10752,
  WESTERN: 37,
  // Séries uniquement
  ACTION_ADVENTURE: 10759,
  KIDS: 10762,
  NEWS: 10763,
  REALITY: 10764,
  SCI_FI_FANTASY: 10765,
  SOAP: 10766,
  TALK: 10767,
  WAR_POLITICS: 10768,
} as const;

/**
 * Genres « équivalents » entre films et séries.
 * Indispensable : côté séries, la SF s'appelle `SCI_FI_FANTASY` et l'action
 * `ACTION_ADVENTURE`. Le moteur raisonne donc en genres *canoniques* de film
 * et traduit au moment de la requête TMDB.
 */
export const TV_GENRE_EQUIVALENTS: Record<number, number[]> = {
  [GENRE.ACTION]: [GENRE.ACTION_ADVENTURE],
  [GENRE.ADVENTURE]: [GENRE.ACTION_ADVENTURE],
  [GENRE.SCIENCE_FICTION]: [GENRE.SCI_FI_FANTASY],
  [GENRE.FANTASY]: [GENRE.SCI_FI_FANTASY],
};

/** Traduit un genre canonique (film) vers son équivalent TMDB pour le média visé. */
export function toGenreForMedia(genreId: number, mediaType: "movie" | "tv"): number {
  if (mediaType === "movie") return genreId;
  const equivalents = TV_GENRE_EQUIVALENTS[genreId];
  return equivalents ? equivalents[0] : genreId;
}

/** Noms français utilisés quand TMDB n'est pas disponible (mode démo). */
export const GENRE_NAMES_FR: Record<number, string> = {
  [GENRE.ACTION]: "Action",
  [GENRE.ADVENTURE]: "Aventure",
  [GENRE.ANIMATION]: "Animation",
  [GENRE.COMEDY]: "Comédie",
  [GENRE.CRIME]: "Crime",
  [GENRE.DOCUMENTARY]: "Documentaire",
  [GENRE.DRAMA]: "Drame",
  [GENRE.FAMILY]: "Familial",
  [GENRE.FANTASY]: "Fantastique",
  [GENRE.HISTORY]: "Histoire",
  [GENRE.HORROR]: "Horreur",
  [GENRE.MUSIC]: "Musique",
  [GENRE.MYSTERY]: "Mystère",
  [GENRE.ROMANCE]: "Romance",
  [GENRE.SCIENCE_FICTION]: "Science-Fiction",
  [GENRE.TV_MOVIE]: "Téléfilm",
  [GENRE.THRILLER]: "Thriller",
  [GENRE.WAR]: "Guerre",
  [GENRE.WESTERN]: "Western",
  [GENRE.ACTION_ADVENTURE]: "Action & Aventure",
  [GENRE.KIDS]: "Jeunesse",
  [GENRE.NEWS]: "Actualités",
  [GENRE.REALITY]: "Télé-réalité",
  [GENRE.SCI_FI_FANTASY]: "Science-Fiction & Fantastique",
  [GENRE.SOAP]: "Feuilleton",
  [GENRE.TALK]: "Talk-show",
  [GENRE.WAR_POLITICS]: "Guerre & Politique",
};

export function genreName(id: number): string {
  return GENRE_NAMES_FR[id] ?? `Genre ${id}`;
}

/* -------------------------------------------------------------------------- */
/* Localisation                                                               */
/* -------------------------------------------------------------------------- */

/** Langue TMDB : l'interface et les données sont pensées pour un public FR. */
export const TMDB_LANGUAGE = process.env.TONIGHT_LANGUAGE || "fr-FR";
/** Région utilisée pour les plateformes de streaming. */
export const TMDB_REGION = process.env.TONIGHT_REGION || "FR";
/** Région utilisée pour les dates de sortie. */
export const TMDB_WATCH_REGION = TMDB_REGION;

/* -------------------------------------------------------------------------- */
/* Images                                                                     */
/* -------------------------------------------------------------------------- */

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

/**
 * Tailles d'images : on ne charge JAMAIS un original pour une vignette
 * (exigence performance §62).
 */
export const POSTER_SIZES = {
  thumb: "w185",
  card: "w342",
  detail: "w500",
} as const;

export const BACKDROP_SIZES = {
  card: "w780",
  hero: "w1280",
  full: "original",
} as const;

export const PROFILE_SIZE = "w185";

/* -------------------------------------------------------------------------- */
/* Séries : statuts TMDB                                                      */
/* -------------------------------------------------------------------------- */

export type SeriesStatusKind = "ended" | "ongoing" | "canceled" | "unknown";

/**
 * TMDB renvoie des libellés libres. On les classe nous-mêmes car une série
 * « Canceled » sans vraie fin n'est PAS équivalente à une série « Ended »
 * correctement terminée (exigence §26).
 */
export function classifySeriesStatus(status: string | null | undefined): SeriesStatusKind {
  if (!status) return "unknown";
  const s = status.toLowerCase();
  if (s.includes("ended") || s.includes("terminée")) return "ended";
  if (s.includes("cancel")) return "canceled";
  if (s.includes("returning") || s.includes("production") || s.includes("pilot")) return "ongoing";
  return "unknown";
}

/** Libellé français d'un statut TMDB. */
export function seriesStatusLabel(status: string | null | undefined): string {
  switch (classifySeriesStatus(status)) {
    case "ended":
      return "Terminée";
    case "canceled":
      return "Annulée";
    case "ongoing":
      return "En cours";
    default:
      return "Statut inconnu";
  }
}

/* -------------------------------------------------------------------------- */
/* Divers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Taille du pool de candidats, et donc du nombre d'œuvres enrichies.
 *
 * Ce chiffre est un COMPROMIS assumé : en mode TMDB, chaque candidat du pool
 * coûte un appel `/movie/{id}` ou `/tv/{id}` (mesuré : ~140 ms, 8 en parallèle,
 * mis en cache 24 h). On enrichit TOUT le pool, parce qu'un seul candidat non
 * enrichi peut gagner le classement avec une durée et un nombre de saisons
 * inconnus, et TONIGHT se met alors à promettre des choses fausses.
 * 70 candidats tiennent donc dans un budget d'environ 1 seconde à froid.
 */
export const POOL_TARGET_SIZE = 70;

/** Nombre de recommandations retournées par l'API (1 principale + alternatives). */
export const RECOMMENDATION_COUNT = 8;
