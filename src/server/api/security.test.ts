import { describe, expect, it } from "vitest";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import { enforceRateLimit, readLimitedJson } from "./security";
import { parseBodySchema, recommendBodySchema } from "./schemas";

describe("public API guards", () => {
  it("accepts the complete preferences object sent by the application", () => {
    const result = recommendBodySchema.safeParse({
      preferences: createEmptyPreferences("natural_language", { rawQuery: "une comédie" }),
      context: { sessionExcluded: [], feedback: [], profile: null, allowRelaxation: true },
      count: 8,
      seed: 42,
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown fields and out-of-range values", () => {
    expect(parseBodySchema.safeParse({ query: "film", admin: true }).success).toBe(false);
    expect(recommendBodySchema.safeParse({ count: 10_000 }).success).toBe(false);
    expect(
      recommendBodySchema.safeParse({ preferences: { mediaType: "game" } }).success,
    ).toBe(false);
  });

  it("rejects a streamed body once it crosses the byte limit", async () => {
    const request = new Request("http://localhost/api/parse", {
      method: "POST",
      body: JSON.stringify({ query: "x".repeat(200) }),
      headers: { "content-type": "application/json" },
    });

    const result = await readLimitedJson(request, 64);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it("returns 429 after the per-IP budget is exhausted", () => {
    const request = new Request("http://localhost/api/test", {
      headers: { "cf-connecting-ip": "192.0.2.44" },
    });
    const policy = { bucket: `test-${Date.now()}`, limit: 2, windowMs: 60_000 };

    expect(enforceRateLimit(request, policy)).toBeNull();
    expect(enforceRateLimit(request, policy)).toBeNull();
    const response = enforceRateLimit(request, policy);
    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBeTruthy();
  });

  it("ignore les en-têtes d'IP falsifiables par le client", () => {
    const policy = { bucket: `spoof-${Date.now()}`, limit: 1, windowMs: 60_000 };
    const first = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "198.51.100.1", "x-real-ip": "198.51.100.1" },
    });
    const second = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.9", "x-real-ip": "203.0.113.9" },
    });

    expect(enforceRateLimit(first, policy)).toBeNull();
    // Changer d'en-tête ne doit PAS donner un nouveau quota.
    expect(enforceRateLimit(second, policy)?.status).toBe(429);
  });
});
