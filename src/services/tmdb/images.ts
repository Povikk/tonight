/** Construction des URLs d'images TMDB (toujours avec la bonne taille). */

import { BACKDROP_SIZES, POSTER_SIZES, PROFILE_SIZE, TMDB_IMAGE_BASE } from "@/utils/constants";

export type PosterSize = (typeof POSTER_SIZES)[keyof typeof POSTER_SIZES];
export type BackdropSize = (typeof BACKDROP_SIZES)[keyof typeof BACKDROP_SIZES];

export function imageUrl(path: string | null | undefined, size: string): string | null {
  if (!path) return null;
  // Certaines entrées de démo fournissent déjà une URL complète.
  if (path.startsWith("http")) return path;
  return `${TMDB_IMAGE_BASE}/${size}${path.startsWith("/") ? path : `/${path}`}`;
}

export function posterUrl(path: string | null | undefined, size: PosterSize = POSTER_SIZES.card) {
  return imageUrl(path, size);
}

export function backdropUrl(
  path: string | null | undefined,
  size: BackdropSize = BACKDROP_SIZES.hero,
) {
  return imageUrl(path, size);
}

export function profileUrl(path: string | null | undefined) {
  return imageUrl(path, PROFILE_SIZE);
}

/** Logo de plateforme : obligatoire pour l'attribution JustWatch/TMDB. */
export function providerLogoUrl(logoPath: string | null | undefined, size = PROFILE_SIZE) {
  return imageUrl(logoPath, size);
}

/**
 * `srcSet` d'affiche : une vignette ne télécharge jamais une image énorme
 * (exigence performance §62).
 */
export function posterSrcSet(path: string | null | undefined): string | undefined {
  const thumb = posterUrl(path, POSTER_SIZES.thumb);
  const card = posterUrl(path, POSTER_SIZES.card);
  const detail = posterUrl(path, POSTER_SIZES.detail);
  if (!thumb || !card || !detail) return undefined;
  return `${thumb} 185w, ${card} 342w, ${detail} 500w`;
}

export function backdropSrcSet(path: string | null | undefined): string | undefined {
  const card = backdropUrl(path, BACKDROP_SIZES.card);
  const hero = backdropUrl(path, BACKDROP_SIZES.hero);
  if (!card || !hero) return undefined;
  return `${card} 780w, ${hero} 1280w`;
}
