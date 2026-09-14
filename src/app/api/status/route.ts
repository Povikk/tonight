/**
 * `GET /api/status`
 * Indique à l'interface si TONIGHT tourne sur TMDB ou sur le catalogue de démo.
 * Aucune donnée sensible n'est exposée : jamais le token, seulement le mode.
 */

import { NextResponse } from "next/server";
import { getCatalogMode } from "@/services/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const mode = getCatalogMode();
  return NextResponse.json({
    mode,
    region: process.env.TONIGHT_REGION || "FR",
    language: process.env.TONIGHT_LANGUAGE || "fr-FR",
    demo: mode === "demo",
  });
}
