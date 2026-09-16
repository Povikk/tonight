import type { Candidate, PublicRating } from "@/types/tonight";

interface KvStore {
  get(key: string, type: "json"): Promise<unknown>;
}

interface RatingsMetadata {
  version: string;
  importedAt: string;
  rows: number;
}

type RatingsShard = Record<string, [average: number, voteCount: number]>;

const META_KEY = "imdb:meta";
const META_TTL = 5 * 60 * 1000;
const MAX_CACHED_SHARDS = 6;

const metadataCaches = new WeakMap<
  KvStore,
  { value: RatingsMetadata | null; expiresAt: number }
>();
const shardCaches = new WeakMap<KvStore, Map<string, Promise<RatingsShard | null>>>();

function isMetadata(value: unknown): value is RatingsMetadata {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RatingsMetadata>;
  return (
    typeof candidate.version === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.version) &&
    typeof candidate.importedAt === "string" &&
    typeof candidate.rows === "number"
  );
}

function isShard(value: unknown): value is RatingsShard {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function configuredStore(): Promise<KvStore | null> {
  try {
    const { env } = await import("cloudflare:workers");
    return ((env as unknown as { IMDB_RATINGS?: KvStore }).IMDB_RATINGS ?? null);
  } catch {
    // Le build Next.js classique et le développement local n'ont pas de binding KV.
    return null;
  }
}

async function getMetadata(store: KvStore): Promise<RatingsMetadata | null> {
  const now = Date.now();
  const cached = metadataCaches.get(store);
  if (cached && cached.expiresAt > now) return cached.value;

  const value = await store.get(META_KEY, "json");
  const metadata = isMetadata(value) ? value : null;
  metadataCaches.set(store, { value: metadata, expiresAt: now + META_TTL });
  return metadata;
}

function cacheFor(store: KvStore): Map<string, Promise<RatingsShard | null>> {
  const existing = shardCaches.get(store);
  if (existing) return existing;
  const created = new Map<string, Promise<RatingsShard | null>>();
  shardCaches.set(store, created);
  return created;
}

function rememberShard(
  cache: Map<string, Promise<RatingsShard | null>>,
  key: string,
  value: Promise<RatingsShard | null>,
): void {
  cache.set(key, value);
  if (cache.size <= MAX_CACHED_SHARDS) return;
  const oldest = cache.keys().next().value;
  if (oldest) cache.delete(oldest);
}

async function getShard(
  store: KvStore,
  version: string,
  prefix: string,
): Promise<RatingsShard | null> {
  const key = `imdb:${version}:${prefix}`;
  const cache = cacheFor(store);
  const cached = cache.get(key);
  if (cached) return cached;

  const pending = store
    .get(key, "json")
    .then((value) => (isShard(value) ? value : null))
    .catch((error) => {
      cache.delete(key);
      throw error;
    });
  rememberShard(cache, key, pending);
  return pending;
}

/** Lit les notes IMDb officielles dans le dataset quotidien stocké par shards. */
export async function getImdbRatings(
  imdbIds: string[],
  providedStore?: KvStore,
): Promise<Map<string, PublicRating>> {
  const store = providedStore ?? (await configuredStore());
  if (!store) return new Map();

  const metadata = await getMetadata(store);
  if (!metadata) return new Map();

  const validIds = [...new Set(imdbIds.filter((id) => /^tt\d{7,10}$/.test(id)))];
  const idsByPrefix = new Map<string, string[]>();
  for (const imdbId of validIds) {
    const prefix = imdbId.slice(2, 4);
    idsByPrefix.set(prefix, [...(idsByPrefix.get(prefix) ?? []), imdbId]);
  }

  const ratings = new Map<string, PublicRating>();
  await Promise.all(
    [...idsByPrefix].map(async ([prefix, ids]) => {
      const shard = await getShard(store, metadata.version, prefix);
      if (!shard) return;
      for (const imdbId of ids) {
        const value = shard[imdbId];
        if (!value) continue;
        const [average, voteCount] = value;
        if (!Number.isFinite(average) || average <= 0 || average > 10) continue;
        if (!Number.isInteger(voteCount) || voteCount <= 0) continue;
        ratings.set(imdbId, { source: "imdb", average, voteCount });
      }
    }),
  );
  return ratings;
}

/** Enrichit les œuvres affichées sans appel externe par titre. */
export async function enrichWithImdbRatings(
  candidates: Candidate[],
  store?: KvStore,
): Promise<Candidate[]> {
  try {
    const ratings = await getImdbRatings(
      candidates.flatMap((candidate) => (candidate.imdbId ? [candidate.imdbId] : [])),
      store,
    );
    return candidates.map((candidate) => {
      const publicRating = candidate.imdbId ? ratings.get(candidate.imdbId) : null;
      return publicRating ? { ...candidate, publicRating } : candidate;
    });
  } catch {
    return candidates;
  }
}
