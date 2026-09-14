/**
 * `GET /api/catalog?kind=genres|providers&mediaType=movie|tv`
 *
 * Genres et plateformes disponibles en France. En mode TMDB ils viennent de
 * TMDB (jamais hardcodés, §22) ; en mode démo ils dérivent du catalogue local.
 */

import { NextResponse } from "next/server";
import { getCatalog, getCatalogMode } from "@/services/catalog";
import { GENRE_NAMES_FR } from "@/utils/constants";
import { enforceRateLimit } from "@/server/api/security";

export const runtime = "nodejs";
/** Les genres/plateformes bougent peu : on les met en cache une journée. */
export const revalidate = 86_400;

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "catalog", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "genres";
  const mediaType = url.searchParams.get("mediaType") === "tv" ? "tv" : "movie";
  const catalog = getCatalog();

  try {
    if (kind === "providers") {
      const providers = await catalog.getProviders(mediaType);
      return NextResponse.json({ providers, mode: getCatalogMode() });
    }

    const genres = await catalog.getGenres(mediaType);
    return NextResponse.json({
      genres: genres.length
        ? genres
        : Object.entries(GENRE_NAMES_FR).map(([id, name]) => ({ id: Number(id), name })),
      mode: getCatalogMode(),
    });
  } catch {
    // Repli : jamais de menu vide.
    return NextResponse.json({
      genres: Object.entries(GENRE_NAMES_FR).map(([id, name]) => ({ id: Number(id), name })),
      providers: [],
      mode: getCatalogMode(),
      degraded: true,
    });
  }
}
