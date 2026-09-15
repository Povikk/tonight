"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isFavorite, recordRecommendation, toggleFavorite } from "@/storage";
import { PosterImage } from "@/components/PosterImage";
import { EmptyState } from "@/components/ui";
import { formatRating, formatSeriesYears, formatYear, mediaLabel } from "@/utils/format";
import type { Candidate } from "@/types/tonight";

/**
 * Recherche manuelle (§54). Elle sert aussi la personnalisation : on peut
 * marquer « déjà vu », « favori » ou « pas intéressé » directement ici.
 */
export default function RecherchePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&mediaType=any`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as { results?: Candidate[]; error?: string };
        setResults(payload.results ?? []);
        if (payload.error) setError(payload.error);
      } catch (fetchError) {
        if ((fetchError as Error).name !== "AbortError") setError("La recherche n'a pas abouti.");
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const mark = (candidate: Candidate, status: "watched" | "refused" | "favorite") => {
    const key = `${candidate.mediaType}:${candidate.id}`;
    if (status === "favorite") {
      toggleFavorite({
        key,
        id: candidate.id,
        mediaType: candidate.mediaType,
        title: candidate.title,
        year: candidate.year,
        posterPath: candidate.posterPath,
        voteAverage: candidate.voteAverage,
        genres: candidate.genres,
      });
    } else {
      // Un résultat de recherche manuelle n'est généralement pas encore dans
      // l'historique : `updateHistoryStatus` seul ne stockait donc rien et le
      // « Noté ✓ » était mensonger. On enregistre l'entrée (upsert).
      recordRecommendation({
        key,
        id: candidate.id,
        mediaType: candidate.mediaType,
        title: candidate.title,
        originalTitle: candidate.originalTitle,
        year: candidate.year,
        posterPath: candidate.posterPath,
        overview: candidate.overview,
        genres: candidate.genres,
        matchPercent: 0,
        status,
        runtime: candidate.runtime,
        seasons: candidate.seasons,
        popularity: candidate.popularity,
        providers: candidate.providers.map((provider) => provider.providerId),
      });
    }
    setTouched((previous) => new Set(previous).add(`${key}:${status}`));
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-dim">Recherche manuelle</p>
        <h1 className="font-display text-2xl font-semibold text-chalk sm:text-3xl">
          Je sais déjà quoi chercher
        </h1>
        <p className="text-sm text-muted">
          Cherche un titre précis, ouvre sa fiche, et dis-moi ce que tu en penses : ça nourrit tes goûts.
        </p>
      </header>

      <div>
        <label htmlFor="search" className="sr-only">
          Rechercher un film ou une série
        </label>
        <input
          id="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Titre d'un film ou d'une série…"
          className="w-full rounded-2xl border border-night-line bg-night/70 px-5 py-4 font-display text-lg text-chalk placeholder:text-muted-dim focus:border-violet/60 focus:outline-none"
          autoComplete="off"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading ? <p className="text-sm text-muted">Je cherche…</p> : null}

      {!loading && query.trim().length >= 2 && results.length === 0 ? (
        <EmptyState emoji="🔎" title="Rien trouvé avec ce titre." description="Essaie un autre orthographe, ou le titre original." />
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {results.map((candidate) => {
          const key = `${candidate.mediaType}:${candidate.id}`;
          const favorite = isFavorite(candidate.mediaType, candidate.id);
          return (
            <li key={key} className="t-panel flex gap-4 p-3">
              <Link
                href={`/${candidate.mediaType === "movie" ? "film" : "serie"}/${candidate.id}`}
                className="block h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-night-line/70"
              >
                <PosterImage
                  path={candidate.posterPath}
                  title={candidate.title}
                  mediaType={candidate.mediaType}
                  sizes="80px"
                  className="h-full w-full object-cover"
                />
              </Link>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <Link
                    href={`/${candidate.mediaType === "movie" ? "film" : "serie"}/${candidate.id}`}
                    className="font-display text-base font-semibold text-chalk hover:underline"
                  >
                    {candidate.title}
                  </Link>
                  <p className="text-xs text-muted-dim">
                    {mediaLabel(candidate.mediaType)} ·{" "}
                    {candidate.mediaType === "movie" ? formatYear(candidate.year) : formatSeriesYears(candidate)} ·
                    ⭐ {formatRating(candidate.voteAverage)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => mark(candidate, "favorite")}
                    className={`rounded-full border px-3 py-1.5 transition-colors ${
                      favorite ? "border-violet bg-violet/20 text-chalk" : "border-night-line text-muted hover:text-chalk"
                    }`}
                  >
                    {favorite ? "❤️ Favori" : "🤍 Favori"}
                  </button>
                  <button
                    type="button"
                    onClick={() => mark(candidate, "watched")}
                    className="rounded-full border border-night-line px-3 py-1.5 text-muted transition-colors hover:text-chalk"
                  >
                    {touched.has(`${key}:watched`) ? "👁️ Noté ✓" : "👁️ Déjà vu"}
                  </button>
                  <button
                    type="button"
                    onClick={() => mark(candidate, "refused")}
                    className="rounded-full border border-night-line px-3 py-1.5 text-muted transition-colors hover:border-danger/50 hover:text-danger"
                  >
                    {touched.has(`${key}:refused`) ? "🚫 Noté ✓" : "🚫 Pas intéressé"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
