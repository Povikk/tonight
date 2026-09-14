"use client";

import type { ReactNode } from "react";

/**
 * Gros bouton de choix utilisé dans tous les questionnaires.
 * Pensé d'abord pour le pouce sur mobile (§60).
 */
export function SelectCard({
  emoji,
  label,
  hint,
  selected = false,
  multi = false,
  onClick,
  disabled = false,
}: {
  emoji?: string;
  label: string;
  hint?: string;
  selected?: boolean;
  multi?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={multi ? selected : undefined}
      className={`group flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-200 disabled:opacity-40 ${
        selected
          ? "border-violet bg-violet/15 shadow-[0_16px_40px_-24px_rgba(123,108,255,0.9)]"
          : "border-night-line bg-night/60 hover:border-chalk/40 hover:bg-night-soft/70"
      }`}
    >
      {emoji ? (
        <span aria-hidden className="text-2xl leading-none">
          {emoji}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-semibold tracking-tight text-chalk sm:text-[1.05rem]">
          {label}
        </span>
        {hint ? <span className="mt-0.5 block text-sm text-muted">{hint}</span> : null}
      </span>
      <span
        aria-hidden
        className={`shrink-0 text-sm transition-colors ${
          selected ? "text-violet-soft" : "text-muted-dim group-hover:text-chalk"
        }`}
      >
        {selected ? (multi ? "✓" : "●") : "○"}
      </span>
    </button>
  );
}

/** Écran de question : une question principale par écran (§16). */
export function QuestionScreen({
  step,
  total,
  question,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = "SUIVANT",
  nextDisabled = false,
  multiHint,
}: {
  step: number;
  total: number;
  question: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  multiHint?: string;
}) {
  return (
    <section className="animate-fade-up space-y-6" aria-live="polite">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-night-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-chalk"
              aria-label="Revenir à la question précédente"
            >
              ← Retour
            </button>
          ) : null}
          <p className="text-xs uppercase tracking-[0.18em] text-muted-dim">
            Étape {step} / {total}
          </p>
        </div>

        {/* Progression discrète */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={step}
          className="h-1 w-full overflow-hidden rounded-full bg-night-soft"
        >
          <div
            className="t-progress-fill h-full rounded-full bg-gradient-to-r from-violet to-violet-soft"
            style={{ width: `${Math.round((step / total) * 100)}%` }}
          />
        </div>

        <h1 className="font-display text-2xl font-semibold tracking-tight text-chalk t-balance sm:text-3xl">
          {question}
        </h1>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </header>

      <div className="space-y-3">{children}</div>

      {multiHint ? <p className="text-xs text-muted-dim">{multiHint}</p> : null}

      {onNext ? (
        <div className="pt-2">
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="inline-flex w-full items-center justify-center rounded-full bg-chalk px-6 py-3.5 font-semibold text-ink transition-all hover:-translate-y-0.5 disabled:opacity-40 sm:w-auto"
          >
            {nextLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
}
