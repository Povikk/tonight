/**
 * `POST /api/recommend`
 *
 * Cœur de TONIGHT : reçoit des préférences normalisées (quelle que soit leur
 * origine) + le contexte local (session, feedback, profil) et renvoie UNE
 * recommandation, ses alternatives, et la trace des assouplissements.
 */

import { NextResponse } from "next/server";
import { recommend } from "@/recommendation/engine";
import { getCatalogMode } from "@/services/catalog";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import type { RecommendationContext, Relaxation, TonightSearchPreferences } from "@/types/tonight";
import { enforceRateLimit, readLimitedJson } from "@/server/api/security";
import { recommendBodySchema } from "@/server/api/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Le moteur fait plusieurs appels TMDB : on laisse de la marge. */
export const maxDuration = 30;

interface RecommendBody {
  preferences?: Partial<TonightSearchPreferences>;
  context?: Partial<RecommendationContext>;
  count?: number;
  seed?: number;
}

const EMPTY_CONTEXT: RecommendationContext = {
  sessionExcluded: [],
  feedback: [],
  profile: null,
  allowRelaxation: true,
};

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "recommend", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const json = await readLimitedJson(request);
  if (!json.ok) return json.response;

  const parsed = recommendBodySchema.safeParse(json.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Les critères de recommandation sont invalides." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const body: RecommendBody = parsed.data;

  const preferences = createEmptyPreferences(
    body.preferences?.source ?? "questionnaire",
    body.preferences ?? {},
  );

  const context: RecommendationContext = {
    ...EMPTY_CONTEXT,
    ...body.context,
    sessionExcluded: Array.isArray(body.context?.sessionExcluded) ? body.context.sessionExcluded.slice(0, 500) : [],
    feedback: Array.isArray(body.context?.feedback) ? body.context.feedback.slice(0, 20) : [],
  };

  const mode = getCatalogMode();

  try {
    const response = await recommend({
      preferences,
      context,
      count: Math.max(1, Math.min(body.count ?? 8, 20)),
      seed: body.seed ?? Math.floor(Date.now() / 1000) % 100_000,
    });

    return NextResponse.json({ ...response, mode });
  } catch (error) {
    // Jamais d'écran cassé (§67) : on renvoie un message utilisable.
    const message =
      error instanceof Error && error.message.includes("TMDB")
        ? "TMDB ne répond pas pour le moment. Réessaie dans un instant."
        : "Tonight a eu un souci en cherchant. Réessaie, ça devrait passer.";

    const relaxations: Relaxation[] = [];
    return NextResponse.json(
      {
        top: null,
        alternatives: [],
        relaxations,
        fullyRelaxed: false,
        appliedPreferences: preferences,
        poolSize: 0,
        empty: true,
        mode,
        error: message,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
