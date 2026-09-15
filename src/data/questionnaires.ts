/**
 * Questionnaires guidés (§16 → §31).
 *
 * Chaque option n'est qu'un PATCH appliqué à `TonightSearchPreferences` :
 * aucune logique métier ici, uniquement des données. C'est ce qui garantit que
 * le questionnaire produit exactement le même objet interne que le parser.
 */

import { MOVIE_MOODS, SERIES_MOODS, type MediaType, type Mood, type TonightSearchPreferences } from "@/types/tonight";

export type QuestionKind = "single" | "multi" | "providers" | "advanced";

export interface QuestionOption {
  id: string;
  emoji?: string;
  /** Libellé explicite. Optionnel pour les options de mood (libellé déduit). */
  label?: string;
  hint?: string;
  /** Patch appliqué aux préférences. */
  patch?: Partial<TonightSearchPreferences>;
  /** Mood basculé par cette option (questions multi). */
  mood?: Mood;
  /** Option secondaire, affichée derrière « Plus précis ». */
  advanced?: boolean;
}

export interface Question {
  id: string;
  question: string;
  subtitle?: string;
  kind: QuestionKind;
  /** L'utilisateur peut-il passer la question (🤷 Je sais pas) ? */
  allowSkip?: boolean;
  options?: QuestionOption[];
  /** Label du bouton « je ne sais pas ». */
  skipLabel?: string;
}

export interface Questionnaire {
  mediaType: MediaType;
  title: string;
  intro: string;
  steps: Question[];
}

const CLEAR_YEARS: Partial<TonightSearchPreferences> = {
  minYear: null,
  maxYear: null,
  softRecent: false,
  softOld: false,
  softMinYear: null,
  softMaxYear: null,
  hardConstraints: [],
};

function stripHard(preferences: TonightSearchPreferences, constraints: string[]): string[] {
  return preferences.hardConstraints.filter((item) => !constraints.includes(item));
}

/* -------------------------------------------------------------------------- */
/* FILM                                                                       */
/* -------------------------------------------------------------------------- */

export const MOVIE_QUESTIONNAIRE: Questionnaire = {
  mediaType: "movie",
  title: "Ton film de ce soir",
  intro: "Six questions, trente secondes. Promis, on ne te demande pas de choisir dans une liste de 47 films.",
  steps: [
    {
      id: "era",
      question: "Tu veux voyager à quelle époque ?",
      kind: "single",
      allowSkip: true,
      skipLabel: "🎲 Peu importe",
      options: [
        {
          id: "very_recent",
          emoji: "🔥",
          label: "TRÈS RÉCENT",
          hint: "2020 à aujourd'hui",
          patch: { ...CLEAR_YEARS, minYear: 2020, hardConstraints: ["minYear"] },
        },
        {
          id: "modern",
          emoji: "📱",
          label: "MODERNE",
          hint: "2000-2019",
          patch: { ...CLEAR_YEARS, minYear: 2000, maxYear: 2019, hardConstraints: ["minYear", "maxYear"] },
        },
        {
          id: "eighties_nineties",
          emoji: "📼",
          label: "ANNÉES 80-90",
          hint: "1980-1999",
          patch: { ...CLEAR_YEARS, minYear: 1980, maxYear: 1999, hardConstraints: ["minYear", "maxYear"] },
        },
        {
          id: "classic",
          emoji: "🎞️",
          label: "CLASSIQUE",
          hint: "avant 1980",
          patch: { ...CLEAR_YEARS, maxYear: 1979, hardConstraints: ["maxYear"] },
        },
        {
          id: "decade_2020",
          emoji: "📅",
          label: "2020s",
          advanced: true,
          patch: { ...CLEAR_YEARS, minYear: 2020, maxYear: 2029, hardConstraints: ["minYear", "maxYear"] },
        },
        {
          id: "decade_2010",
          emoji: "📅",
          label: "2010s",
          advanced: true,
          patch: { ...CLEAR_YEARS, minYear: 2010, maxYear: 2019, hardConstraints: ["minYear", "maxYear"] },
        },
        {
          id: "decade_2000",
          emoji: "📅",
          label: "2000s",
          advanced: true,
          patch: { ...CLEAR_YEARS, minYear: 2000, maxYear: 2009, hardConstraints: ["minYear", "maxYear"] },
        },
        {
          id: "decade_1990",
          emoji: "📅",
          label: "1990s",
          advanced: true,
          patch: { ...CLEAR_YEARS, minYear: 1990, maxYear: 1999, hardConstraints: ["minYear", "maxYear"] },
        },
        {
          id: "decade_1980",
          emoji: "📅",
          label: "1980s",
          advanced: true,
          patch: { ...CLEAR_YEARS, minYear: 1980, maxYear: 1989, hardConstraints: ["minYear", "maxYear"] },
        },
        {
          id: "decade_1970",
          emoji: "📅",
          label: "1970s",
          advanced: true,
          patch: { ...CLEAR_YEARS, minYear: 1970, maxYear: 1979, hardConstraints: ["minYear", "maxYear"] },
        },
        {
          id: "decade_1960",
          emoji: "📅",
          label: "1960s",
          advanced: true,
          patch: { ...CLEAR_YEARS, minYear: 1960, maxYear: 1969, hardConstraints: ["minYear", "maxYear"] },
        },
        {
          id: "decade_before",
          emoji: "📅",
          label: "avant 1960",
          advanced: true,
          patch: { ...CLEAR_YEARS, maxYear: 1959, hardConstraints: ["maxYear"] },
        },
      ],
    },
    {
      id: "runtime",
      question: "Combien de temps tu as ?",
      kind: "single",
      allowSkip: true,
      skipLabel: "🎲 Peu importe",
      options: [
        {
          id: "express",
          emoji: "⚡",
          label: "EXPRESS",
          hint: "moins de 1h30",
          patch: { maxRuntime: 90, softMaxRuntime: null, minRuntime: null, hardConstraints: ["maxRuntime"], softPreferences: [] },
        },
        {
          id: "calm",
          emoji: "🍿",
          label: "TRANQUILLE",
          hint: "moins de 2 heures",
          patch: { maxRuntime: 120, softMaxRuntime: null, minRuntime: null, hardConstraints: ["maxRuntime"], softPreferences: [] },
        },
        {
          id: "plenty",
          emoji: "🎬",
          label: "J'AI LE TEMPS",
          hint: "jusqu'à environ 2h30",
          patch: { maxRuntime: 150, softMaxRuntime: null, minRuntime: null, hardConstraints: ["maxRuntime"], softPreferences: [] },
        },
        {
          id: "none",
          emoji: "🏛️",
          label: "AUCUNE LIMITE",
          hint: "même très long, si c'est bon",
          patch: { maxRuntime: null, minRuntime: null, softMaxRuntime: null, softMinRuntime: null, hardConstraints: [], softPreferences: [] },
        },
      ],
    },
    {
      id: "mood",
      question: "T'es dans quel mood ?",
      subtitle: "Tu peux en choisir plusieurs.",
      kind: "multi",
      allowSkip: true,
      skipLabel: "🎲 Peu importe",
      options: MOVIE_MOODS.map((mood) => ({ id: mood, mood })),
    },
    {
      id: "discovery",
      question: "Tu veux quelque chose de connu ?",
      kind: "single",
      allowSkip: true,
      skipLabel: "🎲 Surprends-moi",
      options: [
        {
          id: "mainstream",
          emoji: "🏆",
          label: "INCONTOURNABLE",
          hint: "Films très connus et très appréciés",
          patch: { discoveryLevel: "mainstream", softPreferences: ["mainstream"] },
        },
        {
          id: "safe",
          emoji: "⭐",
          label: "VALEUR SÛRE",
          hint: "Bien notés, avec une bonne confiance statistique",
          patch: { discoveryLevel: "safe", softPreferences: ["mainstream"] },
        },
        {
          id: "hidden_gem",
          emoji: "💎",
          label: "PÉPITE",
          hint: "Très appréciés mais moins populaires",
          patch: { discoveryLevel: "hidden_gem", softPreferences: ["hiddenGem"] },
        },
        {
          id: "obscure",
          emoji: "🕳️",
          label: "TRUC QUE PERSONNE NE CONNAÎT",
          hint: "Peu populaires, mais assez d'avis pour être crédibles",
          patch: { discoveryLevel: "obscure", softPreferences: ["hiddenGem"] },
        },
        {
          id: "surprise",
          emoji: "🎲",
          label: "SURPRENDS-MOI",
          hint: "Un peu de hasard, mais jamais de navet",
          patch: { discoveryLevel: "surprise" },
        },
      ],
    },
    {
      id: "quality",
      question: "À quel point tu veux jouer la sécurité ?",
      subtitle: "Question facultative.",
      kind: "single",
      allowSkip: true,
      skipLabel: "🤷 Je sais pas",
      options: [
        {
          id: "risky",
          emoji: "😈",
          label: "JE PRENDS DES RISQUES",
          hint: "Ça peut être bizarre, tant pis",
          patch: { qualityPreference: "risky" },
        },
        { id: "solid", emoji: "🙂", label: "UN BON FILM", hint: "Un bon film, tout simplement", patch: { qualityPreference: "solid" } },
        {
          id: "very_solid",
          emoji: "⭐",
          label: "DU TRÈS SOLIDE",
          hint: "Bien noté, valeur sûre",
          patch: { qualityPreference: "very_solid", softPreferences: ["wellRated"] },
        },
        {
          id: "no_risk",
          emoji: "🏆",
          label: "JE NE VEUX PAS ME LOUPER",
          hint: "Ce soir, je ne prends aucun risque",
          patch: { qualityPreference: "no_risk", softPreferences: ["wellRated"], minRating: 7 },
        },
      ],
    },
    {
      id: "providers",
      question: "Où peux-tu regarder ?",
      subtitle: "Région France. On retient tes plateformes pour la prochaine fois.",
      kind: "providers",
      allowSkip: true,
      skipLabel: "🌍 Peu importe",
    },
    {
      id: "advanced",
      question: "Plus de critères",
      subtitle: "Tout est optionnel ici. Si tu ne touches à rien, on garde ce qui précède.",
      kind: "advanced",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* SÉRIE                                                                      */
/* -------------------------------------------------------------------------- */

export const SERIES_QUESTIONNAIRE: Questionnaire = {
  mediaType: "tv",
  title: "Ta série de ce soir",
  intro: "Un parcours différent des films : ici, c'est l'engagement qui compte.",
  steps: [
    {
      id: "commitment",
      question: "Tu veux partir pour combien de temps ?",
      kind: "single",
      allowSkip: true,
      skipLabel: "♾️ Peu importe",
      options: [
        {
          id: "mini",
          emoji: "⚡",
          label: "MINI-SÉRIE",
          hint: "une seule saison, une vraie fin",
          patch: {
            commitment: "mini",
            maxSeasons: 1,
            seriesStatus: "ended",
            hardConstraints: ["maxSeasons", "seriesEnded"],
            softPreferences: ["fewSeasons", "strongEnding"],
          },
        },
        {
          id: "small",
          emoji: "📺",
          label: "PETITE SÉRIE",
          hint: "1 à 2 saisons",
          patch: {
            commitment: "small",
            minSeasons: 1,
            maxSeasons: 2,
            hardConstraints: ["maxSeasons"],
            softPreferences: ["fewSeasons"],
          },
        },
        {
          id: "medium",
          emoji: "🍿",
          label: "QUELQUES SAISONS",
          hint: "3 à 5 saisons environ",
          patch: {
            commitment: "medium",
            minSeasons: 3,
            maxSeasons: 5,
            hardConstraints: ["minSeasons", "maxSeasons"],
          },
        },
        {
          id: "long",
          emoji: "🏠",
          label: "JE VEUX M'INSTALLER",
          hint: "une longue série, tant mieux",
          patch: {
            commitment: "long",
            minSeasons: 4,
            hardConstraints: ["minSeasons"],
          },
        },
      ],
    },
    {
      id: "episodeRuntime",
      question: "Combien de temps par épisode ?",
      kind: "single",
      allowSkip: true,
      skipLabel: "♾️ Peu importe",
      options: [
        { id: "20", emoji: "⚡", label: "ENVIRON 20 MIN", patch: { targetEpisodeRuntime: 22, episodeRuntimeTolerance: 8 } },
        { id: "30", emoji: "🍿", label: "ENVIRON 30-45 MIN", patch: { targetEpisodeRuntime: 38, episodeRuntimeTolerance: 12 } },
        { id: "50", emoji: "🎬", label: "ENVIRON 45-60 MIN", patch: { targetEpisodeRuntime: 52, episodeRuntimeTolerance: 12 } },
        {
          id: "60plus",
          emoji: "🛋️",
          label: "PLUS D'UNE HEURE, ÇA ME VA",
          patch: { targetEpisodeRuntime: 62, episodeRuntimeTolerance: 20 },
        },
      ],
    },
    {
      id: "status",
      question: "Tu veux une série terminée ?",
      kind: "single",
      allowSkip: true,
      skipLabel: "🤷 Peu importe",
      options: [
        {
          id: "ended",
          emoji: "✅",
          label: "TERMINÉE",
          hint: "je veux pouvoir tout voir",
          patch: { seriesStatus: "ended", hardConstraints: ["seriesEnded"], softPreferences: ["strongEnding"] },
        },
        {
          id: "ongoing",
          emoji: "🔴",
          label: "EN COURS ACCEPTÉE",
          hint: "pas grave si ça continue",
          patch: { seriesStatus: "ongoing_ok" },
        },
        { id: "any", emoji: "🤷", label: "PEU IMPORTE", patch: { seriesStatus: "any" } },
      ],
    },
    {
      id: "era",
      question: "Une époque de prédilection ?",
      kind: "single",
      allowSkip: true,
      skipLabel: "🎲 Peu importe",
      options: [
        { id: "very_recent", emoji: "🔥", label: "TRÈS RÉCENTE", hint: "2020+", patch: { ...CLEAR_YEARS, minYear: 2020, hardConstraints: ["minYear"] } },
        {
          id: "modern",
          emoji: "📱",
          label: "MODERNE",
          hint: "2010-2019",
          patch: { ...CLEAR_YEARS, minYear: 2010, maxYear: 2019, hardConstraints: ["minYear", "maxYear"] },
        },
        {
          id: "y2000",
          emoji: "💿",
          label: "ANNÉES 2000",
          patch: { ...CLEAR_YEARS, minYear: 2000, maxYear: 2009, hardConstraints: ["minYear", "maxYear"] },
        },
        {
          id: "eighties_nineties",
          emoji: "📼",
          label: "ANNÉES 80-90",
          patch: { ...CLEAR_YEARS, minYear: 1980, maxYear: 1999, hardConstraints: ["minYear", "maxYear"] },
        },
        { id: "classic", emoji: "🎞️", label: "CLASSIQUE", hint: "avant 1980", patch: { ...CLEAR_YEARS, maxYear: 1979, hardConstraints: ["maxYear"] } },
      ],
    },
    {
      id: "mood",
      question: "T'es dans quel mood ?",
      subtitle: "Plusieurs choix possibles.",
      kind: "multi",
      allowSkip: true,
      skipLabel: "🎲 Peu importe",
      options: SERIES_MOODS.map((mood) => ({ id: mood, mood })),
    },
    {
      id: "discovery",
      question: "Une série connue ou une découverte ?",
      kind: "single",
      allowSkip: true,
      skipLabel: "🎲 Surprends-moi",
      options: [
        { id: "mainstream", emoji: "🏆", label: "INCONTOURNABLE", hint: "tout le monde en parle", patch: { discoveryLevel: "mainstream", softPreferences: ["mainstream"] } },
        { id: "safe", emoji: "⭐", label: "VALEUR SÛRE", hint: "bien notée, fiable", patch: { discoveryLevel: "safe", softPreferences: ["mainstream"] } },
        { id: "hidden_gem", emoji: "💎", label: "PÉPITE", hint: "excellente mais moins vue", patch: { discoveryLevel: "hidden_gem", softPreferences: ["hiddenGem"] } },
        { id: "obscure", emoji: "🕳️", label: "PEU CONNUE", hint: "personne ne t'en a parlé", patch: { discoveryLevel: "obscure", softPreferences: ["hiddenGem"] } },
        { id: "surprise", emoji: "🎲", label: "SURPRENDS-MOI", patch: { discoveryLevel: "surprise" } },
      ],
    },
    {
      id: "providers",
      question: "Où peux-tu regarder ?",
      subtitle: "Région France. On retient tes plateformes pour la prochaine fois.",
      kind: "providers",
      allowSkip: true,
      skipLabel: "🌍 Peu importe",
    },
    {
      id: "advanced",
      question: "Plus de critères",
      subtitle: "Tout est optionnel ici.",
      kind: "advanced",
    },
  ],
};

export function questionnaireFor(mediaType: MediaType): Questionnaire {
  return mediaType === "movie" ? MOVIE_QUESTIONNAIRE : SERIES_QUESTIONNAIRE;
}

export { stripHard };
