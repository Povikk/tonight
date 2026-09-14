#!/usr/bin/env node
/**
 * TONIGHT : vérification « en vraie grandeur » contre l'API TMDB.
 *
 *     npm run verify:live          (serveur déjà lancé sur le port 3777)
 *     npm run verify:live -- --base=http://127.0.0.1:4000
 *     npm run verify:live -- --seeds=1,7,13
 *
 * POURQUOI CE SCRIPT EXISTE
 * -------------------------
 * Le catalogue de démonstration masquait des bugs que seule la vraie API révèle :
 * contraintes dures jamais appliquées faute d'enrichissement, `discover/tv` qui
 * ignore `with_runtime`, keywords de mood inexistants, mode pépite qui couronnait
 * un blockbuster. Un test unitaire ne peut pas les attraper, puisque ce sont des
 * propriétés de l'API elle-même.
 *
 * RÈGLE DE CONCEPTION : les vérifications ci-dessous sont RÉÉCRITES
 * INDÉPENDAMMENT du code de production. On n'importe ni `filters.ts` ni
 * `discoveryScore.ts` : sinon un bug dans ces modules validerait sa propre erreur.
 * Ici, on relit le contrat de l'extérieur : ce que voit l'utilisateur.
 *
 * SORTIE : code 0 si tout est conforme, 1 sinon (utilisable en intégration
 * continue). Aucune dépendance externe.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* -------------------------------------------------------------------------- */
/* Arguments                                                                  */
/* -------------------------------------------------------------------------- */

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, value = "true"] = argument.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const BASE = (args.get("base") ?? process.env.TONIGHT_BASE ?? "http://127.0.0.1:3777").replace(/\/$/, "");
const SEEDS = (args.get("seeds") ?? "1,7").split(",").map((seed) => Number.parseInt(seed.trim(), 10)).filter(Number.isFinite);
/** Nombre d'alternatives demandées (l'écran en affiche 8). */
const COUNT = Number.parseInt(args.get("count") ?? "8", 10);

/* -------------------------------------------------------------------------- */
/* Noms lisibles (dupliqués volontairement : le rapport doit rester lisible)   */
/* -------------------------------------------------------------------------- */

const MOVIE_GENRE_NAMES = {
  27: "Horreur",
  35: "Comédie",
  53: "Thriller",
  80: "Crime",
  878: "Science-Fiction",
  9648: "Mystère",
  10749: "Romance",
  10751: "Familial",
};

const REFUSAL_LABELS = {
  sad: "triste / déprimant",
  dark: "sombre / glauque",
};

/* -------------------------------------------------------------------------- */
/* Phrases de référence et CONTRAT attendu                                    */
/* -------------------------------------------------------------------------- */
/**
 * `parsed`  : ce que TONIGHT doit avoir COMPRIS (contrôle du parser).
 * `enforce` : ce que CHAQUE œuvre renvoyée doit respecter (contrôle du moteur).
 *
 * Les seuils sont ceux de la spécification, pas ceux du code : « moins de deux
 * heures » veut dire 120 minutes, « maximum 2 saisons » veut dire 2.
 */
const CASES = [
  {
    label: "Film récent, joli, un peu d'amour, pas déprimant, moins de 2h",
    phrase:
      "Je veux un film récent, joli à regarder, avec un peu d'amour, pas déprimant et moins de deux heures",
    parsed: {
      mediaType: "movie",
      maxRuntime: 120,
      genres: [10749],
      excludedMoods: ["sad"],
    },
    // NOTE : « récent » est une préférence SOUPLE (§13) et n'interdit pas
    // l'horreur. On ne vérifie donc que ce qui a été promis : le type, la durée
    // (dure) et le genre exigé.
    enforce: { mediaType: "movie", maxRuntime: 120, requireGenres: [10749] },
  },
  {
    label: "Petite série feel-good terminée, épisodes de 30 min",
    phrase: "Une petite série feel-good terminée avec des épisodes d'environ 30 minutes",
    parsed: { mediaType: "tv", maxSeasons: 2, seriesStatus: "ended", targetEpisodeRuntime: 30 },
    enforce: { mediaType: "tv", maxSeasons: 2, seriesEnded: true, episodeRuntimeMax: 44 },
  },
  {
    label: "Thriller des années 90 de moins de 2h",
    phrase: "Un thriller des années 90 de moins de deux heures",
    parsed: { mediaType: "movie", minYear: 1990, maxYear: 1999, maxRuntime: 120, genres: [53] },
    enforce: { mediaType: "movie", maxRuntime: 120, minYear: 1990, maxYear: 1999, requireGenres: [53] },
  },
  {
    label: "Série policière pas trop sombre, max 3 saisons",
    phrase: "Une série policière pas trop sombre avec maximum trois saisons",
    parsed: { mediaType: "tv", maxSeasons: 3, excludedMoods: ["dark"] },
    enforce: { mediaType: "tv", maxSeasons: 3, requireGenres: [80] },
  },
  {
    label: "Un très bon film que je ne connais probablement pas",
    phrase: "Un très bon film que je ne connais probablement pas",
    parsed: { mediaType: "movie", discoveryLevel: "hidden_gem" },
    // Le bug d'origine : The Dark Knight (36 681 votes, popularité 51) en tête
    // d'une demande de pépite. Une pépite est bien notée, crédible, et discrète.
    enforce: { mediaType: "movie", gemOnly: true },
  },
  {
    label: "Mini-série avec une vraie fin",
    phrase: "Une mini-série avec une vraie fin",
    parsed: { mediaType: "tv", maxSeasons: 1, seriesStatus: "ended" },
    enforce: { mediaType: "tv", maxSeasons: 1, seriesEnded: true },
  },
];

/* -------------------------------------------------------------------------- */
/* Vérifications indépendantes                                                */
/* -------------------------------------------------------------------------- */

/** Une série est-elle réellement terminée ? (une annulée ne l'est pas, §26) */
function isEnded(status) {
  if (!status) return false;
  const value = status.toLowerCase();
  return value.includes("ended") || value.includes("terminée");
}

/**
 * Dimension vérifiée → contrainte dure qui la porte, et type d'assouplissement
 * qui a le droit de la relâcher. Sert à détecter les contraintes cassées EN
 * SILENCE : c'est l'invariant central de §37 (§13 pour la distinction dur/souple).
 */
const ENFORCED_BY = {
  maxRuntime: { constraint: "maxRuntime", relaxation: "maxRuntime" },
  episodeRuntimeMax: { constraint: "maxRuntime", relaxation: "maxRuntime" },
  maxSeasons: { constraint: "maxSeasons", relaxation: "seriesStatus" },
  minYear: { constraint: "minYear", relaxation: "years" },
  maxYear: { constraint: "maxYear", relaxation: "years" },
  seriesEnded: { constraint: "seriesEnded", relaxation: "seriesStatus" },
  requireGenres: { constraint: "requireGenre", relaxation: "all" },
};

/**
 * Contrat EFFECTIF d'une réponse : ce que TONIGHT a réellement promis, relu à
 * partir des préférences appliquées (et non de celles qui avaient été demandées).
 */
function effectiveContract(base, applied) {
  const hard = new Set(applied.hardConstraints ?? []);
  const contract = { mediaType: base.mediaType };

  if (hard.has("maxRuntime")) {
    if (applied.mediaType === "tv" && applied.targetEpisodeRuntime !== null) {
      contract.episodeRuntimeMax = applied.targetEpisodeRuntime + (applied.episodeRuntimeTolerance || 12);
    } else if (applied.mediaType === "movie") {
      contract.maxRuntime = applied.maxRuntime ?? undefined;
    }
  }
  if (hard.has("maxSeasons")) contract.maxSeasons = applied.maxSeasons ?? undefined;
  if (hard.has("minSeasons")) contract.minSeasons = applied.minSeasons ?? undefined;
  if (hard.has("minYear")) contract.minYear = applied.minYear ?? undefined;
  if (hard.has("maxYear")) contract.maxYear = applied.maxYear ?? undefined;
  if (hard.has("seriesEnded")) contract.seriesEnded = true;
  if (hard.has("requireGenre") && applied.genres?.length) contract.requireGenres = applied.genres;

  // Les critères purement pondérés (pépite) ne sont jamais « cassés » : ils
  // influencent le classement, et le contrôle d'esprit est fait séparément.
  if (base.gemOnly) contract.gemOnly = true;

  return contract;
}

/**
 * Une dimension du contrat a-t-elle été lâchée SANS être annoncée ?
 * C'est la seule manière dont TONIGHT peut trahir l'utilisateur en silence.
 */
function silentBreaks(base, applied, relaxations) {
  const hard = new Set(applied.hardConstraints ?? []);
  const announced = new Set((relaxations ?? []).map((item) => item.kind));
  const problems = [];

  for (const dimension of Object.keys(base)) {
    const rule = ENFORCED_BY[dimension];
    if (!rule || hard.has(rule.constraint)) continue;
    if (announced.has(rule.relaxation)) continue;
    problems.push(`« ${dimension} » n'est plus appliqué et aucun assouplissement ne le dit`);
  }
  return problems;
}

/** Contrôle une œuvre renvoyée contre le contrat de sa phrase. */
function violations(candidate, enforce) {
  const problems = [];

  if (enforce.mediaType && candidate.mediaType !== enforce.mediaType) {
    problems.push(`type ${candidate.mediaType} ≠ ${enforce.mediaType}`);
  }

  if (enforce.maxRuntime !== undefined && candidate.mediaType === "movie") {
    if (candidate.runtime === null) problems.push("durée INCONNUE (candidat non enrichi)");
    else if (candidate.runtime > enforce.maxRuntime) problems.push(`${candidate.runtime} min > ${enforce.maxRuntime} min`);
  }

  if (enforce.episodeRuntimeMax !== undefined && candidate.mediaType === "tv") {
    if (candidate.episodeRuntime === null) problems.push("durée d'épisode INCONNUE");
    else if (candidate.episodeRuntime > enforce.episodeRuntimeMax) {
      problems.push(`${candidate.episodeRuntime} min/épisode > ${enforce.episodeRuntimeMax} min`);
    }
  }

  if (enforce.minYear !== undefined) {
    if (candidate.year === null) problems.push("année INCONNUE");
    else if (candidate.year < enforce.minYear) problems.push(`${candidate.year} < ${enforce.minYear}`);
  }
  if (enforce.maxYear !== undefined) {
    if (candidate.year === null) problems.push("année INCONNUE");
    else if (candidate.year > enforce.maxYear) problems.push(`${candidate.year} > ${enforce.maxYear}`);
  }

  if (candidate.mediaType === "tv") {    if (enforce.maxSeasons !== undefined) {
      if (candidate.seasons === null) problems.push("nombre de saisons INCONNU (candidat non enrichi)");
      else if (candidate.seasons > enforce.maxSeasons) problems.push(`${candidate.seasons} saisons > ${enforce.maxSeasons}`);
    }
    if (enforce.minSeasons !== undefined) {
      if (candidate.seasons === null) problems.push("nombre de saisons INCONNU (candidat non enrichi)");
      else if (candidate.seasons < enforce.minSeasons) problems.push(`${candidate.seasons} saisons < ${enforce.minSeasons}`);
    }
    if (enforce.seriesEnded && !isEnded(candidate.status)) {
      problems.push(`statut « ${candidate.status ?? "inconnu"} » ≠ terminée`);
    }
  }

  if (enforce.requireGenres?.length) {
    const ok = enforce.requireGenres.some((genre) => candidate.genres.includes(genre));
    if (!ok) {
      problems.push(
        `aucun genre demandé (${enforce.requireGenres.map((id) => MOVIE_GENRE_NAMES[id] ?? id).join(", ")}) : ${candidate.genreNames.join(", ") || "aucun"}`,
      );
    }
  }

  if (enforce.forbidGenres?.length) {
    const hit = enforce.forbidGenres.filter((genre) => candidate.genres.includes(genre));
    if (hit.length) problems.push(`genre interdit présent : ${hit.map((id) => MOVIE_GENRE_NAMES[id] ?? id).join(", ")}`);
  }

  if (enforce.gemOnly && enforce.applyGem) {
    // Contrat d'une « pépite » (§35) : bien notée, statistiquement crédible,
    // discrète. Vérifié sur LA recommandation principale : c'est elle qui porte
    // la promesse (les alternatives sont là par curiosité).
    if (candidate.voteAverage < 7) problems.push(`note ${candidate.voteAverage} < 7`);
    if (candidate.voteCount < 250) problems.push(`${candidate.voteCount} votes : trop peu pour être crédible`);
    if (candidate.popularity >= 35) problems.push(`popularité ${candidate.popularity.toFixed(1)} : trop connu pour une pépite`);
  }

  // Toute œuvre renvoyée doit être enrichie : un champ inconnu ne prouve rien.
  if (candidate.verified !== true) problems.push("candidat NON enrichi (verified=false)");

  return problems;
}

/** Contrôle ce que le parser a compris. */
function parsedViolations(preferences, expected) {
  const problems = [];
  for (const [key, value] of Object.entries(expected)) {
    const actual = preferences[key];
    if (Array.isArray(value)) {
      const missing = value.filter((item) => !(actual ?? []).includes(item));
      if (missing.length) problems.push(`${key} : ${JSON.stringify(missing)} absent(s) de ${JSON.stringify(actual)}`);
      continue;
    }
    if (actual !== value) problems.push(`${key} : attendu ${JSON.stringify(value)}, obtenu ${JSON.stringify(actual)}`);
  }
  return problems;
}

/** Contrôle la cohérence du classement (l'écran ne doit pas se contredire). */
function rankingViolations(top, alternatives) {
  const problems = [];
  const scores = alternatives.map((item) => item.score);
  for (let index = 1; index < scores.length; index += 1) {
    if (scores[index] > scores[index - 1] + 1e-9) {
      problems.push(`alternatives désordonnées (#${index + 1} > #${index})`);
      break;
    }
  }
  const better = alternatives.filter((item) => item.score > top.score + 1e-9);
  if (better.length) {
    problems.push(`${better.length} alternative(s) mieux notée(s) que la reco principale : ${better.map((item) => item.candidate.title).join(", ")}`);
  }
  return problems;
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`${path} → HTTP ${response.status}`);
  return response.json();
}

function envCredentials() {
  for (const file of [".env.local", ".env"]) {
    try {
      const content = readFileSync(join(ROOT, file), "utf8");
      const match = content.match(/^TMDB_READ_ACCESS_TOKEN=(.+)$/m) ?? content.match(/^TMDB_API_KEY=(.+)$/m);
      if (match && match[1].trim()) return file;
    } catch {
      /* fichier absent : on continue */
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Rapport                                                                    */
/* -------------------------------------------------------------------------- */

const formatDuration = (candidate) => {
  if (candidate.mediaType === "tv") {
    return [
      candidate.seasons !== null ? `${candidate.seasons} saison${candidate.seasons > 1 ? "s" : ""}` : "?",
      candidate.status ?? "?",
      candidate.episodeRuntime !== null ? `≈${candidate.episodeRuntime} min/ép` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return candidate.runtime !== null ? `${Math.floor(candidate.runtime / 60)}h${String(candidate.runtime % 60).padStart(2, "0")}` : "durée ?";
};

function describe(item) {
  const candidate = item.candidate;
  return `${item.matchPercent}% · ${candidate.title} (${candidate.year ?? "?"}, ${formatDuration(candidate)}, ${candidate.voteCount} votes, pop ${candidate.popularity.toFixed(1)})`;
}

/* -------------------------------------------------------------------------- */
/* Exécution                                                                  */
/* -------------------------------------------------------------------------- */

const failures = [];
const warnings = [];

function fail(scope, message) {
  failures.push(`${scope} : ${message}`);
}

async function main() {
  const credentials = envCredentials();
  console.log(`\nTONIGHT : vérification live en vraie grandeur  ·  ${BASE}`);
  console.log(`Identifiants TMDB trouvés : ${credentials ?? "AUCUN"}\n`);

  let status;
  try {
    const response = await fetch(`${BASE}/api/status`, { signal: AbortSignal.timeout(10_000) });
    status = await response.json();
  } catch {
    console.error(
      `❌ Serveur injoignable sur ${BASE}.\n` +
        `   Lance-le d'abord :  npm run build && npm run start\n` +
        `   (ou indique un autre port : npm run verify:live -- --base=http://127.0.0.1:4000)`,
    );
    process.exit(2);
  }

  console.log(`Mode : ${status.mode} · région ${status.region} · langue ${status.language}`);
  if (status.mode !== "tmdb") {
    console.error(
      `❌ Mode « ${status.mode} » : le serveur tourne sur le catalogue de démonstration.\n` +
        `   Renseigne TMDB_READ_ACCESS_TOKEN (ou TMDB_API_KEY) dans .env.local, puis relance le serveur.\n` +
        `   Sans identifiant, cette vérification n'aurait aucune valeur.`,
    );
    process.exit(2);
  }

  const startedAt = Date.now();

  for (const testCase of CASES) {
    console.log(`\n${"─".repeat(78)}`);
    console.log(`▸ ${testCase.label}`);
    console.log(`  « ${testCase.phrase} »`);

    // 1. Compréhension de la phrase.
    const parsed = await post("/api/parse", { query: testCase.phrase });
    const chips = (parsed.chips ?? []).map((chip) => chip.label);
    console.log(`  Compris : ${chips.join(" · ")} (confiance ${parsed.preferences.confidence})`);

    const parseProblems = parsedViolations(parsed.preferences, testCase.parsed);
    for (const problem of parseProblems) fail(`${testCase.label} [parser]`, problem);

    // 2. Recommandation + contraintes, sur plusieurs tirages (§36 : la variété
    //    ne doit jamais faire sortir du contrat).
    for (const seed of SEEDS) {
      const startedAtSeed = Date.now();
      const response = await post("/api/recommend", {
        preferences: { ...parsed.preferences, source: "natural_language" },
        count: COUNT,
        seed,
      });
      const elapsed = Date.now() - startedAtSeed;
      const scope = `${testCase.label} [seed ${seed}]`;

      if (response.error) {
        fail(scope, `erreur renvoyée par l'API : ${response.error}`);
        continue;
      }
      if (!response.top) {
        fail(scope, `aucune recommandation (pool ${response.poolSize}, vide=${response.empty})`);
        continue;
      }

      const top = response.top;
      const alternatives = response.alternatives ?? [];
      const all = [top, ...alternatives];
      const applied = response.appliedPreferences ?? parsed.preferences;

      console.log(`  seed ${seed} · ${(elapsed / 1000).toFixed(1)} s · pool ${response.poolSize}`);
      console.log(`    ${describe(top)}`);

      // Une contrainte dure lâchée sans être annoncée est la seule vraie trahison.
      for (const problem of silentBreaks(testCase.enforce, applied, response.relaxations)) fail(scope, problem);

      // Contraintes dures sur CHAQUE œuvre renvoyée, pas seulement la première,
      // et contre le contrat EFFECTIF (celui que TONIGHT a réellement promis).
      const contract = effectiveContract(testCase.enforce, applied);
      for (const item of all) {
        const effective = { ...contract, applyGem: item === top };
        for (const problem of violations(item.candidate, effective)) {
          fail(scope, `${item.candidate.title} : ${problem}`);
        }
      }

      for (const problem of rankingViolations(top, alternatives)) fail(scope, problem);

      // Un écran sans affiche ni backdrop n'est pas présentable (§56).
      if (!top.candidate.posterPath) fail(scope, `affiche absente sur ${top.candidate.title}`);
      if (!top.candidate.backdropPath) fail(scope, `backdrop absent sur ${top.candidate.title}`);

      // L'assouplissement doit être ANNONCÉ quand il a servi (§37).
      if (response.relaxations?.length) {
        warnings.push(`${scope} : critères assouplis : ${response.relaxations.map((item) => item.message).join(" ; ")}`);
      }

      const slow = elapsed > 12_000;
      if (slow) warnings.push(`${scope} : ${(elapsed / 1000).toFixed(1)} s : latence élevée pour une reco`);

      const titles = alternatives.slice(0, 5).map((item) => `${item.candidate.title} (${item.matchPercent}%)`);
      if (titles.length) console.log(`    Puis : ${titles.join(", ")}`);

      await sleep(150);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Verdict                                                                */
  /* ---------------------------------------------------------------------- */

  console.log(`\n${"═".repeat(78)}`);
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const checks = CASES.length * SEEDS.length;

  if (warnings.length) {
    console.log(`\n⚠️  ${warnings.length} avertissement(s) :`);
    for (const warning of warnings) console.log(`  · ${warning}`);
  }

  if (failures.length === 0) {
    console.log(`\n✅ ${checks} recommandations vérifiées en ${seconds} s : aucune contrainte dure cassée.`);
    console.log("   Phrases comprises, contraintes appliquées, classement cohérent, données enrichies.\n");
    process.exit(0);
  }

  console.log(`\n❌ ${failures.length} violation(s) sur ${checks} recommandations (${seconds} s) :`);
  for (const failure of failures) console.log(`  · ${failure}`);
  console.log("");
  process.exit(1);
}

main().catch((error) => {
  console.error(`\n❌ Échec inattendu : ${error?.stack ?? error}\n`);
  process.exit(2);
});
