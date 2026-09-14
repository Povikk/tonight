/**
 * `POST /api/parse`
 *
 * Analyse une demande en langage naturel et renvoie les préférences
 * structurées + les chips « J'ai compris ».
 *
 * Pourquoi côté serveur ? Pour pouvoir brancher plus tard un LLM sans changer
 * une ligne de l'interface ni du moteur de recommandation (§9, §10). En V1 le
 * parser est 100 % local et gratuit.
 */

import { NextResponse } from "next/server";
import { parseNaturalLanguageRequest } from "@/naturalLanguage/parseRequest";
import type { MediaTypeChoice, PreferencesSource } from "@/types/tonight";
import { enforceRateLimit, readLimitedJson } from "@/server/api/security";
import { parseBodySchema } from "@/server/api/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ParseBody {
  query?: string;
  forcedMediaType?: MediaTypeChoice;
  source?: PreferencesSource;
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "parse", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const json = await readLimitedJson(request, 4 * 1_024);
  if (!json.ok) return json.response;

  const parsedBody = parseBodySchema.safeParse(json.value);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "La demande est invalide." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const body: ParseBody = parsedBody.data;

  const query = body.query ?? "";

  const parsed = parseNaturalLanguageRequest(query, {
    forcedMediaType: body.forcedMediaType,
    source: body.source ?? "natural_language",
  });

  return NextResponse.json(parsed);
}
