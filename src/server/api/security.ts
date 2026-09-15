import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}
interface RateLimitPolicy {
  bucket: string;
  limit: number;
  windowMs: number;
}

const MAX_RATE_LIMIT_ENTRIES = 5_000;

declare global {
  // Conservé entre les rechargements en développement et les requêtes d'une
  // même instance. En production multi-instance, le proxy reste l'autorité.
  var tonightRateLimits: Map<string, RateLimitEntry> | undefined;
}

const rateLimits = globalThis.tonightRateLimits ?? new Map<string, RateLimitEntry>();
globalThis.tonightRateLimits = rateLimits;

/**
 * Identité réseau utilisée pour le quota.
 *
 * `cf-connecting-ip` est injecté et nettoyé par Cloudflare (cible de
 * déploiement) : c'est la seule source réellement fiable. `x-real-ip` et
 * `x-forwarded-for` sont falsifiables par le client si l'origine reste joignable
 * directement, donc on ne les accepte que lorsqu'un proxy de confiance est
 * déclaré explicitement. Sinon tous les clients partagent le bucket « unknown » :
 * un quota strict vaut mieux qu'un quota contournable.
 */
function clientIp(request: Request): string {
  const cloudflare = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;

  if (process.env.TONIGHT_TRUST_PROXY_HEADERS === "1") {
    const real = request.headers.get("x-real-ip")?.trim();
    if (real) return real;
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }

  return "unknown";
}

/**
 * Fait de la place pour une nouvelle entrée.
 *
 * On purge d'abord les entrées expirées, puis — si la table est toujours pleine
 * d'entrées actives — on évince les plus anciennes (FIFO). Sans cette éviction
 * ferme, une attaque distribuée faisait croître la `Map` sans borne.
 */
function makeRoom(now: number): void {
  if (rateLimits.size < MAX_RATE_LIMIT_ENTRIES) return;
  for (const [key, entry] of rateLimits) {
    if (entry.resetAt <= now) rateLimits.delete(key);
  }
  while (rateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
    const oldest = rateLimits.keys().next().value;
    if (oldest === undefined) break;
    rateLimits.delete(oldest);
  }
}

/**
 * Premier filet anti-abus par instance.
 *
 * Une plateforme distribuée doit également appliquer une limite globale au
 * niveau du proxy/WAF : cette mémoire n'est volontairement ni une base de
 * données, ni une promesse de quota partagé entre plusieurs régions.
 */
export function enforceRateLimit(request: Request, policy: RateLimitPolicy): NextResponse | null {
  const now = Date.now();
  const key = `${policy.bucket}:${clientIp(request)}`;

  if (!rateLimits.has(key)) makeRoom(now);

  const previous = rateLimits.get(key);
  const entry = !previous || previous.resetAt <= now
    ? { count: 1, resetAt: now + policy.windowMs }
    : { ...previous, count: previous.count + 1 };

  rateLimits.set(key, entry);
  const remaining = Math.max(0, policy.limit - entry.count);
  const headers = {
    "RateLimit-Limit": String(policy.limit),
    "RateLimit-Remaining": String(remaining),
    "RateLimit-Reset": String(Math.ceil(entry.resetAt / 1_000)),
  };

  if (entry.count <= policy.limit) return null;

  return NextResponse.json(
    { error: "Trop de demandes. Patiente un instant avant de réessayer." },
    {
      status: 429,
      headers: {
        ...headers,
        "Retry-After": String(Math.max(1, Math.ceil((entry.resetAt - now) / 1_000))),
        "Cache-Control": "no-store",
      },
    },
  );
}

type JsonReadResult =
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse };

/** Lit un corps JSON sans laisser un flux chunked contourner la taille limite. */
export async function readLimitedJson(
  request: Request,
  maxBytes = 32 * 1_024,
): Promise<JsonReadResult> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Requête trop volumineuse." },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 }),
    };
  }

  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Requête trop volumineuse." },
            { status: 413, headers: { "Cache-Control": "no-store" } },
          ),
        };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 }),
    };
  }
}
