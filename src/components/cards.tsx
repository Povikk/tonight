"use client";

import Link from "next/link";
import { useState } from "react";
import type { Candidate, ProviderAvailability, ScoredCandidate } from "@/types/tonight";
import { formatRating, formatSeriesYears, formatYear } from "@/utils/format";
import { EXTERNAL_LINK_REL, providerWatchUrl } from "@/utils/providers";
import { PosterImage } from "./PosterImage";
import { monetizationLabel } from "@/recommendation/providerScore";

/** Badge « 92 % MATCH ». */
export function MatchBadge({ percent, size = "md" }: { percent: number; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "text-xs px-2.5 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-lg px-4 py-2",
  } as const;
  const tone = percent >= 85 ? "border-good/40 text-good" : percent >= 70 ? "border-violet/50 text-violet-soft" : "border-night-line text-muted";
  return (
    <span className={`inline-flex items-center rounded-full border bg-ink/60 font-semibold tracking-tight ${tone} ${sizes[size]}`}>
      {percent} % MATCH
    </span>
  );
}

/**
 * Plateformes disponibles (obligation d'attribution JustWatch/TMDB).
 *
 * Chaque badge est un LIEN direct vers la plateforme (§22) : un badge sur
 * lequel on ne peut pas cliquer n'apprend rien. Quand le service n'a pas d'URL
 * de recherche vérifiée, on ouvre la page JustWatch de l'œuvre, toujours
 * valide, plutôt qu'un lien deviné.
 *
 * Le compte « +N » est un BOUTON qui déplie la liste : l'utilisateur ne doit
 * jamais se heurter à une information tronquée et inerte.
 */
export function ProviderBadges({
  providers,
  limit = 4,
  showMonetization = false,
  title = "",
}: {
  providers: ProviderAvailability[];
  limit?: number;
  showMonetization?: boolean;
  /** Titre de l'œuvre : sert à construire les liens de recherche. */
  title?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!providers.length) return null;

  // Une entrée par plateforme. `providersFromAvailability` pousse les
  // abonnements avant la location et l'achat : le premier gagne donc, ce qui
  // affiche l'offre la plus intéressante (« inclus dans l'abonnement »).
  const unique = providers.filter(
    (provider, index, all) => all.findIndex((item) => item.providerId === provider.providerId) === index,
  );
  const hidden = unique.length - limit;
  const visible = expanded ? unique : unique.slice(0, limit);

  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {visible.map((provider) => {
        const href = providerWatchUrl(provider, title);
        const content = (
          <>
            <span aria-hidden>🎟️</span>
            {provider.name}
            {showMonetization ? (
              <span className="text-muted-dim"> · {monetizationLabel(provider.monetization)}</span>
            ) : null}
          </>
        );

        return (
          <li key={`${provider.providerId}-${provider.monetization}`}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel={EXTERNAL_LINK_REL}
                className="t-chip text-xs transition-colors hover:border-violet/60 hover:text-chalk"
                aria-label={`Regarder sur ${provider.name}`}
              >
                {content}
              </a>
            ) : (
              <span className="t-chip text-xs">{content}</span>
            )}
          </li>
        );
      })}
      {hidden > 0 ? (
        <li>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="t-chip cursor-pointer text-xs text-muted-dim transition-colors hover:border-violet/50 hover:text-chalk"
          >
            {expanded ? "− Réduire" : `+${hidden} autres`}
          </button>
        </li>
      ) : null}
    </ul>
  );
}

/** Vignette d'œuvre, utilisée dans les grilles (favoris, recherche, historique). */
export function PosterCard({
  candidate,
  href,
  badge,
  footer,
}: {
  candidate: Candidate;
  href: string;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <li className="group">
      <Link
        href={href}
        className="block overflow-hidden rounded-2xl border border-night-line bg-night/60 transition-transform duration-200 hover:-translate-y-1 hover:border-violet/50"
      >
        <div className="relative aspect-2/3 w-full overflow-hidden">
          <PosterImage
            path={candidate.posterPath}
            title={candidate.title}
            mediaType={candidate.mediaType}
            sizes="(max-width: 480px) 45vw, (max-width: 900px) 30vw, 200px"
          />
          {badge ? <div className="absolute left-2 top-2">{badge}</div> : null}
        </div>
        <div className="space-y-1 p-3">
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-tight text-chalk">
            {candidate.title}
          </h3>
          <p className="text-xs text-muted-dim">
            {candidate.mediaType === "movie" ? formatYear(candidate.year) : formatSeriesYears(candidate)}
            {" · ⭐ "}
            {formatRating(candidate.voteAverage)}
          </p>
          {footer}
        </div>
      </Link>
    </li>
  );
}

/** Lien vers la fiche détaillée d'une œuvre. */
export function detailHref(candidate: Candidate): string {
  return candidate.mediaType === "movie" ? `/film/${candidate.id}` : `/serie/${candidate.id}`;
}

export { formatRating };
export type { ScoredCandidate };
