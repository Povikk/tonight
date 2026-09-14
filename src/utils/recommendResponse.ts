import type { RecommendResponse } from "@/types/tonight";

export type RecommendApiResponse = RecommendResponse & {
  error?: string;
  mode?: "tmdb" | "demo";
};

/**
 * Une réponse d'erreur générique (429, proxy, HTML transformé en JSON...) ne
 * doit jamais être prise pour une vraie recommandation : l'UI itère ensuite
 * sur `alternatives` et tomberait dans l'error boundary globale.
 */
export function isRecommendApiResponse(value: unknown): value is RecommendApiResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;

  return (
    (payload.top === null || typeof payload.top === "object") &&
    Array.isArray(payload.alternatives) &&
    Array.isArray(payload.relaxations) &&
    typeof payload.fullyRelaxed === "boolean" &&
    Boolean(payload.appliedPreferences) &&
    typeof payload.appliedPreferences === "object" &&
    typeof payload.poolSize === "number" &&
    typeof payload.empty === "boolean"
  );
}

export function apiErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const error = (value as Record<string, unknown>).error;
  return typeof error === "string" && error.trim() ? error : null;
}
