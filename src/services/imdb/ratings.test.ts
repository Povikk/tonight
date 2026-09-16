import { describe, expect, it, vi } from "vitest";
import type { Candidate } from "@/types/tonight";
import { enrichWithImdbRatings, getImdbRatings } from "./ratings";

function store(values: Record<string, unknown>) {
  return {
    get: vi.fn(async (key: string) => values[key] ?? null),
  };
}

describe("dataset IMDb", () => {
  it("lit plusieurs notes dans un seul shard", async () => {
    const kv = store({
      "imdb:meta": { version: "2026-09-16", importedAt: "2026-09-16T03:00:00Z", rows: 2 },
      "imdb:2026-09-16:01": {
        tt0111161: [9.3, 3_152_487],
        tt0133093: [8.7, 2_200_000],
      },
    });

    const ratings = await getImdbRatings(["tt0111161", "tt0133093"], kv);

    expect(ratings.get("tt0111161")).toEqual({
      source: "imdb",
      average: 9.3,
      voteCount: 3_152_487,
    });
    expect(kv.get).toHaveBeenCalledTimes(2);
  });

  it("ignore les identifiants et valeurs invalides", async () => {
    const kv = store({
      "imdb:meta": { version: "2026-09-16", importedAt: "2026-09-16T03:00:00Z", rows: 1 },
      "imdb:2026-09-16:01": { tt0111161: [11, 0] },
    });

    const ratings = await getImdbRatings(["incorrect", "tt0111161"], kv);

    expect(ratings.size).toBe(0);
  });

  it("conserve le candidat TMDB quand KV échoue", async () => {
    const candidate = {
      id: 1,
      imdbId: "tt0111161",
      voteAverage: 8.5,
      publicRating: null,
    } as Candidate;
    const kv = { get: vi.fn(async () => { throw new Error("KV unavailable"); }) };

    await expect(enrichWithImdbRatings([candidate], kv)).resolves.toEqual([candidate]);
  });

  it("ne garde pas une panne KV transitoire en cache", async () => {
    let shardAttempts = 0;
    const kv = {
      get: vi.fn(async (key: string) => {
        if (key === "imdb:meta") {
          return { version: "2026-09-17", importedAt: "2026-09-17T03:00:00Z", rows: 1 };
        }
        shardAttempts += 1;
        if (shardAttempts === 1) throw new Error("KV unavailable");
        return { tt0111161: [9.3, 3_152_487] };
      }),
    };

    await expect(getImdbRatings(["tt0111161"], kv)).rejects.toThrow("KV unavailable");
    await expect(getImdbRatings(["tt0111161"], kv)).resolves.toEqual(
      new Map([
        ["tt0111161", { source: "imdb", average: 9.3, voteCount: 3_152_487 }],
      ]),
    );
  });
});
