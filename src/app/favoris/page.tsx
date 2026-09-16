"use client";

import Link from "next/link";
import { favoritesStore, removeFavorite } from "@/storage";
import { useLocalStore } from "@/hooks/useLocalStore";
import { PosterImage } from "@/components/PosterImage";
import { EmptyState, SectionTitle, TonightButton } from "@/components/ui";
import { formatRating, formatYear } from "@/utils/format";
import type { FavoriteEntry } from "@/storage/favorites";

/** MES FAVORIS (§48) : deux sections, une grille élégante. */
export default function FavorisPage() {
  const { value: favorites, hydrated } = useLocalStore(favoritesStore);

  const movies = favorites.filter((entry) => entry.mediaType === "movie");
  const series = favorites.filter((entry) => entry.mediaType === "tv");

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-dim">Mes favoris</p>
        <h1 className="font-display text-2xl font-semibold text-chalk sm:text-3xl">
          Ce que tu as mis de côté
        </h1>
        <p className="text-sm text-muted">Tes favoris restent sur cet appareil.</p>
      </header>

      {!hydrated ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="t-skeleton aspect-2/3 rounded-2xl" />
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState
          emoji="❤️"
          title="Aucun favori pour l'instant."
          description="Quand une recommandation te plaît, mets-la de côté : je m'en servirai pour affiner mes propositions."
          action={<TonightButton href="/">Trouver quelque chose</TonightButton>}
        />
      ) : (
        <>
          <section aria-labelledby="fav-films">
            <SectionTitle id="fav-films" hint={`${movies.length} film${movies.length > 1 ? "s" : ""}`}>
              🎬 Films
            </SectionTitle>
            {movies.length ? (
              <FavoriteGrid entries={movies} />
            ) : (
              <p className="text-sm text-muted-dim">Pas encore de film en favori.</p>
            )}
          </section>

          <section aria-labelledby="fav-series">
            <SectionTitle id="fav-series" hint={`${series.length} série${series.length > 1 ? "s" : ""}`}>
              📺 Séries
            </SectionTitle>
            {series.length ? (
              <FavoriteGrid entries={series} />
            ) : (
              <p className="text-sm text-muted-dim">Pas encore de série en favori.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function FavoriteGrid({ entries }: { entries: FavoriteEntry[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {entries.map((entry) => (
        <li key={entry.key}>
          <Link
            href={`/${entry.mediaType === "movie" ? "film" : "serie"}/${entry.id}`}
            className="group block overflow-hidden rounded-2xl border border-night-line bg-night/60 transition-transform hover:-translate-y-1 hover:border-violet/50"
          >
            <span className="relative block aspect-2/3 w-full overflow-hidden">
              <PosterImage
                path={entry.posterPath}
                title={entry.title}
                mediaType={entry.mediaType}
                sizes="(max-width: 480px) 45vw, 200px"
                className="h-full w-full object-cover"
              />
            </span>
            <span className="block space-y-0.5 p-3">
              <span className="line-clamp-2 block font-display text-sm font-semibold leading-tight text-chalk">
                {entry.title}
              </span>
              <span className="block text-xs text-muted-dim">
                {formatYear(entry.year)} · ⭐ {formatRating(entry.voteAverage)}
                {entry.ratingSource === "imdb" ? " IMDb" : ""}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => removeFavorite(entry.key)}
            className="mt-2 w-full rounded-full border border-night-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-danger/50 hover:text-danger"
          >
            Retirer des favoris
          </button>
        </li>
      ))}
    </ul>
  );
}
