"use client";

import { useEffect, useState } from "react";
import { POSTER_SIZES, BACKDROP_SIZES } from "@/utils/constants";
import { backdropSrcSet, posterSrcSet, posterUrl, backdropUrl } from "@/services/tmdb/images";
import { stableHash } from "@/utils/text";

/**
 * Visuels procéduraux.
 *
 * En mode démo (aucun token TMDB) il n'y a pas d'affiches : on génère un visuel
 * déterministe à partir du titre. C'est aussi le repli quand une image TMDB
 * manque ou échoue au chargement (§67) : jamais d'écran cassé.
 */

const DUOTONES: Array<[string, string]> = [
  ["#1b1440", "#7b6cff"],
  ["#0c1224", "#38bdf8"],
  ["#2a1020", "#ff7a7a"],
  ["#14231f", "#7fe0a8"],
  ["#241a08", "#ffc978"],
  ["#1a1030", "#f0a6ff"],
];

function duoFor(seed: string): [string, string] {
  return DUOTONES[stableHash(seed) % DUOTONES.length];
}
export function PosterPlaceholder({
  title,
  mediaType,
  className = "",
}: {
  title: string;
  mediaType: "movie" | "tv";
  className?: string;
}) {
  const [from, to] = duoFor(title);
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div
      aria-label={`Affiche indisponible pour ${title}`}
      role="img"
      className={`t-grain relative flex h-full w-full flex-col justify-between overflow-hidden ${className}`}
      style={{ background: `linear-gradient(150deg, ${from} 0%, ${to}55 60%, #04050a 100%)` }}
    >
      <span
        aria-hidden
        className="absolute -right-6 -top-8 font-display text-[6rem] font-extrabold leading-none text-white/10"
      >
        {initials}
      </span>
      <span className="relative mt-auto p-3 font-display text-sm font-semibold leading-tight text-white/90 t-balance">
        {title}
      </span>
      <span className="relative px-3 pb-3 text-[0.6rem] uppercase tracking-[0.2em] text-white/40">
        {mediaType === "movie" ? "Film" : "Série"}
      </span>
    </div>
  );
}

/**
 * Affiche d'une œuvre (portrait).
 *
 * On utilise volontairement une balise `img` native : TMDB fournit déjà toutes
 * les tailles utiles, donc `srcset`/`sizes` couvrent exactement le besoin sans
 * passer par un optimiseur d'images (§62 : ne jamais charger une image énorme
 * pour une vignette).
 */
export function PosterImage({
  path,
  title,
  mediaType,
  sizes = "(max-width: 640px) 40vw, 180px",
  priority = false,
  className = "",
}: {
  path: string | null;
  title: string;
  mediaType: "movie" | "tv";
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = posterUrl(path, POSTER_SIZES.card);
  const srcSet = posterSrcSet(path);

  // Une erreur de chargement ne doit pas condamner les œuvres suivantes : quand
  // la source change, on retente.
  useEffect(() => setFailed(false), [path]);

  if (!src || failed) {
    return <PosterPlaceholder title={title} mediaType={mediaType} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={`Affiche de ${title}`}
      width={342}
      height={513}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

/** Backdrop large (paysage) avec repli procédural. */
export function BackdropImage({
  path,
  title,
  mediaType,
  priority = false,
  className = "",
}: {
  path: string | null;
  title: string;
  mediaType: "movie" | "tv";
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const hero = backdropUrl(path, BACKDROP_SIZES.hero);

  useEffect(() => setFailed(false), [path]);

  if (!hero || failed) {
    const [from, to] = duoFor(title);
    return (
      <div
        aria-hidden
        className={`h-full w-full ${className}`}
        style={{
          background: `radial-gradient(120% 90% at 20% 10%, ${to}44 0%, transparent 60%), linear-gradient(180deg, ${from} 0%, #04050a 85%)`,
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={hero}
      srcSet={backdropSrcSet(path)}
      sizes="100vw"
      alt=""
      width={1280}
      height={720}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
