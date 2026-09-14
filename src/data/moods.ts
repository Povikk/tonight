/**
 * Dictionnaire des moods.
 *
 * Un mood est une INTENTION (« je veux rire », « retourne-moi le cerveau »).
 * Il n'est jamais réductible à un seul genre TMDB : chaque mood combine
 *   - des genres (signal fort, mais pas suffisant) ;
 *   - des keywords TMDB (recherche dédiée pour le mode TMDB) ;
 *   - des indices textuels présents dans le synopsis (utilisés pour scorer) ;
 *   - d'éventuels genres contradictoires (signal négatif).
 *
 * Cette structure est partagée par le parser, le moteur de scoring et l'UI.
 */

import type { Mood } from "@/types/tonight";
import { GENRE } from "@/utils/constants";

export interface MoodDefinition {
  id: Mood;
  /** Libellé pour le questionnaire Film. */
  label: string;
  /** Libellé pour le questionnaire Série (même mood, vocabulaire différent). */
  labelSeries?: string;
  emoji: string;
  /** Genres TMDB canoniques (espace « film ») fortement associés au mood. */
  genres: number[];
  /** Genres qui contredisent le mood. */
  conflictGenres?: number[];
  /**
   * Libellés de keywords recherchés sur TMDB (mode TMDB), par ordre de
   * préférence.
   *
   * CONTRAINTE : chaque libellé doit correspondre EXACTEMENT à un keyword TMDB
   * existant (accents, casse et tirets ignorés, voir
   * `services/tmdb/keywords.ts`). Un libellé inexistant est ignoré, et comme
   * `discover with_keywords` a besoin d'identifiants, un mood dont AUCUN
   * libellé n'existe n'a plus aucune piscine de candidats. Les libellés de
   * cette liste ont donc tous été vérifiés contre l'API.
   */
  keywordLabels: string[];
  /** Slugs de keywords locaux (mode démo + analyse de synopsis). */
  keywordSlugs: string[];
  /** Indices textuels (français et anglais) dans le synopsis. */
  textHints: string[];
  /** Moods proches : un candidat qui les coche bénéficie d'un crédit partiel. */
  siblings: Mood[];
}

const positiveMoods: MoodDefinition[] = [
  {
    id: "funny",
    label: "Faire rire",
    labelSeries: "Comédie",
    emoji: "😂",
    genres: [GENRE.COMEDY],
    keywordLabels: ["comedy", "funny", "humour", "satire"],
    keywordSlugs: ["comedy", "satire"],
    textHints: ["comédie", "comique", "drôle", "drole", "humour", "hilarant", "rire", "absurde", "ironie", "satirique", "loufoque", "humoristique"],
    siblings: ["feel_good", "easy_watch", "comfort"],
  },
  {
    id: "romance",
    label: "Un peu d'amour",
    labelSeries: "Romance",
    emoji: "❤️",
    genres: [GENRE.ROMANCE],
    keywordLabels: ["romance", "love story"],
    keywordSlugs: ["romance", "love-story"],
    textHints: ["amour", "amoureux", "amoureuse", "romance", "romantique", "couple", "passion", "sentiments", "coup de foudre", "relation amoureuse", "love"],
    siblings: ["emotion"],
  },
  {
    id: "feel_good",
    label: "Feel-good",
    labelSeries: "Feel-good",
    emoji: "😌",
    genres: [GENRE.COMEDY, GENRE.FAMILY],
    conflictGenres: [GENRE.HORROR],
    keywordLabels: ["heartwarming", "uplifting", "feelgood", "comfort"],
    keywordSlugs: ["feel-good", "heartwarming"],
    textHints: ["feel-good", "feel good", "réconfortant", "reconfortant", "chaleureux", "généreux", "bienveillant", "optimiste", "solaire", "amitié", "espoir", "heureux", "gentillesse"],
    siblings: ["easy_watch", "comfort", "funny"],
  },
  {
    id: "easy_watch",
    label: "Facile à regarder",
    emoji: "🛋️",
    genres: [GENRE.COMEDY, GENRE.FAMILY, GENRE.ADVENTURE],
    conflictGenres: [GENRE.HORROR, GENRE.WAR],
    keywordLabels: ["lighthearted"],
    keywordSlugs: ["lighthearted"],
    textHints: ["léger", "leger", "détente", "accessible", "ludique", "décontracté", "facile", "sans prise de tête", "divertissant"],
    siblings: ["feel_good", "comfort", "family"],
  },
  {
    id: "comfort",
    label: "Série confortable",
    emoji: "🛋️",
    genres: [GENRE.COMEDY, GENRE.FAMILY, GENRE.DRAMA],
    conflictGenres: [GENRE.HORROR, GENRE.WAR],
    keywordLabels: ["comfort", "cosy", "sitcom"],
    keywordSlugs: ["comfort", "cosy"],
    textHints: ["confortable", "famille", "quotidien", "amitié", "chaleureux", "réconfort", "petite ville", "gentil"],
    siblings: ["feel_good", "workplace"],
  },
  {
    id: "mystery",
    label: "Mystère / Enquête",
    labelSeries: "Mystère",
    emoji: "🧠",
    genres: [GENRE.MYSTERY, GENRE.THRILLER, GENRE.CRIME],
    keywordLabels: ["whodunit", "mystery"],
    keywordSlugs: ["mystery", "whodunit"],
    textHints: ["mystère", "mystere", "mystérieux", "énigme", "enigme", "secret", "disparition", "inconnu", "révélations", "puzzle", "vérité cachée"],
    siblings: ["investigation", "detective", "mind_bending"],
  },
  {
    id: "investigation",
    label: "Enquête",
    emoji: "🔍",
    genres: [GENRE.MYSTERY, GENRE.CRIME, GENRE.DRAMA],
    keywordLabels: ["investigation", "detective"],
    keywordSlugs: ["investigation", "detective"],
    textHints: ["enquête", "enquete", "enquêteur", "enquêteuse", "investigation", "détective", "detective", "inspecteur", "commissaire", "affaire", "meurtre", "police", "journaliste"],
    siblings: ["detective", "mystery", "justice"],
  },
  {
    id: "mind_bending",
    label: "Me retourner le cerveau",
    labelSeries: "Mindfuck",
    emoji: "🤯",
    genres: [GENRE.SCIENCE_FICTION, GENRE.MYSTERY, GENRE.THRILLER],
    keywordLabels: ["mind bending", "surrealism"],
    keywordSlugs: ["mind-bending", "surreal", "twist"],
    textHints: ["réalité", "realite", "surréaliste", "vertige", "métaphore", "mémoire", "conscience", "temps", "identité", "puzzle", "psychologique", "cauchemar", "illusion", "perception", "onirique"],
    siblings: ["mystery", "scifi"],
  },
  {
    id: "action",
    label: "Action",
    emoji: "💥",
    genres: [GENRE.ACTION, GENRE.THRILLER],
    keywordLabels: ["action hero"],
    keywordSlugs: ["action"],
    textHints: ["action", "combat", "poursuite", "course-poursuite", "explosion", "braquage", "guerre des gangs", "arts martiaux", "héros", "assaut", "fusillade"],
    siblings: ["adventure", "intense", "suspense"],
  },
  {
    id: "scifi",
    label: "Science-fiction",
    emoji: "🚀",
    genres: [GENRE.SCIENCE_FICTION],
    keywordLabels: ["dystopia", "space travel"],
    keywordSlugs: ["dystopia", "space"],
    textHints: ["science-fiction", "futur", "espace", "spatial", "vaisseau", "robot", "intelligence artificielle", "dystopie", "extraterrestre", "cosmos", "cyber", "technologie", "clonage", "colonie", "galaxie", "post-apocalyptique"],
    siblings: ["mind_bending", "adventure", "fantasy"],
  },
  {
    id: "fantasy",
    label: "Fantasy",
    emoji: "🧙",
    genres: [GENRE.FANTASY],
    keywordLabels: ["magic", "fantasy world"],
    keywordSlugs: ["magic", "fantasy"],
    textHints: ["magie", "magique", "fantastique", "créature", "dragon", "sorcière", "sorcier", "royaume", "mythe", "légende", "épée", "prophétie", "monstre"],
    siblings: ["adventure", "scifi"],
  },
  {
    id: "adventure",
    label: "Aventure",
    emoji: "🗺️",
    genres: [GENRE.ADVENTURE, GENRE.ACTION, GENRE.FAMILY],
    keywordLabels: ["road trip", "quest"],
    keywordSlugs: ["adventure", "quest"],
    textHints: ["aventure", "voyage", "quête", "quete", "expédition", "trésor", "périple", "exploration", "route", "odyssée"],
    siblings: ["fantasy", "action"],
  },
  {
    id: "emotion",
    label: "Émotion",
    emoji: "😭",
    genres: [GENRE.DRAMA, GENRE.ROMANCE],
    keywordLabels: ["tearjerker"],
    keywordSlugs: ["emotional"],
    textHints: ["émouvant", "emouvant", "bouleversant", "touchant", "sensible", "larmes", "deuil", "souvenirs", "famille", "adieu", "intime"],
    siblings: ["drama", "romance"],
  },
  {
    id: "suspense",
    label: "Suspense",
    emoji: "😱",
    genres: [GENRE.THRILLER, GENRE.MYSTERY, GENRE.HORROR],
    keywordLabels: ["suspense", "serial killer"],
    keywordSlugs: ["suspense", "thriller"],
    textHints: ["suspense", "tension", "angoisse", "menace", "huis clos", "traque", "peur", "inquiétant", "danger", "piège"],
    siblings: ["mind_bending", "intense", "horror"],
  },
  {
    id: "horror",
    label: "Horreur",
    labelSeries: "Horreur",
    emoji: "🩸",
    genres: [GENRE.HORROR],
    keywordLabels: ["horror", "supernatural horror"],
    keywordSlugs: ["horror", "haunted"],
    textHints: ["horreur", "épouvante", "epouvante", "sang", "monstre", "démon", "demon", "possession", "macabre", "frisson", "terreur", "hanté", "cauchemar", "cadavre"],
    siblings: ["suspense"],
  },
  {
    id: "drama",
    label: "Drame",
    labelSeries: "Drame",
    emoji: "🎭",
    genres: [GENRE.DRAMA],
    keywordLabels: ["social drama"],
    keywordSlugs: ["drama"],
    textHints: ["drame", "tragédie", "destin", "portrait", "intime", "social", "deuil", "famille", "difficile", "combat"],
    siblings: ["emotion", "historical"],
  },
  {
    id: "family",
    label: "Familial",
    labelSeries: "Familial",
    emoji: "👨‍👩‍👧",
    genres: [GENRE.FAMILY, GENRE.ANIMATION, GENRE.ADVENTURE],
    keywordLabels: ["family", "animation"],
    keywordSlugs: ["family"],
    textHints: ["famille", "enfant", "enfants", "parents", "jeunesse", "conte", "grand-père", "grand-mère", "fratrie"],
    siblings: ["feel_good", "easy_watch"],
  },
  {
    id: "beautiful",
    label: "Beau visuellement",
    labelSeries: "Très belle visuellement",
    emoji: "🎨",
    genres: [GENRE.DRAMA, GENRE.ROMANCE, GENRE.FANTASY, GENRE.DOCUMENTARY],
    keywordLabels: ["beautiful", "cinematographic"],
    keywordSlugs: ["beautiful", "cinematography"],
    textHints: ["visuellement", "photographie", "somptueux", "sublime", "magnifique", "esthétique", "poétique", "onirique", "peinture", "lumière", "paysages", "couleurs", "superbe", "portrait", "nature", "stylisé"],
    siblings: [],
  },
  {
    id: "intense",
    label: "Intense",
    emoji: "🔥",
    genres: [GENRE.THRILLER, GENRE.ACTION, GENRE.DRAMA, GENRE.WAR],
    keywordLabels: ["gritty"],
    keywordSlugs: ["intense"],
    textHints: ["intense", "brutal", "violent", "éprouvant", "puissant", "tension", "guerre", "survival", "survie"],
    siblings: ["suspense", "action"],
  },
  {
    id: "historical",
    label: "Historique",
    emoji: "🏰",
    genres: [GENRE.HISTORY, GENRE.WAR, GENRE.DRAMA],
    keywordLabels: ["period drama", "historical"],
    keywordSlugs: ["historical", "period"],
    textHints: ["historique", "époque", "epoque", "guerre", "roi", "reine", "empire", "révolution", "siècle", "monarchie", "politique", "xixe", "xxe"],
    siblings: ["drama"],
  },
  {
    id: "detective",
    label: "Policier",
    emoji: "👮",
    genres: [GENRE.CRIME, GENRE.MYSTERY, GENRE.THRILLER],
    keywordLabels: ["police procedural"],
    keywordSlugs: ["police", "detective"],
    textHints: ["police", "policier", "inspecteur", "détective", "detective", "commissaire", "brigade", "criminelle", "meurtre", "trafic", "deal", "enquête"],
    siblings: ["investigation", "justice"],
  },
  {
    id: "justice",
    label: "Justice",
    emoji: "⚖️",
    genres: [GENRE.CRIME, GENRE.DRAMA],
    keywordLabels: ["courtroom"],
    keywordSlugs: ["courtroom", "lawyer"],
    textHints: ["justice", "tribunal", "avocat", "procès", "proces", "loi", "juge", "verdict", "accusé", "avocate"],
    siblings: ["detective", "workplace"],
  },
  {
    id: "medical",
    label: "Médical",
    emoji: "🏥",
    genres: [GENRE.DRAMA],
    keywordLabels: ["medical drama"],
    keywordSlugs: ["medical", "hospital"],
    textHints: ["hôpital", "hopital", "médecin", "medecin", "urgences", "médical", "medical", "chirurgie", "chirurgien", "soignants", "patients", "interne"],
    siblings: ["workplace"],
  },
  {
    id: "workplace",
    label: "Travail / quotidien",
    emoji: "🏢",
    genres: [GENRE.COMEDY, GENRE.DRAMA],
    keywordLabels: ["workplace"],
    keywordSlugs: ["workplace"],
    textHints: ["bureau", "entreprise", "travail", "collègues", "start-up", "professionnel", "quotidien", "carrière", "métier"],
    siblings: ["comfort", "justice"],
  },
];

/**
 * Moods exclusivement négatifs : ils n'ont pas de questionnaire et servent
 * seulement à pénaliser un candidat (« pas triste », « pas trop sombre »).
 */
const negativeMoods: MoodDefinition[] = [
  {
    id: "sad",
    label: "Triste / déprimant",
    emoji: "😞",
    genres: [GENRE.DRAMA],
    conflictGenres: [],
    keywordLabels: ["sad", "depressing"],
    keywordSlugs: ["sad", "depressing"],
    textHints: ["triste", "tristesse", "déprimant", "deprimant", "désespoir", "desespoir", "deuil", "mort", "mourir", "maladie", "solitude", "misère", "misere", "larmes", "tragique", "déchirant", "dechirant", "abandon"],
    siblings: [],
  },
  {
    id: "dark",
    label: "Sombre / glauque",
    emoji: "🌑",
    genres: [GENRE.HORROR, GENRE.CRIME, GENRE.WAR],
    keywordLabels: ["dark"],
    keywordSlugs: ["dark"],
    textHints: ["sombre", "noir", "obscur", "glauque", "morbide", "macabre", "violence", "sanglant", "brutal", "sinistre", "sordide"],
    siblings: [],
  },
  {
    id: "heavy",
    label: "Lourd / éprouvant",
    emoji: "🪨",
    genres: [GENRE.DRAMA, GENRE.WAR, GENRE.HISTORY],
    keywordLabels: ["gritty realism", "dark"],
    keywordSlugs: ["heavy"],
    textHints: ["éprouvant", "eprouvant", "bouleversant", "traumatisme", "lourd", "accablant", "déchirant", "dechirant", "drame familial", "souffrance", "horreur"],
    siblings: [],
  },
  {
    id: "romcom",
    label: "Comédie romantique",
    emoji: "💕",
    genres: [GENRE.ROMANCE, GENRE.COMEDY],
    keywordLabels: ["lighthearted romantic comedy"],
    keywordSlugs: ["romcom"],
    textHints: ["comédie romantique", "comedie romantique", "rom-com", "romcom"],
    siblings: [],
  },
  {
    id: "gore",
    label: "Gore",
    emoji: "🩸",
    genres: [GENRE.HORROR],
    keywordLabels: ["gore"],
    keywordSlugs: ["gore"],
    textHints: ["gore", "sanglant", "tripes", "démembrement", "démembre"],
    siblings: [],
  },
  {
    id: "childish",
    label: "Trop enfantin",
    emoji: "🧸",
    genres: [GENRE.ANIMATION, GENRE.FAMILY],
    keywordLabels: ["family", "animation"],
    keywordSlugs: ["kids"],
    textHints: ["dessin animé", "enfants", "conte pour enfants", "jeunesse"],
    siblings: [],
  },
];

export const MOOD_DEFINITIONS: Record<Mood, MoodDefinition> = Object.fromEntries(
  [...positiveMoods, ...negativeMoods].map((mood) => [mood.id, mood]),
) as Record<Mood, MoodDefinition>;

/**
 * Genres canoniques (espace « film ») déjà portés par un mood.
 *
 * Sert à éviter les doublons à l'AFFICHAGE : on ne montre pas « Un peu
 * d'amour » ET « Romance », ni « Science-fiction » ET « Science-Fiction ».
 * Le moteur, lui, garde les deux signaux : le mood pèse plus qu'un genre.
 */
export const MOOD_IMPLIED_GENRES: Partial<Record<Mood, number[]>> = {
  funny: [GENRE.COMEDY],
  romance: [GENRE.ROMANCE],
  scifi: [GENRE.SCIENCE_FICTION],
  fantasy: [GENRE.FANTASY],
  horror: [GENRE.HORROR],
  action: [GENRE.ACTION],
  family: [GENRE.FAMILY],
  mystery: [GENRE.MYSTERY],
  investigation: [GENRE.CRIME],
  detective: [GENRE.CRIME],
  emotion: [GENRE.DRAMA],
  historical: [GENRE.HISTORY],
  adventure: [GENRE.ADVENTURE],
};

/** Ce genre est-il déjà suggéré par l'un des moods demandés ? */
export function genreCoveredByMoods(genre: number, moods: Mood[]): boolean {
  return moods.some((mood) => (MOOD_IMPLIED_GENRES[mood] ?? []).includes(genre));
}

export const POSITIVE_MOOD_DEFINITIONS = positiveMoods;
export const NEGATIVE_MOOD_IDS: Mood[] = negativeMoods.map((mood) => mood.id);

export function moodDefinition(mood: Mood): MoodDefinition {
  return MOOD_DEFINITIONS[mood];
}

export function moodLabel(mood: Mood, mediaType: "movie" | "tv" = "movie"): string {
  const definition = MOOD_DEFINITIONS[mood];
  if (!definition) return mood;
  return mediaType === "tv" && definition.labelSeries ? definition.labelSeries : definition.label;
}
