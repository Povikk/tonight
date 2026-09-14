"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { canonicalGenres } from "@/utils/canonical";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import { mergeRefinementPreferences } from "@/naturalLanguage/mergeRefinement";
import { formatRating, formatRuntime, formatSeriesYears, formatVoteCount, formatEpisodeRuntime, formatSeasons } from "@/utils/format";
import { seriesStatusLabel } from "@/utils/constants";
import type { ParsedRequest, ScoredCandidate, TonightSearchPreferences } from "@/types/tonight";
import { BackdropImage, PosterImage } from "./PosterImage";
import { MatchBadge, ProviderBadges, detailHref } from "./cards";
import { MediaActionBar } from "./MediaActionBar";
import { RefusalSheet } from "./RefusalSheet";
import { TrailerDialog } from "./TrailerDialog";
import { Pill, TonightButton } from "./ui";
import { useTonight } from "./providers/TonightProvider";

/** Résumé du « pourquoi » : explication + dimensions réellement responsables. */
function WhySection({ offer, relaxations }: { offer: ScoredCandidate; relaxations: string[] }) {
  return (
    <section aria-labelledby="why-title" className="space-y-3">
      <h2 id="why-title" className="font-display text-lg font-semibold text-chalk">
        Pourquoi Tonight l'a choisi
      </h2>
      <p className="max-w-2xl text-[0.95rem] leading-relaxed text-chalk/90">{offer.explanation}</p>

      <ul className="flex flex-wrap gap-2">
        {offer.reasons.slice(0, 6).map((reason) => (
          <li key={reason}>
            <Pill tone="accent">{reason}</Pill>
          </li>
        ))}
      </ul>

      {relaxations.length ? (
        <div className="rounded-2xl border border-amber/30 bg-amber/5 px-4 py-3 text-sm text-amber">
          <strong className="font-semibold">J'ai assoupli un critère :</strong> {relaxations[0]}
        </div>
      ) : null}
    </section>
  );
}

/** Bandeau d'alternatives : on reste dans la même session, sans re-questionnaire. */
function AlternativesStrip({
  offers,
  activeIndex,
  shownOffers,
  onSelect,
}: {
  offers: ScoredCandidate[];
  activeIndex: number;
  /** Déjà passées à l'écran : on les estompe pour rendre le tirage lisible. */
  shownOffers: number[];
  onSelect: (index: number) => void;
}) {
  /**
   * Le tirage peut tomber sur une proposition sortie de l'écran : sans ce
   * recentrage, la surbrillance bougerait dans le vide et le côté aléatoire
   * resterait invisible.
   */
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeRef.current?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: reduced ? "auto" : "smooth",
    });
  }, [activeIndex]);

  if (offers.length <= 1) return null;
  return (
    <section aria-labelledby="alternatives-title" className="space-y-3">
      <h2 id="alternatives-title" className="text-sm uppercase tracking-[0.18em] text-muted-dim">
        Mes idées pour ce soir
      </h2>
      <ul className="flex snap-x gap-3 overflow-x-auto pb-2">
        {offers.slice(0, 8).map((offer, index) => (
          <li key={`${offer.candidate.mediaType}:${offer.candidate.id}`} className="snap-start">
            <button
              type="button"
              ref={index === activeIndex ? activeRef : undefined}
              onClick={() => onSelect(index)}
              aria-current={index === activeIndex ? "true" : undefined}
              className={`flex w-32 flex-col gap-2 rounded-2xl border p-2 text-left transition-all ${
                index === activeIndex
                  ? "border-violet/60 bg-violet/10"
                  : shownOffers.includes(index)
                    ? "border-night-line bg-night/30 opacity-70 hover:border-chalk/40 hover:opacity-100"
                    : "border-night-line bg-night/50 hover:border-chalk/40"
              }`}
            >
              <span className="relative block aspect-2/3 w-full overflow-hidden rounded-xl">
                <PosterImage
                  path={offer.candidate.posterPath}
                  title={offer.candidate.title}
                  mediaType={offer.candidate.mediaType}
                  sizes="128px"
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="line-clamp-2 text-xs font-medium text-chalk">{offer.candidate.title}</span>
              <span className="text-[0.68rem] text-muted-dim">{offer.matchPercent} % match</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Écran résultat (§38, §39) : l'écran le plus travaillé visuellement.
 * Backdrop plein cadre, dégradé sombre, typographie forte, UNE recommandation.
 */
export function ResultView() {
  const {
    current,
    offers,
    offerIndex,
    shownOffers,
    goToOffer,
    nextOffer,
    error,
    response,
    runSearch,
    preferences,
    setQuery,
    setPreferences,
    loading,
    rememberCurrent,
    resetSession,
  } = useTonight();

  const [refusalOpen, setRefusalOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [refinement, setRefinement] = useState("");
  const [refinementError, setRefinementError] = useState<string | null>(null);

  if (error && !current) {
    return (
      <div className="t-panel space-y-4 p-8 text-center">
        <p className="font-display text-xl text-chalk">Même Tonight sèche sur celle-là.</p>
        <p className="text-sm text-muted">{error}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <TonightButton onClick={() => runSearch(preferences, { resetExcluded: true })}>
            RÉESSAYER
          </TonightButton>
          <TonightButton variant="soft" href="/film">
            🎬 QUESTIONNAIRE FILM
          </TonightButton>
          <TonightButton variant="ghost" href="/serie">
            📺 QUESTIONNAIRE SÉRIE
          </TonightButton>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="t-panel space-y-4 p-8 text-center">
        <p className="font-display text-xl text-chalk">Je n'ai rien trouvé avec ces critères.</p>
        <p className="text-sm text-muted">
          C'est peut-être un peu trop précis. On assouplit et je te trouve quelque chose ?
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <TonightButton
            onClick={() => {
              const relaxed: TonightSearchPreferences = {
                ...createEmptyPreferences("natural_language", {
                  ...preferences,
                  minYear: null,
                  maxYear: null,
                  maxRuntime: null,
                  minRuntime: null,
                  maxSeasons: null,
                  minSeasons: null,
                  minRating: null,
                  providers: [],
                  monetizationTypes: [],
                  hardConstraints: [],
                }),
              };
              // On repart d'une liste d'exclusions vierge : si c'est
              // l'accumulation des propositions qui a vidé le catalogue, garder
              // ces exclusions rendrait l'assouplissement inutile.
              void runSearch(relaxed, { resetExcluded: true });
            }}
          >
            ASSOUPLIR MES CRITÈRES
          </TonightButton>
          <TonightButton variant="ghost" onClick={resetSession}>
            Repartir de zéro
          </TonightButton>
        </div>
      </div>
    );
  }

  const candidate = current.candidate;
  const isMovie = candidate.mediaType === "movie";
  const genres = canonicalGenres(candidate.genres);

  const similar = () => {
    const similarPrefs = createEmptyPreferences("yolo", {
      mediaType: candidate.mediaType,
      genres: genres.slice(0, 2),
      minYear: candidate.year ? candidate.year - 8 : null,
      maxYear: candidate.year ? candidate.year + 8 : null,
      softRecent: false,
      softOld: false,
      hardConstraints: [],
      softPreferences: [],
      confidence: 0.8,
    });
    // L'œuvre affichée est exclue explicitement : c'est elle qui correspond le
    // mieux à ses propres genres, donc sans cette exclusion elle revient en
    // tête avant toute autre proposition.
    setStarted(false);
    void runSearch(similarPrefs, {
      source: "yolo",
      exclude: [`${candidate.mediaType}:${candidate.id}`],
    });
  };

  const refine = async () => {
    const query = refinement.trim();
    if (!query) {
      setRefinementError("Écris juste ce que tu veux changer.");
      return;
    }

    setRefinementError(null);
    try {
      const parseResponse = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          forcedMediaType: preferences.mediaType,
          source: "yolo",
        }),
      });
      const parsed = (await parseResponse.json()) as ParsedRequest & { error?: string };
      if (!parseResponse.ok || parsed.error || !parsed.preferences) {
        throw new Error(parsed.error || "Demande illisible");
      }

      const refinedPreferences = mergeRefinementPreferences(preferences, parsed.preferences);
      setQuery(query);
      setPreferences(refinedPreferences);
      setStarted(false);
      setRefinement("");
      await runSearch(refinedPreferences, {
        source: "yolo",
        exclude: offers.map((offer) => `${offer.candidate.mediaType}:${offer.candidate.id}`),
      });
    } catch {
      setRefinementError("Je n'ai pas compris cet affinage. Essaie une phrase plus simple.");
    }
  };

  return (
    <article className="space-y-8">
      {/* --- Bloc visuel principal --- */}
      <div className="relative -mx-4 overflow-hidden rounded-none sm:mx-0 sm:rounded-3xl">
        <div className="absolute inset-0 -z-10">
          <div className="animate-drift h-full w-full">
            <BackdropImage
              path={candidate.backdropPath}
              title={candidate.title}
              mediaType={candidate.mediaType}
              priority
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/80 to-ink/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/40 to-transparent" />
        </div>

        {/*
          `lg:items-start` (et non `items-end`) : la colonne de texte grandit
          vers le BAS quand on déplie les plateformes, sans déplacer l'affiche
          ni le bloc d'actions situé au-dessus.
        */}
        <div className="flex flex-col gap-6 p-5 pt-10 sm:p-8 lg:flex-row lg:items-start">
          <div className="w-40 shrink-0 overflow-hidden rounded-2xl border border-night-line/80 shadow-2xl sm:w-52">
            <div className="relative aspect-2/3">
              <PosterImage
                path={candidate.posterPath}
                title={candidate.title}
                mediaType={candidate.mediaType}
                priority
                sizes="(max-width: 640px) 160px, 208px"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {/*
            Colonne d'informations.

            STABILITÉ DE LA BARRE D'ACTIONS
            -------------------------------
            L'ordre des blocs est choisi pour que les boutons ne bougent JAMAIS,
            afin de pouvoir enchaîner « 🎲 UN AUTRE » sans que le bouton se
            dérobe sous le curseur.

            1. Le contenu AU-DESSUS des boutons a une hauteur réservée : titre
               sur deux lignes, ligne d'infos, synopsis sur quatre lignes (avec
               un texte de repli quand TMDB n'en fournit pas).
            2. Les plateformes sont placées APRÈS les boutons : cette ligne est
               le plus gros facteur de variation (une à trois lignes selon le
               titre et les offres), et tout ce qui est en dessous peut grandir
               sans rien déplacer au-dessus. C'est aussi ce qui permet au
               « +N autres » de se déplier en place.
          */}
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-violet-soft">
              {isMovie ? "Tonight, tu regardes…" : "Tonight, tu commences…"}
            </p>
            {/* Deux lignes réservées : un titre court ne doit pas remonter les boutons. */}
            <h1 className="min-h-[2.5em] font-display text-3xl font-extrabold leading-tight tracking-tight text-chalk t-balance sm:text-5xl">
              {candidate.title}
            </h1>
            <p className="min-h-[1.25rem] text-sm text-muted">
              {isMovie ? candidate.year ?? "Année inconnue" : formatSeriesYears(candidate)}
              {isMovie
                ? candidate.runtime
                  ? ` · ${formatRuntime(candidate.runtime)}`
                  : ""
                : ` · ${formatSeasons(candidate.seasons) ?? "saisons inconnues"}${
                    candidate.status ? ` · ${seriesStatusLabel(candidate.status)}` : ""
                  }`}
              {candidate.genreNames.length ? ` · ${candidate.genreNames.slice(0, 3).join(" · ")}` : ""}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <MatchBadge percent={current.matchPercent} size="lg" />
              <span className="text-sm text-muted">
                ⭐ {formatRating(candidate.voteAverage)} · {formatVoteCount(candidate.voteCount)}
              </span>
              {!isMovie && candidate.episodeRuntime ? (
                <span className="text-sm text-muted-dim">{formatEpisodeRuntime(candidate.episodeRuntime)}</span>
              ) : null}
            </div>

            {/* Quatre lignes réservées, même sans synopsis : c'est ce bloc qui
                faisait le plus bouger l'écran. */}
            <p className="max-w-2xl min-h-[5.75rem] text-sm leading-relaxed text-chalk/80 line-clamp-4">
              {candidate.overview || "Pas encore de synopsis pour ce titre."}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <TonightButton
                size="lg"
                onClick={() => {
                  rememberCurrent("accepted");
                  setStarted(true);
                }}
              >
                ▶ ÇA PART !
              </TonightButton>
              <TonightButton
                size="lg"
                variant="soft"
                onClick={() => {
                  setStarted(false);
                  void nextOffer();
                }}
              >
                🎲 UN AUTRE
              </TonightButton>
              {/* ❤️ Favori / 👁️ Déjà vu (§41) : les mêmes actions que sur la fiche. */}
              <MediaActionBar candidate={candidate} inline />
              <TonightButton variant="ghost" onClick={() => setRefusalOpen(true)}>
                🚫 PAS ENVIE
              </TonightButton>
            </div>

            {/* Sous les boutons : peut grandir (dépliage du « +N ») sans rien
                déplacer au-dessus. */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-dim">
                Où le regarder
              </span>
              {candidate.providers.length ? (
                <ProviderBadges providers={candidate.providers} showMonetization title={candidate.title} />
              ) : (
                <span className="text-[0.68rem] text-muted-dim">
                  rien de connu en France pour l'instant
                </span>
              )}
            </div>

            {/* Emplacement réservé : afficher la confirmation ne doit rien décaler. */}
            <div className="min-h-[1.25rem]">
              {started ? (
                <p className="animate-fade-in text-sm text-good">
                  Bon visionnage. C'est noté dans ton historique, dis-moi si tu as aimé.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* --- Actions secondaires --- */}
      <div className="flex flex-wrap items-center gap-3">
        <TrailerDialog id={candidate.id} mediaType={candidate.mediaType} title={candidate.title} />
        <Link
          href={detailHref(candidate)}
          className="rounded-full border border-night-line px-4 py-2 text-sm text-muted transition-colors hover:text-chalk"
        >
          Voir la fiche complète →
        </Link>
        <button
          type="button"
          onClick={similar}
          className="rounded-full border border-night-line px-4 py-2 text-sm text-muted transition-colors hover:text-chalk"
        >
          🎲 Trouver quelque chose de similaire
        </button>
      </div>

      {preferences.source === "yolo" ? (
        <section aria-labelledby="refine-title" className="t-panel space-y-3 p-4 sm:p-5">
          <div className="space-y-1">
            <h2 id="refine-title" className="font-display text-base font-semibold text-chalk">
              Pas tout à fait ? Affine le choix.
            </h2>
            <p className="text-xs text-muted-dim">
              Par exemple : « plus récent », « qui fait moins peur » ou « moins de 2 heures ».
            </p>
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void refine();
            }}
          >
            <label htmlFor="yolo-refinement" className="sr-only">
              Affiner la recommandation
            </label>
            <input
              id="yolo-refinement"
              type="text"
              value={refinement}
              onChange={(event) => setRefinement(event.target.value)}
              placeholder="Je voudrais quelque chose de…"
              maxLength={600}
              disabled={loading}
              className="min-w-0 flex-1 rounded-full border border-night-line bg-night/70 px-4 py-2.5 text-sm text-chalk placeholder:text-muted-dim focus:border-violet/60 focus:outline-none"
            />
            <TonightButton type="submit" disabled={loading || !refinement.trim()}>
              {loading ? "J'AFFINE…" : "AFFINER"}
            </TonightButton>
          </form>
          {refinementError ? (
            <p role="alert" className="text-xs text-danger">{refinementError}</p>
          ) : null}
        </section>
      ) : null}

      <WhySection offer={current} relaxations={response?.relaxations.map((item) => item.message) ?? []} />

      <AlternativesStrip
        offers={offers}
        activeIndex={offerIndex}
        shownOffers={shownOffers}
        onSelect={goToOffer}
      />

      <p className="text-[0.7rem] text-muted-dim">
        Données de disponibilité fournies par JustWatch via TMDB, pour la région France.
      </p>

      <RefusalSheet
        offer={current}
        open={refusalOpen}
        onClose={() => setRefusalOpen(false)}
        onRefused={() => {
          setRefusalOpen(false);
          setStarted(false);
          void nextOffer();
        }}
      />
    </article>
  );
}
