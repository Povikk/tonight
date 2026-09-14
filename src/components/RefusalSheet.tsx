"use client";

import { useState } from "react";
import { REFUSAL_OPTIONS } from "@/recommendation/personalizationScore";
import { addFeedback, recordRecommendation, updateHistoryStatus } from "@/storage";
import type { RefusalReason, ScoredCandidate } from "@/types/tonight";
import { TonightButton } from "./ui";

/**
 * « Pourquoi pas celui-là ? » (§43).
 * Les raisons choisies ajustent immédiatement les propositions suivantes.
 */
export function RefusalSheet({
  offer,
  open,
  onClose,
  onRefused,
}: {
  offer: ScoredCandidate;
  open: boolean;
  onClose: () => void;
  onRefused: () => void;
}) {
  const [selected, setSelected] = useState<RefusalReason[]>([]);

  if (!open) return null;

  const toggle = (reason: RefusalReason) => {
    setSelected((previous) =>
      previous.includes(reason) ? previous.filter((item) => item !== reason) : [...previous, reason],
    );
  };

  const submit = (reasons: RefusalReason[]) => {
    const candidate = offer.candidate;
    addFeedback({
      candidateId: candidate.id,
      mediaType: candidate.mediaType,
      title: candidate.title,
      reasons,
    });
    recordRecommendation({
      key: `${candidate.mediaType}:${candidate.id}`,
      id: candidate.id,
      mediaType: candidate.mediaType,
      title: candidate.title,
      originalTitle: candidate.originalTitle,
      year: candidate.year,
      posterPath: candidate.posterPath,
      overview: candidate.overview,
      genres: candidate.genres,
      matchPercent: offer.matchPercent,
      status: "refused",
      refusalReasons: reasons,
      runtime: candidate.runtime,
      seasons: candidate.seasons,
      popularity: candidate.popularity,
    });
    updateHistoryStatus(`${candidate.mediaType}:${candidate.id}`, "refused", reasons);
    setSelected([]);
    onRefused();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="refusal-title"
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-0 backdrop-blur-md sm:items-center sm:p-6"
    >
      <div className="t-panel animate-fade-up max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-b-none p-6 sm:rounded-3xl">
        <h2 id="refusal-title" className="font-display text-xl font-semibold text-chalk">
          Qu'est-ce qui ne te plaît pas ?
        </h2>
        <p className="mt-1 text-sm text-muted">
          Réponds vite (ou pas du tout) : je m'en sers tout de suite pour la proposition suivante.
        </p>

        <ul className="mt-5 flex flex-wrap gap-2">
          {REFUSAL_OPTIONS.map((option) => {
            const active = selected.includes(option.reason);
            return (
              <li key={option.reason}>
                <button
                  type="button"
                  onClick={() => toggle(option.reason)}
                  aria-pressed={active}
                  className={`t-chip ${active ? "border-violet bg-violet/20 text-chalk" : "text-muted hover:text-chalk"}`}
                >
                  <span aria-hidden>{option.emoji}</span>
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <TonightButton
            onClick={() => submit(selected)}
            disabled={selected.length === 0}
            size="md"
          >
            C'est noté → un autre
          </TonightButton>
          <TonightButton variant="soft" onClick={() => submit([])}>
            🎲 Un autre sans rien dire
          </TonightButton>
          <TonightButton variant="ghost" onClick={onClose}>
            Annuler
          </TonightButton>
        </div>
      </div>
    </div>
  );
}
