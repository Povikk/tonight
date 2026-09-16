import { afterEach, describe, expect, it, vi } from "vitest";
import { getOmdbRating } from "./client";

afterEach(() => {
  delete process.env.OMDB_API_KEY;
  vi.unstubAllGlobals();
});

describe("client OMDb", () => {
  it("n'appelle pas OMDb sans clé", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOmdbRating("tt0111161")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("convertit la note et le nombre de votes IMDb", async () => {
    process.env.OMDB_API_KEY = "omdb-test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ Response: "True", imdbRating: "9.3", imdbVotes: "3,152,487" }),
          { status: 200 },
        ),
      ),
    );

    await expect(getOmdbRating("tt0111162")).resolves.toEqual({
      source: "imdb",
      average: 9.3,
      voteCount: 3_152_487,
    });
  });

  it("retombe proprement sur TMDB quand OMDb n'a pas de note", async () => {
    process.env.OMDB_API_KEY = "omdb-test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ Response: "True", imdbRating: "N/A", imdbVotes: "N/A" }),
          { status: 200 },
        ),
      ),
    );

    await expect(getOmdbRating("tt0111163")).resolves.toBeNull();
  });

  it("ne met pas une panne transitoire en cache", async () => {
    process.env.OMDB_API_KEY = "omdb-test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("indisponible", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ Response: "True", imdbRating: "8.1", imdbVotes: "42,000" }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOmdbRating("tt0111164")).rejects.toThrow("OMDb 503");
    await expect(getOmdbRating("tt0111164")).resolves.toEqual({
      source: "imdb",
      average: 8.1,
      voteCount: 42_000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
