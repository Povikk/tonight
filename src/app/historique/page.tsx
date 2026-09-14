"use client";

import Link from "next/link";
import {
  HISTORY_STATUS_LABELS,
  historyStore,
  removeHistoryEntry,
  updateHistoryStatus,
  type HistoryStatus,
} from "@/storage";
import { reasonLabel } from "@/recommendation/personalizationScore";
import { useLocalStore } from "@/hooks/useLocalStore";
import { PosterImage } from "@/components/PosterImage";
import { EmptyState, TonightButton } from "@/components/ui";
import { formatDate, formatYear, mediaLabel } from "@/utils/format";

const STATUSES: HistoryStatus[] = ["accepted", "watched", "favorite", "refused"];

/** HISTORIQUE (§47) : tout ce que TONIGHT t'a proposé, statut modifiable. */
export default function HistoriquePage() {
  const { value: history, hydrated } = useLocalStore(historyStore);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-dim">Historique</p>
        <h1 className="font-display text-2xl font-semibold text-chalk sm:text-3xl">
          Tout ce que je t'ai proposé
        </h1>
        <p className="text-sm text-muted">
          Corrige un statut à tout moment : c'est ce qui rend les prochaines recommandations meilleures.
        </p>
      </header>

      {!hydrated ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="t-skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <EmptyState
          emoji="📜"
          title="Rien dans l'historique."
          description="Dès qu'une recommandation t'est faite, elle apparaît ici, avec ce que tu en as fait."
          action={<TonightButton href="/">Lancer une recherche</TonightButton>}
        />
      ) : (
        <ul className="space-y-3">
          {history.map((entry) => (
            <li key={entry.key} className="t-panel flex gap-4 p-3 sm:p-4">
              <Link
                href={`/${entry.mediaType === "movie" ? "film" : "serie"}/${entry.id}`}
                className="block h-24 w-16 shrink-0 overflow-hidden rounded-xl border border-night-line/70 sm:h-28 sm:w-20"
              >
                <PosterImage
                  path={entry.posterPath}
                  title={entry.title}
                  mediaType={entry.mediaType}
                  sizes="80px"
                  className="h-full w-full object-cover"
                />
              </Link>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="font-display text-base font-semibold text-chalk">{entry.title}</h2>
                  <span className="text-xs text-muted-dim">
                    {mediaLabel(entry.mediaType)} · {formatYear(entry.year)} · {formatDate(entry.recommendedAt)}
                    {entry.matchPercent ? ` · ${entry.matchPercent} % match` : ""}
                  </span>
                </div>

                {entry.refusalReasons?.length ? (
                  <p className="text-xs text-danger">
                    Refusé : {entry.refusalReasons.map((reason) => reasonLabel(reason)).join(", ")}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((status) => {
                    const active = entry.status === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        aria-pressed={active}
                        onClick={() => updateHistoryStatus(entry.key, status)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          active
                            ? "border-violet bg-violet/20 text-chalk"
                            : "border-night-line text-muted hover:text-chalk"
                        }`}
                      >
                        {HISTORY_STATUS_LABELS[status]}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => removeHistoryEntry(entry.key)}
                    className="rounded-full border border-night-line px-3 py-1.5 text-xs text-muted-dim transition-colors hover:border-danger/50 hover:text-danger"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
