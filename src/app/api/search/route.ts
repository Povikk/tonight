/**
 * `GET /api/search?q=...&mediaType=movie|tv|any`
 * Recherche manuelle classique, discrète (§54).
 */

import { NextResponse } from "next/server";
import { getCatalog } from "@/services/catalog";
import type { MediaTypeChoice } from "@/types/tonight";
import { enforceRateLimit } from "@/server/api/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "search", limit: 90, windowMs: 60_000 });
  if (limited) return limited;

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const raw = url.searchParams.get("mediaType");
  const mediaType: MediaTypeChoice = raw === "movie" || raw === "tv" ? raw : "any";

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await getCatalog().search(query, mediaType);
    return NextResponse.json({ results: results.slice(0, 24) });
  } catch {
    return NextResponse.json(
      { results: [], error: "La recherche n'a pas abouti. Réessaie dans un instant." },
      { status: 200 },
    );
  }
}
