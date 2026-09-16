import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const DATASET_URL = "https://datasets.imdbws.com/title.ratings.tsv.gz";
const NAMESPACE_ID = "6d438d1532714a69a7bae1d1b2182dac";
const META_KEY = "imdb:meta";

function runWrangler(args, options = {}) {
  const projectDirectory = fileURLToPath(new URL("..", import.meta.url));
  const wrangler = join(projectDirectory, "node_modules", "wrangler", "bin", "wrangler.js");
  return execFileSync(process.execPath, [wrangler, ...args], {
    cwd: projectDirectory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  });
}

function currentMetadata() {
  try {
    const output = runWrangler([
      "kv",
      "key",
      "get",
      META_KEY,
      "--namespace-id",
      NAMESPACE_ID,
      "--remote",
      "--text",
    ]);
    return JSON.parse(output);
  } catch {
    return null;
  }
}

async function writeChunk(stream, chunk) {
  if (stream.write(chunk)) return;
  await new Promise((resolve, reject) => {
    const onDrain = () => {
      stream.off("error", onError);
      resolve();
    };
    const onError = (error) => {
      stream.off("drain", onDrain);
      reject(error);
    };
    stream.once("drain", onDrain);
    stream.once("error", onError);
  });
}

async function closeStream(stream) {
  await new Promise((resolve, reject) => {
    stream.end(resolve);
    stream.once("error", reject);
  });
}

export async function buildImportFiles({
  outputDirectory,
  datasetUrl = DATASET_URL,
  now = new Date(),
  minimumRows = 1_000_000,
  fetchImplementation = fetch,
}) {
  const response = await fetchImplementation(datasetUrl, {
    headers: { "User-Agent": "TONIGHT/1.0 IMDb ratings importer" },
  });
  if (!response.ok || !response.body) throw new Error(`IMDb dataset ${response.status}`);

  const version = now.toISOString().slice(0, 10);
  const bulkPath = join(outputDirectory, "ratings-bulk.json");
  const metadataPath = join(outputDirectory, "metadata.json");
  const output = createWriteStream(bulkPath, { encoding: "utf8" });
  const input = Readable.fromWeb(response.body).pipe(createGunzip());
  const reader = createInterface({ input, crlfDelay: Infinity });
  let headerSeen = false;
  let currentPrefix = null;
  let entries = [];
  let rows = 0;
  let firstShard = true;

  await writeChunk(output, "[");
  const flush = async () => {
    if (!currentPrefix || entries.length === 0) return;
    const item = {
      key: `imdb:${version}:${currentPrefix}`,
      value: `{${entries.join(",")}}`,
    };
    await writeChunk(output, `${firstShard ? "" : ","}${JSON.stringify(item)}`);
    firstShard = false;
  };

  try {
    for await (const line of reader) {
      if (!headerSeen) {
        if (line !== "tconst\taverageRating\tnumVotes") {
          throw new Error("Unexpected IMDb dataset header");
        }
        headerSeen = true;
        continue;
      }

      const [imdbId, rawAverage, rawVoteCount] = line.split("\t");
      if (!/^tt\d{7,10}$/.test(imdbId)) continue;
      const prefix = imdbId.slice(2, 4);
      if (currentPrefix && prefix < currentPrefix) {
        throw new Error("IMDb dataset is not ordered by tconst");
      }
      if (prefix !== currentPrefix) {
        await flush();
        currentPrefix = prefix;
        entries = [];
      }

      const average = Number.parseFloat(rawAverage);
      const voteCount = Number.parseInt(rawVoteCount, 10);
      if (!Number.isFinite(average) || !Number.isInteger(voteCount)) continue;
      entries.push(`"${imdbId}":[${average},${voteCount}]`);
      rows += 1;
    }
    await flush();
    await writeChunk(output, "]");
    await closeStream(output);
  } catch (error) {
    output.destroy();
    throw error;
  }

  if (!headerSeen || rows < minimumRows) {
    throw new Error(`IMDb dataset incomplete (${rows} rows)`);
  }

  const metadata = {
    version,
    importedAt: now.toISOString(),
    rows,
    sourceLastModified: response.headers.get("last-modified"),
  };
  await writeFile(metadataPath, JSON.stringify(metadata), "utf8");
  return { bulkPath, metadataPath, metadata };
}

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "tonight-imdb-"));
  const previous = currentMetadata();
  try {
    const { bulkPath, metadataPath, metadata } = await buildImportFiles({
      outputDirectory: directory,
    });

    runWrangler([
      "kv",
      "bulk",
      "put",
      bulkPath,
      "--namespace-id",
      NAMESPACE_ID,
      "--remote",
    ]);
    runWrangler([
      "kv",
      "key",
      "put",
      META_KEY,
      "--path",
      metadataPath,
      "--namespace-id",
      NAMESPACE_ID,
      "--remote",
    ]);

    if (previous?.version && previous.version !== metadata.version) {
      const deletePath = join(directory, "delete-old-version.json");
      const oldKeys = Array.from(
        { length: 100 },
        (_, index) => `imdb:${previous.version}:${String(index).padStart(2, "0")}`,
      );
      await writeFile(deletePath, JSON.stringify(oldKeys), "utf8");
      runWrangler([
        "kv",
        "bulk",
        "delete",
        deletePath,
        "--namespace-id",
        NAMESPACE_ID,
        "--remote",
        "--force",
      ]);
    }

    const uploaded = JSON.parse(await readFile(metadataPath, "utf8"));
    console.log(`IMDb ${uploaded.version}: ${uploaded.rows.toLocaleString("fr-FR")} notes importées.`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
