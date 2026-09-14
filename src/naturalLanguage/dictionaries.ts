/**
 * Dictionnaires du parser français.
 *
 * Objectif : l'utilisateur n'a JAMAIS besoin des mots exacts de TONIGHT.
 * « un truc qui fait rire », « que je peux voir en famille », « pas prise de
 * tête » → tout doit être compris.
 */

import { MOOD_DEFINITIONS } from "@/data/moods";
import type { Mood } from "@/types/tonight";
import { GENRE } from "@/utils/constants";

/* -------------------------------------------------------------------------- */
/* Genres                                                                     */
/* -------------------------------------------------------------------------- */

export const GENRE_PHRASES: Array<{ id: number; phrases: string[] }> = [
  {
    id: GENRE.COMEDY,
    phrases: ["comedie", "comédie", "humour", "humoristique", "comique", "drole", "drôle", "marrant", "rigolo", "hilarant", "comedy", "faire rire", "qui fait rire", "se marrer", "deconner", "loufoque", "absurde"],
  },
  {
    id: GENRE.ROMANCE,
    phrases: ["romance", "romantique", "amour", "amoureux", "amoureuse", "histoire d'amour", "histoire d amour", "love", "coup de foudre", "sentimental", "sentimentale", "romantic"],
  },
  {
    id: GENRE.SCIENCE_FICTION,
    phrases: ["science-fiction", "science fiction", "sci-fi", "sci fi", "sf", "futuriste", "dystopie", "dystopique", "post-apocalyptique", "space opera", "vaisseau spatial", "extraterrestre", "robots", "ia", "intelligence artificielle"],
  },
  {
    id: GENRE.ACTION,
    phrases: ["action", "baston", "gros bras", "explosions", "poursuite", "blockbuster"],
  },
  {
    id: GENRE.THRILLER,
    phrases: ["thriller", "suspense", "tension", "angoissant", "stressant", "frisson"],
  },
  {
    id: GENRE.HORROR,
    phrases: ["horreur", "épouvante", "epouvante", "flippant", "qui fait peur", "peur", "gore", "horror", "scary", "terrifiant"],
  },
  {
    id: GENRE.DRAMA,
    phrases: ["drame", "dramatique", "drama", "melodrame"],
  },
  {
    id: GENRE.CRIME,
    phrases: ["crime", "criminel", "policier", "policière", "policiere", "flic", "flics", "gangster", "mafia", "braquage", "polar", "meurtre", "serial killer", "tueur", "prison", "enquête policière"],
  },
  {
    id: GENRE.MYSTERY,
    phrases: ["mystère", "mystere", "mystérieux", "mysterieux", "enquête", "enquete", "énigme", "enigme", "disparition", "whodunit", "intrigue", "complot"],
  },
  {
    id: GENRE.ANIMATION,
    phrases: ["animation", "animé", "anime", "dessin animé", "dessin anime", "manga", "pixar", "disney"],
  },
  {
    id: GENRE.DOCUMENTARY,
    phrases: ["documentaire", "docu", "doc", "reportage", "true crime"],
  },
  {
    id: GENRE.FAMILY,
    phrases: ["familial", "famille", "en famille", "avec les enfants", "pour les enfants", "jeunesse", "tout public", "conte"],
  },
  {
    id: GENRE.FANTASY,
    phrases: ["fantasy", "fantastique", "magie", "magique", "médiéval", "medieval", "dragon", "sorcière", "sorcier", "épée", "royaume"],
  },
  {
    id: GENRE.HISTORY,
    phrases: ["historique", "histoire vraie", "biopic", "biographie", "époque", "epoque", "période", "periode", "guerre", "militaire", "napoléon", "antiquité"],
  },
  {
    id: GENRE.MUSIC,
    phrases: ["musical", "musicale", "comédie musicale", "comedie musicale", "musique", "concert", "chanson", "chant"],
  },
  {
    id: GENRE.WAR,
    phrases: ["guerre", "guerrier", "combat", "militaire", "seconde guerre", "ww2"],
  },
  {
    id: GENRE.WESTERN,
    phrases: ["western", "cowboy", "far west"],
  },
  {
    id: GENRE.ADVENTURE,
    phrases: ["aventure", "aventures", "voyage", "expédition", "expedition", "exploration", "quête", "quete", "trésor", "tresor", "road trip", "odyssée"],
  },
];

/* -------------------------------------------------------------------------- */
/* Moods                                                                      */
/* -------------------------------------------------------------------------- */

/** Synonymes supplémentaires ajoutés aux indices textuels des moods. */
export const MOOD_SYNONYMS: Partial<Record<Mood, string[]>> = {
  funny: ["humour", "qui fait rire", "faire rire", "se marrer", "drole", "drôle", "marrant", "comedie", "comédie", "léger et drôle", "humoristique"],
  romance: ["un peu d'amour", "un peu d amour", "histoire d'amour", "avec de l'amour", "romantique", "romantiques", "amourette", "couple", "amour"],
  feel_good: ["feel-good", "feel good", "bonne humeur", "rayonnant", "uplifting", "chaleureux", "positif", "revigorant", "bonne vibe", "gentil", "cozy"],
  easy_watch: ["facile à regarder", "facile a regarder", "sans prise de tête", "sans prise de tete", "pas prise de tête", "pas prise de tete", "tranquille", "détente", "detente", "peinard", "cool", "léger", "leger", "décontracté", "simple à suivre"],
  comfort: ["série doudou", "serie doudou", "cocooning", "réconfortant", "reconfortant", "familière", "confortable"],
  mystery: ["mystère", "mystere", "mystérieux", "mysterieuse", "chercher ce qui s'est passé", "enquête", "enquete", "énigme", "intrigue", "secret"],
  investigation: ["enquête", "enquete", "investigation", "policier", "policière", "policiere", "flic", "détective", "detective", "inspecteur", "affaire"],
  mind_bending: ["prise de tête", "prise de tete", "mindfuck", "mind fuck", "retourne le cerveau", "qui retourne le cerveau", "mind-bending", "mind blowing", "vertige", "twist", "chute", "psychologique", "cérébral", "cerebral", "déroutant", "deroutant"],
  action: ["action", "bagarre", "baston", "explosions", "poursuite", "adrénaline", "adrenaline"],
  scifi: ["science-fiction", "sci-fi", "sf", "espace", "spatial", "futur", "robot", "ia", "dystopie", "anticipation", "extraterrestre", "vaisseau"],
  fantasy: ["fantasy", "magie", "magique", "fantastique", "dragon", "médiéval", "medieval", "royaume", "sorcière"],
  adventure: ["aventure", "voyage", "expédition", "exploration", "quête", "road trip"],
  emotion: ["émouvant", "emouvant", "pleurer", "larmes", "bouleversant", "touchant", "sensible", "sentimental"],
  suspense: ["suspense", "tension", "angoissant", "stressant", "flippant", "peur", "inquiétant"],
  horror: ["horreur", "épouvante", "epouvante", "gore", "flippant", "qui fait peur", "terreur"],
  drama: ["drame", "dramatique", "dramatiques", "tragique", "sérieux", "serieux", "sérieuse", "serieuse", "profond", "profonde"],
  family: ["en famille", "familial", "avec les enfants", "pour les enfants", "jeunesse", "tout public"],
  beautiful: ["beau", "belle", "joli", "jolie", "beau visuellement", "belle image", "magnifique", "sublime", "somptueux", "photographie", "esthétique", "esthetique", "poétique", "visuellement"],
  intense: ["intense", "puissant", "brutal", "éprouvant", "marquant"],
  historical: ["historique", "époque", "epoque", "d'époque", "période", "costume", "roi", "reine", "empire", "siècle", "siecle"],
  detective: ["policier", "policière", "policiere", "flic", "inspecteur", "inspectrice", "commissaire", "détective", "detective", "brigade", "enquêteur", "enqueteur"],
  justice: ["justice", "tribunal", "avocat", "procès", "proces", "juge", "verdict", "judiciaire"],
  medical: ["médical", "medical", "hôpital", "hopital", "médecin", "medecin", "urgences", "docteur", "chirurgie", "internes"],
  workplace: ["bureau", "entreprise", "travail", "collègues", "start-up", "politique", "professionnel", "quotidien", "carrière"],
  sad: ["triste", "tristes", "deprimant", "déprimant", "déprimante", "deprimante", "déprime", "deprime", "larmoyant", "plombant", "désespérant", "desesperant", "mortifère", "glauque"],
  dark: ["sombre", "sombres", "dark", "noir", "glauque", "morbide", "violent", "violente", "sordide", "sinistre", "malsain"],
  heavy: ["prise de tête", "prise de tete", "lourd", "lourde", "lourdes", "éprouvant", "eprouvant", "difficile", "pénible", "penible", "dur", "dure", "trop sérieux", "trop serieux", "trop sérieuse", "trop serieuse", "sérieux", "serieux", "sérieuse", "serieuse", "complet", "prise de crane"],
  romcom: ["comédie romantique", "comedie romantique", "rom-com", "romcom"],
  gore: ["gore", "sanglant", "sang", "tripes"],
  childish: ["enfantin", "gnangnan", "pour enfants", "gamin", "simplet"],
};

/** Phrases de mood fusionnées : indices textuels du mood + synonymes. */
export function moodPhrases(mood: Mood): string[] {
  const definition = MOOD_DEFINITIONS[mood];
  return [...new Set([...definition.textHints, ...(MOOD_SYNONYMS[mood] ?? [])])];
}

/* -------------------------------------------------------------------------- */
/* Années                                                                     */
/* -------------------------------------------------------------------------- */

export const RECENT_PHRASES = [
  "récent",
  "recent",
  "récents",
  "recents",
  "récente",
  "recente",
  "nouveau",
  "nouveaux",
  "nouvelle",
  "nouvelles",
  "récemment",
  "recemment",
  "de cette année",
  "moderne",
  "contemporain",
  "pas vieux",
  "pas trop vieux",
  "actuel",
  "du moment",
];

export const OLD_PHRASES = [
  "vieux",
  "vieille",
  "vieilles",
  "ancien",
  "ancienne",
  "anciens",
  "classique",
  "classiques",
  "vintage",
  "d'époque",
  "retro",
  "rétro",
  "nostalgique",
  "d'il y a longtemps",
];

/** Décennies explicites. */
export const DECADE_PHRASES: Array<{ phrases: string[]; min: number; max: number }> = [
  { phrases: ["2020s", "annees 2020", "années 2020", "années 20", "2020"], min: 2020, max: 2029 },
  { phrases: ["2010s", "annees 2010", "années 2010", "années 10"], min: 2010, max: 2019 },
  { phrases: ["2000s", "annees 2000", "années 2000", "années 2000", "les 2000"], min: 2000, max: 2009 },
  { phrases: ["90s", "1990s", "annees 90", "années 90", "les 90", "quatre-vingt-dix"], min: 1990, max: 1999 },
  { phrases: ["80s", "1980s", "annees 80", "années 80", "les 80", "quatre-vingts"], min: 1980, max: 1989 },
  { phrases: ["70s", "1970s", "annees 70", "années 70", "les 70"], min: 1970, max: 1979 },
  { phrases: ["60s", "1960s", "annees 60", "années 60", "les 60"], min: 1960, max: 1969 },
  { phrases: ["50s", "1950s", "annees 50", "années 50", "les 50"], min: 1950, max: 1949 + 10 },
];

/** Époques larges utilisées par les questionnaires, réutilisables en langage naturel. */
export const ERA_PHRASES: Array<{
  phrases: string[];
  min: number | null;
  max: number | null;
  key: "very_recent" | "modern" | "eighties_nineties" | "classic" | "any";
}> = [
  { phrases: ["très récent", "tres recent", "tout récent", "tout recent", "sorti récemment", "cette année", "2020 à aujourd'hui", "depuis 2020"], min: 2020, max: null, key: "very_recent" },
  { phrases: ["moderne", "contemporain", "des années 2000 à 2019", "2000-2019", "années 2000-2010"], min: 2000, max: 2019, key: "modern" },
  { phrases: ["années 80-90", "annees 80-90", "années 80 et 90", "80-90", "80s-90s", "des années 80 ou 90", "années 1980-1990"], min: 1980, max: 1999, key: "eighties_nineties" },
  { phrases: ["classique", "avant 1980", "vieux classique"], min: null, max: 1979, key: "classic" },
  { phrases: ["peu importe", "indecis", "n'importe quelle époque"], min: null, max: null, key: "any" },
];

/* -------------------------------------------------------------------------- */
/* Durée                                                                      */
/* -------------------------------------------------------------------------- */

export const SHORT_PHRASES = [
  "court",
  "courte",
  "courts",
  "courtes",
  "pas long",
  "pas longue",
  "pas trop long",
  "pas trop longue",
  "vite fait",
  "rapide",
  "court métrage",
  "petit film",
];

export const LONG_PHRASES = [
  "long",
  "longue",
  "grande fresque",
  "fresque",
  "fleuve",
  "épique",
  "epopee",
  "longue durée",
];

export const EPISODE_SHORT_PHRASES = [
  "épisodes courts",
  "episodes courts",
  "épisodes courtes",
  "petits épisodes",
  "petits episodes",
  "épisodes rapides",
  "episodes rapides",
];

/* -------------------------------------------------------------------------- */
/* Séries                                                                     */
/* -------------------------------------------------------------------------- */

export const MINI_SERIES_PHRASES = ["mini-série", "mini serie", "mini-séries", "miniserie", "mini série", "limited series", "anthologie"];

export const SMALL_SERIES_PHRASES = [
  "petite série",
  "petite serie",
  "série courte",
  "serie courte",
  "pas dix saisons",
  "un truc pas trop long",
  "quelques épisodes",
  "peu de saisons",
  "pas beaucoup de saisons",
  "2 saisons",
  "deux saisons",
];

export const MEDIUM_SERIES_PHRASES = ["quelques saisons", "3 saisons", "trois saisons", "4 saisons", "quatre saisons", "5 saisons", "cinq saisons", "moyenne série"];

export const LONG_SERIES_PHRASES = [
  "longue série",
  "longue serie",
  "grande série",
  "grande serie",
  "je veux m'installer",
  "je veux m installer",
  "beaucoup de saisons",
  "plein de saisons",
  "série fleuve",
  "serie fleuve",
  "des dizaines",
];

export const ENDED_PHRASES = [
  "terminée",
  "terminee",
  "terminées",
  "qui est finie",
  "déjà finie",
  "deja finie",
  "avec une vraie fin",
  "qui se termine",
  "une fin",
  "je veux pouvoir tout voir",
  "tout voir",
  "complète",
  "complete",
  "finie",
];

export const ONGOING_PHRASES = ["en cours", "pas terminée", "pas terminee", "encore en production", "toujours en cours", "en production"];

export const CANCELED_PHRASES = ["annulée", "annulee", "arrêtée", "arretee", "stoppée", "stoppee"];

/* -------------------------------------------------------------------------- */
/* Découverte / qualité                                                       */
/* -------------------------------------------------------------------------- */

export const DISCOVERY_PHRASES: Array<{ level: "mainstream" | "safe" | "hidden_gem" | "obscure" | "surprise"; phrases: string[] }> = [
  {
    level: "obscure",
    phrases: [
      "que personne ne connaît",
      "que personne ne connait",
      "personne ne connaît",
      "personne ne connait",
      "très peu connu",
      "tres peu connu",
      "inconnu au bataillon",
      "rare",
      "enfoui",
    ],
  },
  {
    level: "hidden_gem",
    phrases: [
      "pépite",
      "pepite",
      "sous-côté",
      "sous-cote",
      "sous coté",
      "pas très connu",
      "pas tres connu",
      "peu connu",
      "méprisé",
      "meprise",
      "hidden gem",
      "que je ne connais probablement pas",
      "que je connais pas",
      "un truc que j'ai pas vu",
      "méconnu",
      "meconnu",
      "petit bijou",
    ],
  },
  {
    level: "mainstream",
    phrases: [
      "incontournable",
      "incontournables",
      "culte",
      "très connu",
      "tres connu",
      "connu",
      "classique du cinéma",
      "popular",
      "gros succès",
      "succès",
      "mainstream",
      "grand public",
      "que tout le monde a vu",
      "populaire",
    ],
  },
  {
    level: "safe",
    phrases: ["valeur sûre", "valeur sure", "bon film", "bien noté", "bien note", "fiable", "solide"],
  },
  {
    level: "surprise",
    phrases: ["surprends-moi", "surprends moi", "surprend moi", "surprise", "original", "originale", "insolite", "différent", "differente", "inattendu", "que je ne regarderais pas d'habitude", "sortir de ma zone"],
  },
];

export const QUALITY_PHRASES: Array<{ preference: "risky" | "solid" | "very_solid" | "no_risk"; phrases: string[] }> = [
  {
    preference: "no_risk",
    phrases: [
      "je ne veux pas me louper",
      "ne pas me louper",
      "pas me tromper",
      "je veux du sûr",
      "je veux du sur",
      "un mètre étalon",
      "impossible de se tromper",
      "le meilleur",
      "meilleur possible",
      "chef-d'œuvre",
      "chef d'oeuvre",
      "chef d'œuvre",
      "masterpiece",
      "culte absolu",
      "valeur sûre absolue",
    ],
  },
  {
    preference: "very_solid",
    phrases: ["très solide", "tres solide", "très bon", "tres bon", "très bonne", "excellent", "excellente", "très bien noté", "tres bien note", "grande qualité", "vraiment bon"],
  },
  {
    preference: "solid",
    phrases: ["bon", "bonne", "correct", "sympa", "honnête", "honnete", "décent"],
  },
  {
    preference: "risky",
    phrases: ["je prends des risques", "j'aime prendre des risques", "quitte à me tromper", "tentant", "je tente", "tente le coup"],
  },
];

export const RATING_PHRASES = ["note", "notes", "noté", "note de", "bien noté", "bien note", "imdb", "sur 10"];

/* -------------------------------------------------------------------------- */
/* Plateformes                                                                */
/* -------------------------------------------------------------------------- */

/** Identifiants TMDB (région FR). */
export const PROVIDER_PHRASES: Array<{ id: number; name: string; phrases: string[] }> = [
  { id: 8, name: "Netflix", phrases: ["netflix"] },
  { id: 9, name: "Prime Video", phrases: ["prime video", "amazon prime", "prime", "amazon"] },
  { id: 337, name: "Disney+", phrases: ["disney+", "disney plus", "disney", "mickey"] },
  { id: 381, name: "Canal+", phrases: ["canal+", "canal plus", "canal", "mycanal"] },
  { id: 1899, name: "Max", phrases: ["max", "hbo", "hbo max"] },
  { id: 350, name: "Apple TV+", phrases: ["apple tv", "apple tv+", "apple", "atv"] },
  { id: 531, name: "Paramount+", phrases: ["paramount", "paramount+", "paramount plus"] },
  { id: 11, name: "MUBI", phrases: ["mubi"] },
  { id: 234, name: "Arte", phrases: ["arte"] },
  { id: 283, name: "Crunchyroll", phrases: ["crunchyroll", "crunchy"] },
  { id: 56, name: "OCS", phrases: ["ocs"] },
];

export const RENTAL_PHRASES = [
  "location",
  "louer",
  "en location",
  "achat",
  "acheter",
  "vod",
  "à l'unité",
  "payant accepté",
  "je peux payer",
];

export const ANY_PROVIDER_PHRASES = ["peu importe la plateforme", "où je peux regarder", "n'importe quelle plateforme", "où", "indecis", "peu importe", "tous les services"];

/* -------------------------------------------------------------------------- */
/* Langue / pays                                                              */
/* -------------------------------------------------------------------------- */

export const LANGUAGE_PHRASES: Array<{ code: string; phrases: string[] }> = [
  { code: "fr", phrases: ["français", "francais", "française", "francaise", "en français", "hexagonal", "françaises"] },
  { code: "en", phrases: ["anglais", "anglophone", "version originale anglaise", "américain", "americain", "britannique"] },
  { code: "ja", phrases: ["japonais", "japonaise", "nippon", "anime japonais"] },
  { code: "ko", phrases: ["coréen", "coreen", "coréenne", "coréenne"] },
];

export const COUNTRY_PHRASES: Array<{ code: string; phrases: string[] }> = [
  { code: "FR", phrases: ["français", "francais", "france", "made in france", "hexagonal"] },
  { code: "US", phrases: ["américain", "americain", "us", "hollywood", "états-unis"] },
  { code: "GB", phrases: ["britannique", "anglais", "uk", "royaume-uni"] },
  { code: "JP", phrases: ["japonais", "japon", "nippon"] },
  { code: "KR", phrases: ["coréen", "coreen", "corée", "coree"] },
  { code: "ES", phrases: ["espagnol", "espagne"] },
  { code: "IT", phrases: ["italien", "italie"] },
];

/* -------------------------------------------------------------------------- */
/* Média                                                                      */
/* -------------------------------------------------------------------------- */

export const MOVIE_PHRASES = ["film", "films", "long métrage", "long metrage", "au cinéma", "au ciné", "séance", "un truc à voir", "cinoche"];

export const TV_PHRASES = [
  "série",
  "serie",
  "séries",
  "series",
  "saisons",
  "saison",
  "épisodes",
  "episodes",
  "épisode",
  "episode",
  "feuilleton",
  "mini-série",
  "mini serie",
  "mini-séries",
  "tv",
  "streaming série",
];

/* -------------------------------------------------------------------------- */
/* Exclusions                                                                 */
/* -------------------------------------------------------------------------- */

export const EXCLUSION_PHRASES = {
  animation: ["animation", "dessin animé", "dessin anime", "animé", "anime", "manga"],
  documentary: ["documentaire", "docu", "reportage"],
  musical: ["comédie musicale", "comedie musicale", "musical", "musicale"],
};
