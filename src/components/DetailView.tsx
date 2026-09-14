"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import { formatEpisodeRuntime, formatRating, formatRuntime, formatSeasons, formatSeriesYears, formatVoteCount, formatYear } from "@/utils/format";
import { seriesStatusLabel } from "@/utils/constants";
import { canonicalGenres } from "@/utils/canonical";
import { EXTERNAL_LINK_REL, allOffersUrl } from "@/utils/providers";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/utils/trailers";
import type { CandidateDetails } from "@/types/tonight";
import { BackdropImage, PosterImage } from "./PosterImage";
import { ProviderBadges, detailHref } from "./cards";
import { MediaActionBar } from "./MediaActionBar";
import { SectionTitle } from "./ui";
import { useTonight } from "./providers/TonightProvider";

/**
 * Bande-annonce (§49, §50).
 *
 * Le lecteur n'est PAS chargé au rendu de la page : un iframe YouTube coûte
 * cher et n'est utile qu'à la demande. On affiche d'abord un bouton, et
 * l'intégration ne se fait qu'au clic, via `youtube-nocookie`, pour ne pas
 * déposer de cookies de suivi sur une simple visite.
 */
function TrailerSection({ details }: { details: CandidateDetails }) {
  const [playing, setPlaying] = useState(false);
  const trailer = details.trailer;
  if (!trailer) return null;

  return (
    <section aria-labelledby="trailer">
      <SectionTitle id="trailer">Bande-annonce</SectionTitle>
      {playing ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-night-line bg-ink">
          <iframe
            src={youtubeEmbedUrl(trailer.key)}
            title={`Bande-annonce de ${details.title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 h-full w-full"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group relative block aspect-video w-full overflow-hidden rounded-2xl border border-night-line"
          aria-label={`Lire la bande-annonce de ${details.title}`}
        >
          <BackdropImage
            path={details.backdropPath}
            title={details.title}
            mediaType={details.mediaType}
            className="h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-90"
          />
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/50">
            <span
              aria-hidden
              className="flex h-16 w-16 items-center justify-center rounded-full border border-chalk/40 bg-ink/70 text-2xl text-chalk transition-transform group-hover:scale-110"
            >
              ▶
            </span>
            <span className="px-4 text-center text-sm font-medium text-chalk">
              {trailer.name}
              {trailer.language && trailer.language !== "fr" ? (
                <span className="text-muted-dim"> (VO)</span>
              ) : null}
            </span>
          </span>
        </button>
      )}
      <p className="mt-2 text-[0.7rem] text-muted-dim">
        Vidéo fournie par TMDB.{" "}
        <a
          href={youtubeWatchUrl(trailer.key)}
          target="_blank"
          rel={EXTERNAL_LINK_REL}
          className="underline decoration-dotted hover:text-chalk"
        >
          Ouvrir sur YouTube
        </a>
      </p>
    </section>
  );
}

/**
 * Fiche détaillée (§49, §50) : titre FR + titre original, métadonnées complètes,
 * casting, réalisateur/créateur, plateformes FR, et toutes les actions.
 */
export function DetailView({
  details,
  justRefused,
}: {
  details: CandidateDetails;
  /** L'utilisateur vient de marquer « pas intéressé » : on propose une alternative. */
  justRefused?: boolean;
}) {
  const router = useRouter();
  const { runSearch } = useTonight();
  const isMovie = details.mediaType === "movie";
  // Verrou anti double-clic : la recherche est signalée par le voile global
  // (SearchOverlay), on n'a donc pas besoin de remplacer la fiche.
  const [searching, setSearching] = useState(false);

  /**
   * « Quelque chose de similaire » (bouton de la fiche et des actions).
   *
   * L'œuvre affichée est explicitement EXCLUE : sans cela, elle remontait
   * elle-même en première position : c'est elle qui correspond le mieux à ses
   * propres genres. Les exclusions s'accumulent ensuite dans la session, donc
   * « un autre » ne repropose jamais ce qui a déjà été écarté.
   */
  const similar = async () => {
    if (searching) return;
    const preferences = createEmptyPreferences("yolo", {
      mediaType: details.mediaType,
      genres: canonicalGenres(details.genres).slice(0, 2),
      minYear: details.year ? details.year - 10 : null,
      maxYear: details.year ? details.year + 10 : null,
      confidence: 0.8,
    });
    setSearching(true);
    try {
      await runSearch(preferences, {
        source: "yolo",
        exclude: [`${details.mediaType}:${details.id}`],
      });
      router.push("/resultat");
    } finally {
      setSearching(false);
    }
  };

  return (
    <article className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 -z-10">
          <BackdropImage
            path={details.backdropPath}
            title={details.title}
            mediaType={details.mediaType}
            priority
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/40" />
        </div>

        <div className="flex flex-col gap-6 p-5 sm:p-8 md:flex-row md:items-end">
          <div className="w-36 shrink-0 overflow-hidden rounded-2xl border border-night-line/80 sm:w-48">
            <div className="relative aspect-2/3">
              <PosterImage
                path={details.posterPath}
                title={details.title}
                mediaType={details.mediaType}
                priority
                sizes="(max-width: 640px) 144px, 192px"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-chalk t-balance sm:text-4xl">
              {details.title}
            </h1>
            {details.originalTitle && details.originalTitle !== details.title ? (
              <p className="text-sm text-muted-dim">Titre original : {details.originalTitle}</p>
            ) : null}

            <p className="text-sm text-muted">
              {isMovie
                ? [formatYear(details.year), formatRuntime(details.runtime), details.genreNames.join(" · ")]
                    .filter(Boolean)
                    .join(" · ")
                : [
                    formatSeriesYears(details),
                    formatSeasons(details.seasons),
                    formatEpisodeRuntime(details.episodeRuntime),
                    details.status ? seriesStatusLabel(details.status) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>

            <p className="text-sm text-muted-dim">
              ⭐ {formatRating(details.voteAverage)} · {formatVoteCount(details.voteCount)}
              {details.countries.length ? ` · ${details.countries.join(", ")}` : ""}
            </p>

            <MediaActionBar candidate={details} onSimilar={() => void similar()} compact />
          </div>
        </div>
      </div>

      {justRefused ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          C'est noté : je ne te le reproposerai pas. Tu peux lancer une recherche pour avoir une
          alternative.
        </p>
      ) : null}

      {details.tagline ? (
        <p className="font-display text-lg italic text-chalk/80">« {details.tagline} »</p>
      ) : null}

      <section aria-labelledby="synopsis">
        <SectionTitle id="synopsis">Synopsis</SectionTitle>
        <p className="max-w-3xl leading-relaxed text-chalk/85">
          {details.overview || "Pas de synopsis disponible pour cette œuvre."}
        </p>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section aria-labelledby="credits">
          <SectionTitle id="credits">{isMovie ? "Réalisation" : "Création"}</SectionTitle>
          <ul className="space-y-1 text-sm text-muted">
            {isMovie && details.director ? <li className="text-chalk">{details.director}</li> : null}
            {!isMovie && details.creators.length
              ? details.creators.map((creator) => (
                  <li key={creator} className="text-chalk">
                    {creator}
                  </li>
                ))
              : null}
            {(!isMovie && !details.creators.length) || (isMovie && !details.director) ? (
              <li>Information non disponible.</li>
            ) : null}
          </ul>
        </section>

        <section aria-labelledby="cast">
          <SectionTitle id="cast">Casting principal</SectionTitle>
          <ul className="space-y-1 text-sm text-muted">
            {details.cast.length ? (
              details.cast.slice(0, 6).map((person) => <li key={person}>{person}</li>)
            ) : (
              <li>Casting non disponible.</li>
            )}
          </ul>
        </section>
      </div>

      <section aria-labelledby="platforms">
        <SectionTitle id="platforms" hint="Région France">
          Où le regarder
        </SectionTitle>
        {details.providers.length ? (
          <>
            <ProviderBadges
              providers={details.providers}
              limit={6}
              showMonetization
              title={details.title}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {allOffersUrl(details.providers) ? (
                <a
                  href={allOffersUrl(details.providers)!}
                  target="_blank"
                  rel={EXTERNAL_LINK_REL}
                  className="text-sm text-violet-soft underline decoration-dotted hover:text-chalk"
                >
                  Voir toutes les offres →
                </a>
              ) : null}
              <p className="text-[0.7rem] text-muted-dim">
                Disponibilités fournies par JustWatch via TMDB.
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-dim">
            Je n'ai pas l'info de disponibilité pour {isMovie ? "ce film" : "cette série"} en France.
          </p>
        )}
      </section>

      <TrailerSection details={details} />

      {details.similar.length ? (
        <section aria-labelledby="similar">
          <SectionTitle id="similar">Dans le même esprit</SectionTitle>
          <ul className="flex snap-x gap-3 overflow-x-auto pb-2">
            {details.similar.slice(0, 10).map((item) => (
              <li key={`${item.mediaType}:${item.id}`} className="snap-start">
                <a
                  href={detailHref(item)}
                  className="block w-32 rounded-2xl border border-night-line bg-night/50 p-2 transition-colors hover:border-violet/50"
                >
                  <span className="relative block aspect-2/3 w-full overflow-hidden rounded-xl">
                    <PosterImage
                      path={item.posterPath}
                      title={item.title}
                      mediaType={item.mediaType}
                      sizes="128px"
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="mt-2 line-clamp-2 block text-xs text-chalk">{item.title}</span>
                  <span className="text-[0.68rem] text-muted-dim">⭐ {formatRating(item.voteAverage)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
