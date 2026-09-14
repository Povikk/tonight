"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/** Bouton principal / secondaire / discret, cohérent partout. */
export function TonightButton({
  children,
  onClick,
  href,
  variant = "primary",
  size = "md",
  disabled,
  type = "button",
  ariaLabel,
  fullWidth,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "soft" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  type?: "button" | "submit";
  ariaLabel?: string;
  fullWidth?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-3 disabled:opacity-40 disabled:cursor-not-allowed select-none";
  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-2.5 text-[0.95rem]",
    lg: "px-7 py-3.5 text-base sm:text-lg",
  } as const;
  const variants = {
    primary:
      "bg-chalk text-ink hover:bg-white hover:-translate-y-0.5 shadow-[0_10px_30px_-12px_rgba(246,243,237,0.5)]",
    soft: "bg-night-soft text-chalk border border-night-line hover:border-violet/60 hover:-translate-y-0.5",
    ghost: "text-muted hover:text-chalk border border-transparent hover:border-night-line",
    danger: "border border-danger/40 text-danger hover:bg-danger/10",
  } as const;

  const className = `${base} ${sizes[size]} ${variants[variant]} ${fullWidth ? "w-full" : ""}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

/** Petit tag statique. */
export function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "accent";
  className?: string;
}) {
  const tones = {
    neutral: "border-night-line bg-night/70 text-chalk",
    positive: "border-good/30 bg-good/10 text-good",
    negative: "border-danger/30 bg-danger/10 text-danger",
    accent: "border-violet/40 bg-violet/10 text-violet-soft",
  } as const;
  return <span className={`t-chip ${tones[tone]} ${className}`}>{children}</span>;
}

/** Bloc de contenu avec fond translucide. */
export function Surface({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return <Tag className={`t-panel p-5 sm:p-6 ${className}`}>{children}</Tag>;
}

/** Titre de section discret et typographique. */
export function SectionTitle({
  children,
  hint,
  id,
}: {
  children: ReactNode;
  hint?: string;
  id?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="font-display text-xl font-semibold tracking-tight text-chalk sm:text-2xl">
        {children}
      </h2>
      {hint ? <p className="text-sm text-muted-dim">{hint}</p> : null}
    </div>
  );
}

/** État vide, jamais un écran cassé. */
export function EmptyState({
  emoji = "🌙",
  title,
  description,
  action,
}: {
  emoji?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="t-panel flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span aria-hidden className="text-4xl">
        {emoji}
      </span>
      <h3 className="font-display text-lg font-semibold text-chalk">{title}</h3>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action}
    </div>
  );
}
