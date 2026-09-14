import { NextResponse } from "next/server";
import { getCatalog } from "@/services/catalog";
import { enforceRateLimit } from "@/server/api/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bande-annonce minimale pour l'écran résultat, sans exposer le token TMDB. */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "trailer", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const url = new URL(request.url);
  const mediaType = url.searchParams.get("mediaType");
  const id = Number(url.searchParams.get("id"));

  if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(id) || id <= 0 || id > 10_000_000) {
    return NextResponse.json(
      { error: "La demande de bande-annonce est invalide." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const details = await getCatalog().getDetails(mediaType, id);
    return NextResponse.json(
      { title: details.title, trailer: details.trailer },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=86400" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Je n'arrive pas à récupérer la bande-annonce pour le moment." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
