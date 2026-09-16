import { gzipSync } from "node:zlib";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildImportFiles } from "./import-imdb-ratings.mjs";

const directories = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("import IMDb", () => {
  it("produit des shards KV versionnés", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tonight-imdb-test-"));
    directories.push(directory);
    const body = gzipSync(
      "tconst\taverageRating\tnumVotes\n" +
        "tt0111161\t9.3\t3152487\n" +
        "tt0133093\t8.7\t2200000\n" +
        "tt10123456\t7.1\t42000\n",
    );

    const result = await buildImportFiles({
      outputDirectory: directory,
      now: new Date("2026-09-16T03:00:00Z"),
      minimumRows: 3,
      fetchImplementation: async () =>
        new Response(body, { headers: { "last-modified": "Wed, 16 Sep 2026 00:00:00 GMT" } }),
    });
    const bulk = JSON.parse(await readFile(result.bulkPath, "utf8"));

    expect(bulk.map((entry) => entry.key)).toEqual([
      "imdb:2026-09-16:01",
      "imdb:2026-09-16:10",
    ]);
    expect(JSON.parse(bulk[0].value).tt0111161).toEqual([9.3, 3_152_487]);
    expect(result.metadata.rows).toBe(3);
  });

  it("refuse un fichier incomplet", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tonight-imdb-test-"));
    directories.push(directory);
    const body = gzipSync("tconst\taverageRating\tnumVotes\ntt0111161\t9.3\t3152487\n");

    await expect(
      buildImportFiles({
        outputDirectory: directory,
        minimumRows: 2,
        fetchImplementation: async () => new Response(body),
      }),
    ).rejects.toThrow("incomplete");
  });
});
