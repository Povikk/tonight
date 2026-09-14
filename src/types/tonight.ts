/**
 * Modèle de données interne de TONIGHT.
 *
 * RÈGLE D'ARCHITECTURE : toutes les méthodes de recherche (questionnaire Film,
 * questionnaire Série, Tonight Express, YOLO, langage naturel) produisent le
 * MÊME objet `TonightSearchPreferences`. Le moteur de recommandation ne sait
 * jamais d'où viennent les critères.
 */

export type MediaType = "movie" | "tv";

/** Catégorie de contenu telle que choisie par l'utilisateur (YOLO, hub). */
export type MediaTypeChoice = MediaType | "any";

/** Origine des critères : sert au debug, à l'affichage et aux statistiques. */
export type PreferencesSource = "natural_language" | "questionnaire" | "express" | "yolo";

/* -------------------------------------------------------------------------- */
/* Moods                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Un « mood » est une intention utilisateur (« je veux rire », « retourne-moi le
 * cerveau »). Il ne correspond JAMAIS à un seul genre TMDB : chaque mood est
 * mappé sur des genres + des keywords + des indices textuels (voir
 * `recommendation/moodScore.ts` et `naturalLanguage/dictionaries.ts`).
 */
export type Mood =
  // positifs
  | "funny"
  | "romance"
  | "feel_good"
  | "easy_watch"
  | "comfort"
  | "mystery"
  | "investigation"
  | "mind_bending"
  | "action"
  | "scifi"
  | "fantasy"
  | "adventure"
  | "emotion"
  | "suspense"
  | "horror"
  | "drama"
  | "family"
  | "beautiful"
  | "intense"
  | "historical"
  | "detective"
  | "justice"
  | "medical"
  | "workplace"
  // « moods » servant uniquement d'exclusions / pénalités
  | "sad"
  | "dark"
  | "heavy"
  | "romcom"
  | "gore"
  | "childish";

/** Moods proposés dans le questionnaire Film. */
export const MOVIE_MOODS: Mood[] = [
  "funny",
  "romance",
  "feel_good",
  "easy_watch",
  "mystery",
  "mind_bending",
  "action",
  "scifi",
  "fantasy",
  "adventure",
  "emotion",
  "suspense",
  "horror",
  "drama",
  "family",
  "beautiful",
  "intense",
];

/** Moods proposés dans le questionnaire Série (volontairement différents). */
export const SERIES_MOODS: Mood[] = [
  "funny",
  "romance",
  "feel_good",
  "comfort",
  "mystery",
  "investigation",
  "mind_bending",
  "action",
  "scifi",
  "fantasy",
  "emotion",
  "suspense",
  "horror",
  "historical",
  "drama",
  "detective",
  "justice",
  "medical",
  "workplace",
  "family",
  "beautiful",
];

/* -------------------------------------------------------------------------- */
/* Axes de préférence                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Niveau de découverte : « connu » vs « pépite ».
 * `mainstream` = incontournable, `safe` = valeur sûre, `hidden_gem` = pépite,
 * `obscure` = truc que personne ne connaît, `surprise` = surprends-moi.
 */
export type DiscoveryLevel = "mainstream" | "safe" | "hidden_gem" | "obscure" | "surprise";

/** Tolérance au risque sur la qualité perçue. */
export type QualityPreference = "risky" | "solid" | "very_solid" | "no_risk";

/** Statut souhaité pour une série. */
export type SeriesStatusPreference = "ended" | "ongoing_ok" | "any";

/** Engagement souhaité en nombre de saisons. */
export type SeriesCommitment = "mini" | "small" | "medium" | "long" | "any";

/** Type de diffusion accepté pour les plateformes. */
export type MonetizationType = "flatrate" | "free" | "ads" | "rent" | "buy";

/* -------------------------------------------------------------------------- */
/* Contraintes                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Identifiants des contraintes DURES (« moins de 2 heures »).
 * Un hard constraint ne sera JAMAIS cassé silencieusement : soit il est
 * respecté, soit l'utilisateur est prévenu (voir `relaxation`).
 */
export type HardConstraintId =
  | "mediaType"
  | "maxRuntime"
  | "minRuntime"
  | "minYear"
  | "maxYear"
  | "maxSeasons"
  | "minSeasons"
  | "seriesEnded"
  | "excludeGenres"
  | "requireGenre"
  | "providers"
  | "minRating"
  | "excludeAnimation"
  | "excludeDocumentary"
  | "excludeMusical"
  | "originalLanguage"
  | "originCountry";

/** Identifiants des préférences SOUPLES (« pas trop long ») : pondèrent le score. */
export type SoftPreferenceId =
  | "recent"
  | "old"
  | "shortRuntime"
  | "longRuntime"
  | "comfortableRuntime"
  | "wellRated"
  | "notHeavy"
  | "light"
  | "fewSeasons"
  | "shortEpisodes"
  | "hiddenGem"
  | "mainstream"
  | "beautiful"
  | "strongEnding"
  | "availableNow";

/* -------------------------------------------------------------------------- */
/* Préférences de recherche                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Objet unique produit par toutes les entrées de TONIGHT.
 * Les champs `null` signifient « pas d'avis ».
 */
export interface TonightSearchPreferences {
  mediaType: MediaTypeChoice;

  genres: number[];
  /** Genres pénalisés (« pas trop de romance »). */
  excludedGenres: number[];
  /** Genres réellement exclus (« pas d'horreur ») : contrainte dure. */
  hardExcludedGenres: number[];
  /** Combinaisons de genres pénalisées, ex. [Romance, Comédie] = comédie romantique. */
  excludedGenreCombos: Array<[number, number]>;

  moods: Mood[];
  excludedMoods: Mood[];

  minYear: number | null;
  maxYear: number | null;
  /** Bornes d'année SOUPLES : préférence, jamais bloquante (« pas trop vieux »). */
  softMinYear: number | null;
  softMaxYear: number | null;
  /** L'utilisateur veut-il plutôt du récent / plutôt de l'ancien ? */
  softRecent: boolean;
  softOld: boolean;

  /** Durée d'un film, en minutes. */
  minRuntime: number | null;
  maxRuntime: number | null;
  /** Bornes de durée SOUPLES (« pas trop long » → viser ~110 min). */
  softMinRuntime: number | null;
  softMaxRuntime: number | null;

  /** Durée visée d'un épisode de série, en minutes. */
  targetEpisodeRuntime: number | null;
  episodeRuntimeTolerance: number;

  minSeasons: number | null;
  maxSeasons: number | null;
  seriesStatus: SeriesStatusPreference | null;
  commitment: SeriesCommitment | null;

  discoveryLevel: DiscoveryLevel | null;
  qualityPreference: QualityPreference | null;

  /** Identifiants de plateformes TMDB (région FR). */
  providers: number[];
  /** Types de diffusion acceptés quand des plateformes sont sélectionnées. */
  monetizationTypes: MonetizationType[];

  minRating: number | null;
  originalLanguage: string | null;
  originCountry: string | null;

  excludeAnimation: boolean;
  excludeDocumentary: boolean;
  excludeMusical: boolean;

  hardConstraints: HardConstraintId[];
  softPreferences: SoftPreferenceId[];

  /** 0 → 1. Sous 0.55, TONIGHT pose UNE question avant de chercher. */
  confidence: number;

  source: PreferencesSource;
  rawQuery?: string;
}

/* -------------------------------------------------------------------------- */
/* Candidats et recommandations                                              */
/* -------------------------------------------------------------------------- */

export interface ProviderAvailability {
  providerId: number;
  name: string;
  logoPath: string | null;
  monetization: MonetizationType;
  /** Lien JustWatch/TMDB pour la région (obligation d'attribution). */
  link?: string | null;
}

/** Forme normalisée d'une œuvre, quelle que soit sa source (TMDB ou démo). */
export interface Candidate {
  id: number;
  mediaType: MediaType;

  title: string;
  originalTitle: string;
  year: number | null;
  endYear: number | null;

  /** Films uniquement. */
  runtime: number | null;
  /** Séries uniquement. */
  episodeRuntime: number | null;
  seasons: number | null;
  episodes: number | null;
  /** Statut TMDB brut : Ended, Returning Series, Canceled… */
  status: string | null;

  genres: number[];
  genreNames: string[];
  /** Slugs de keywords utiles au scoring des moods (voir moodScore). */
  keywordSlugs: string[];
  overview: string;

  voteAverage: number;
  voteCount: number;
  popularity: number;

  posterPath: string | null;
  backdropPath: string | null;

  originalLanguage: string;
  originCountry: string[];

  director: string | null;
  creators: string[];
  cast: string[];

  /** Disponibilités en France (peut être vide si non résolu). */
  providers: ProviderAvailability[];

  /**
   * Les champs « détaillés » (durée, saisons, statut, plateformes) sont-ils
   * AUTORITAIRES ?
   *
   * `discover` ne renvoie ni la durée d'un film, ni les saisons / le statut
   * d'une série : ces informations n'arrivent qu'avec l'enrichissement
   * (`/movie/{id}`, `/tv/{id}`). Un candidat non enrichi (`verified: false`)
   * laisse donc ces champs à `null`, et `null` ne veut PAS dire « pas de
   * contrainte violée ». Le moteur refuse alors de promettre à l'utilisateur
   * ce qu'il ne peut pas vérifier (voir `recommendation/filters.ts`).
   */
  verified: boolean;
}

/**
 * Bande-annonce retenue pour une œuvre.
 * On ne stocke que le strict nécessaire : le lecteur est construit dans l'UI.
 */
export interface TrailerInfo {
  /** Identifiant YouTube de la vidéo. */
  key: string;
  name: string;
  /** Langue d'origine de la bande-annonce (`fr`, `en`…) si TMDB la donne. */
  language: string | null;
  /** Vraie bande-annonce officielle, plutôt qu'un teaser ou un extrait. */
  official: boolean;
}

/** Détail complet (fiche film / fiche série). */
export interface CandidateDetails extends Candidate {
  tagline: string | null;
  genresDetailed: Array<{ id: number; name: string }>;
  countries: string[];
  spokenLanguages: string[];
  /** Bande-annonce à afficher, ou `null` si TMDB n'en fournit aucune. */
  trailer: TrailerInfo | null;
  /** Le flux TMDB correspondant, pour aller plus loin. */
  similar: Candidate[];
}

/** Une dimension du score, avec sa contribution et une raison lisible. */
export interface ScoreComponent {
  key:
    | "moodMatch"
    | "genreMatch"
    | "qualityScore"
    | "discoveryScore"
    | "runtimeMatch"
    | "providerMatch"
    | "eraMatch"
    | "personalTaste"
    | "feedbackPenalty";
  /** Contribution finale, entre 0 et 1. */
  value: number;
  weight: number;
  /** Phrase courte expliquant la contribution (« Tu voulais rire »). */
  reason?: string;
}

export interface ScoredCandidate {
  candidate: Candidate;
  /** Score final 0 → 1. */
  score: number;
  /** Score affiché : « 92 % MATCH ». */
  matchPercent: number;
  components: ScoreComponent[];
  /** Critères réellement responsables du score, en clair. */
  reasons: string[];
  /** Phrase d'explication générée sans IA externe. */
  explanation: string;
}

/** Trace d'un assouplissement de critère (jamais silencieux). */
export interface Relaxation {
  kind:
    | "providers"
    | "maxRuntime"
    | "minRuntime"
    | "years"
    | "maxSeasons"
    | "minSeasons"
    | "minRating"
    | "genres"
    | "seriesStatus"
    | "all";
  message: string;
}

export interface RecommendResponse {
  /** Recommandation principale. */
  top: ScoredCandidate | null;
  /** Alternatives classées (pour « Un autre »). */
  alternatives: ScoredCandidate[];
  /** Assouplissements appliqués pour trouver un résultat. */
  relaxations: Relaxation[];
  /** Toutes les contraintes ont-elles été lâchées ? */
  fullyRelaxed: boolean;
  /** Préférences effectivement utilisées (après assouplissement). */
  appliedPreferences: TonightSearchPreferences;
  /** Nombre de candidats analysés. */
  poolSize: number;
  /** Aucun résultat, même assoupli. */
  empty: boolean;
}

/* -------------------------------------------------------------------------- */
/* Profil de goûts et feedback (stockés localement, §44)                      */
/* -------------------------------------------------------------------------- */

/** Raisons de refus proposées après « Pas envie » (§43). */
export type RefusalReason =
  | "too_old"
  | "too_recent"
  | "too_long"
  | "too_serious"
  | "too_light"
  | "too_known"
  | "not_known_enough"
  | "wrong_mood"
  | "wrong_genre"
  | "already_seen"
  | "not_available";

export interface RefusalFeedback {
  candidateId: number;
  mediaType: MediaType;
  title: string;
  reasons: RefusalReason[];
  at: string;
}

/** Poids évolutifs calculés à partir de l'historique local (§44). */
export interface TasteProfile {
  /** Affinité par genre TMDB, de -1 (rejeté) à +1 (adoré). */
  genreWeights: Record<number, number>;
  /** Affinité par mood. */
  moodWeights: Partial<Record<Mood, number>>;
  /** Époque préférée détectée. */
  preferredEra: { min: number; max: number } | null;
  /** Durée moyenne des œuvres acceptées. */
  averageRuntime: number | null;
  /** Niveau de découverte dominant. */
  preferredDiscovery: DiscoveryLevel | null;
  /** Nombre de saisons préféré (séries). */
  preferredSeasons: number | null;
  /** Plateformes habituelles. */
  providerIds: number[];
  /** Identifiants « type:id » déjà vus / favoris / refusés. */
  watchedIds: string[];
  favoriteIds: string[];
  refusedIds: string[];
  /** Compteurs de refus par genre, pour « Tu refuses souvent… ». */
  refusedGenreCounts: Record<number, number>;
  /** Compteurs d'intérêt par genre, pour « Tonight pense que tu aimes… ». */
  likedGenreCounts: Record<number, number>;
  stats: { accepted: number; refused: number; watched: number; favorites: number };
}

/** Contexte transmis au moteur : exclusions de session + feedback + profil. */
export interface RecommendationContext {
  /** Œuvres déjà proposées dans la session : « Un autre » ne les remet pas. */
  sessionExcluded: string[];
  feedback: RefusalFeedback[];
  profile: TasteProfile | null;
  /** Autoriser l'assouplissement automatique des contraintes souples. */
  allowRelaxation: boolean;
}

/* -------------------------------------------------------------------------- */
/* Chips « J'ai compris »                                                     */
/* -------------------------------------------------------------------------- */

export interface UnderstoodChip {
  /** Clé stable permettant d'éditer/supprimer le critère. */
  id: string;
  emoji: string;
  label: string;
  /** Nature du critère : sert à l'édition et à l'affichage. */
  kind:
    | "mediaType"
    | "genre"
    | "excludedGenre"
    | "mood"
    | "excludedMood"
    | "era"
    | "runtime"
    | "episodeRuntime"
    | "seasons"
    | "status"
    | "discovery"
    | "quality"
    | "provider"
    | "rating"
    | "language"
    | "country"
    | "misc";
  tone: "positive" | "negative" | "neutral";
}

export interface ParsedRequest {
  preferences: TonightSearchPreferences;
  chips: UnderstoodChip[];
  /** TONIGHT doit-il poser UNE question (Film / Série / Choisis pour moi) ? */
  needsMediaTypeQuestion: boolean;
  /** Question à poser, si nécessaire. */
  question: string | null;
  /** Débogage : dimensions détectées. */
  matches: string[];
}
