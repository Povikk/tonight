"use client";

/**
 * Session TONIGHT (côté client).
 *
 * Rôle : conserver les critères en cours, la liste des propositions de la
 * session (« Un autre » ne repart jamais du questionnaire), l'état de
 * chargement et le mode de données (TMDB ou démo).
 *
 * Le moteur, lui, tourne côté serveur (/api/recommend) pour protéger le token
 * TMDB et garder la logique de scoring hors de l'UI.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import { buildChips, removeChip } from "@/naturalLanguage/chips";
import { pickNextOfferIndex } from "@/recommendation/nextOffer";
import { getFeedback, getSettings, recordRecommendation } from "@/storage";
import { computeTasteProfile } from "@/storage/tasteProfile";
import { apiErrorMessage, isRecommendApiResponse } from "@/utils/recommendResponse";
import { resolveSearchPreferences } from "./searchPreferences";
import type {
  MediaTypeChoice,
  PreferencesSource,
  RecommendResponse,
  ScoredCandidate,
  TonightSearchPreferences,
  UnderstoodChip,
} from "@/types/tonight";

export interface RunOptions {
  source?: PreferencesSource;
  seed?: number;
  /**
   * Œuvres à exclure en plus (clés `mediaType:id`).
   *
   * Sert à « trouver quelque chose de similaire » : sans exclure l'œuvre
   * affichée, elle revenait en tête : c'est elle qui correspond le mieux à ses
   * propres genres.
   */
  exclude?: string[];
  /**
   * Repartir d'une session vierge. UNIQUEMENT pour une nouvelle demande de
   * l'utilisateur (accueil, questionnaire, Express, YOLO) : « un autre » et
   * « similaire » doivent au contraire accumuler les exclusions (§42).
   */
  resetExcluded?: boolean;
}

interface TonightContextValue {
  /* État */
  query: string;
  preferences: TonightSearchPreferences;
  chips: UnderstoodChip[];
  offers: ScoredCandidate[];
  offerIndex: number;
  current: ScoredCandidate | null;
  response: RecommendResponse | null;
  sessionExcluded: string[];
  /** Indices du lot courant déjà affichés (le lot = « Mes idées pour ce soir »). */
  shownOffers: number[];
  loading: boolean;
  error: string | null;
  mode: "tmdb" | "demo" | null;
  hasResult: boolean;

  /* Actions */
  setQuery: (query: string) => void;
  setPreferences: (preferences: TonightSearchPreferences, chips?: UnderstoodChip[]) => void;
  removeCriterion: (chipId: string) => void;
  resetSession: () => void;
  runSearch: (preferences?: TonightSearchPreferences, options?: RunOptions) => Promise<void>;
  nextOffer: () => Promise<void>;
  goToOffer: (index: number) => void;
  /** Marque l'offre courante comme vue dans l'historique. */
  rememberCurrent: (status?: "accepted" | "watched" | "favorite" | "refused") => void;
}

const TonightContext = createContext<TonightContextValue | null>(null);

/** Contexte transmis au moteur : exclusions de session, feedback, profil de goûts. */
function buildEngineContext(sessionExcluded: string[]) {
  return {
    sessionExcluded,
    feedback: getFeedback(),
    profile: computeTasteProfile(),
    allowRelaxation: true,
  };
}

function offerKey(offer: ScoredCandidate): string {
  return `${offer.candidate.mediaType}:${offer.candidate.id}`;
}

export function TonightProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [preferences, setPreferencesState] = useState<TonightSearchPreferences>(() =>
    createEmptyPreferences("natural_language"),
  );
  const [chips, setChips] = useState<UnderstoodChip[]>([]);
  const [response, setResponse] = useState<RecommendResponse | null>(null);
  const [offerIndex, setOfferIndex] = useState(0);
  // Propositions du lot courant déjà passées à l'écran : « un autre » tire parmi
  // les autres, au hasard (voir `nextOffer`).
  const [shownOffers, setShownOffers] = useState<number[]>([0]);
  const [sessionExcluded, setSessionExcluded] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"tmdb" | "demo" | null>(null);
  /**
   * Identifiant de la recherche courante. Un double clic ou une réponse lente
   * ne doit jamais écraser un résultat plus récent : toute réponse dont
   * l'identifiant n'est plus courant est ignorée.
   */
  const searchIdRef = useRef(0);

  /* Mode de données (TMDB ou démo) : utile pour prévenir honnêtement. */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((res) => res.json())
      .then((payload: { mode?: "tmdb" | "demo" }) => {
        if (!cancelled && payload?.mode) setMode(payload.mode);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreferences = useCallback((next: TonightSearchPreferences, nextChips?: UnderstoodChip[]) => {
    setPreferencesState(next);
    setChips(nextChips ?? buildChips(next));
  }, []);

  const runSearch = useCallback(
    async (override?: TonightSearchPreferences, options: RunOptions = {}) => {
      const requestId = searchIdRef.current + 1;
      searchIdRef.current = requestId;

      const target = resolveSearchPreferences(preferences, override, options.source);
      setLoading(true);
      setError(null);

      // `override` est la nouvelle recherche de référence, pas seulement le
      // payload d'un appel isolé. Sans cette mise à jour, Express, YOLO et les
      // questionnaires affichaient un premier résultat correct, puis
      // « Affiner » / le lot suivant repartaient avec l'ancien parcours.
      setPreferencesState(target);

      // Exclusions CUMULÉES de la session : une recherche complémentaire ne doit
      // jamais remettre dans le jeu ce qui a déjà été proposé ou écarté.
      const excluded = [
        ...new Set([
          ...(options.resetExcluded ? [] : sessionExcluded),
          ...(options.exclude ?? []),
        ]),
      ];

      try {
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preferences: target,
            context: buildEngineContext(excluded),
            count: 8,
            seed: options.seed ?? Math.floor(Math.random() * 100_000),
          }),
        });
        const rawPayload: unknown = await res.json().catch(() => null);
        if (requestId !== searchIdRef.current) return;
        if (!isRecommendApiResponse(rawPayload)) {
          setError(
            apiErrorMessage(rawPayload) ??
              (res.status === 429
                ? "Tu as lancé beaucoup de recherches. Attends un instant puis réessaie."
                : "Tonight n'arrive pas à lire la réponse de son moteur. Réessaie dans un instant."),
          );
          setResponse(null);
          return;
        }

        const payload = rawPayload;
        setResponse(payload);
        setOfferIndex(0);
        setShownOffers([0]);
        if (payload.error) setError(payload.error);
        const nextExcluded = payload.top ? [...excluded, offerKey(payload.top)] : excluded;
        setSessionExcluded([...new Set(nextExcluded)]);
      } catch {
        if (requestId !== searchIdRef.current) return;
        setError("Tonight n'arrive pas à joindre son moteur. Vérifie ta connexion et réessaie.");
        setResponse(null);
      } finally {
        if (requestId === searchIdRef.current) setLoading(false);
      }
    },
    [preferences, sessionExcluded],
  );

  const offers = useMemo(() => {
    if (!response) return [];
    return response.top ? [response.top, ...response.alternatives] : [...response.alternatives];
  }, [response]);

  /**
   * « 🎲 UN AUTRE ».
   *
   * POURQUOI UN TIRAGE AU HASARD ET PAS L'INDEX SUIVANT
   * --------------------------------------------------
   * Avancer d'un cran revenait à dérouler la liste « Mes idées pour ce soir »
   * dans l'ordre : l'utilisateur voyait le carrousel défiler et n'avait plus
   * l'impression que TONIGHT tranchait. On tire donc au hasard parmi les
   * propositions du lot que l'on n'a PAS encore montrées, sans jamais revenir
   * sur la proposition courante. Toutes viennent de la même bande de pertinence
   * (§36), donc le tirage reste de qualité.
   */
  const nextOffer = useCallback(async () => {
    const pick = pickNextOfferIndex(offers.length, offerIndex, shownOffers);

    if (pick !== null) {
      // L'œuvre qu'on quitte est mémorisée : elle ne reviendra pas plus tard.
      setSessionExcluded((previous) => [...new Set([...previous, offerKey(offers[offerIndex])])]);
      setShownOffers((previous) => [...new Set([...previous, offerIndex, pick])]);
      setOfferIndex(pick);
      return;
    }

    // Tout le lot est passé à l'écran : on en demande un nouveau en excluant le
    // lot entier, puisque ses affiches étaient visibles dans « Mes idées pour ce
    // soir ». Les exclusions s'accumulent, donc pas de boucle sur les mêmes
    // titres (§42).
    await runSearch(preferences, {
      seed: Math.floor(Math.random() * 100_000),
      exclude: offers.map(offerKey),
    });
  }, [offerIndex, offers, preferences, runSearch, shownOffers]);

  const goToOffer = useCallback(
    (index: number) => {
      if (index >= 0 && index < offers.length) {
        setOfferIndex(index);
        setShownOffers((previous) => [...new Set([...previous, index])]);
      }
    },
    [offers.length],
  );

  const removeCriterion = useCallback(
    (chipId: string) => {
      const updated = removeChip(preferences, chipId);
      setPreferencesState(updated);
      setChips(buildChips(updated));
    },
    [preferences],
  );

  const resetSession = useCallback(() => {
    setResponse(null);
    setOfferIndex(0);
    setShownOffers([0]);
    setSessionExcluded([]);
    setError(null);
  }, []);

  const current = offers[offerIndex] ?? null;

  const rememberCurrent = useCallback(
    (status: "accepted" | "watched" | "favorite" | "refused" = "accepted") => {
      if (!current) return;
      const settings = getSettings();
      const candidate = current.candidate;
      recordRecommendation({
        key: offerKey(current),
        id: candidate.id,
        mediaType: candidate.mediaType,
        title: candidate.title,
        originalTitle: candidate.originalTitle,
        year: candidate.year,
        posterPath: candidate.posterPath,
        overview: candidate.overview,
        genres: candidate.genres,
        matchPercent: current.matchPercent,
        status,
        query: query || settings.lastQuery,
        runtime: candidate.runtime,
        seasons: candidate.seasons,
        popularity: candidate.popularity,
        providers: candidate.providers.map((provider) => provider.providerId),
        moods: preferences.moods,
      });
    },
    [current, preferences.moods, query],
  );

  const value: TonightContextValue = {
    query,
    preferences,
    chips,
    offers,
    offerIndex,
    current,
    response,
    sessionExcluded,
    shownOffers,
    loading,
    error,
    mode,
    hasResult: Boolean(current),
    setQuery,
    setPreferences,
    removeCriterion,
    resetSession,
    runSearch,
    nextOffer,
    goToOffer,
    rememberCurrent,
  };

  return <TonightContext.Provider value={value}>{children}</TonightContext.Provider>;
}

export function useTonight(): TonightContextValue {
  const context = useContext(TonightContext);
  if (!context) throw new Error("useTonight doit être utilisé dans <TonightProvider>.");
  return context;
}

export type { MediaTypeChoice };
