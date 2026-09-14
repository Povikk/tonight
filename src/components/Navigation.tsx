"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TonightLogo } from "./TonightLogo";

const LINKS = [
  { href: "/", label: "Accueil", emoji: "🌙" },
  { href: "/film", label: "Film", emoji: "🎬" },
  { href: "/serie", label: "Série", emoji: "📺" },
  { href: "/express", label: "Express", emoji: "⚡" },
  { href: "/yolo", label: "YOLO", emoji: "🎲" },
  { href: "/favoris", label: "Favoris", emoji: "❤️" },
  { href: "/historique", label: "Historique", emoji: "📜" },
  { href: "/mes-gouts", label: "Mes goûts", emoji: "🧠" },
];

/** Navigation principale : barre haute (desktop) + barre pouce (mobile). */
export function Navigation() {
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-night-line/60 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <TonightLogo size="sm" />
          <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`rounded-full px-3 py-2 text-sm transition-colors ${
                  isActive(link.href)
                    ? "bg-night-soft text-chalk"
                    : "text-muted hover:text-chalk hover:bg-night-soft/60"
                }`}
              >
                <span aria-hidden className="mr-1.5">
                  {link.emoji}
                </span>
                {link.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/recherche"
            className="rounded-full border border-night-line px-3 py-2 text-sm text-muted transition-colors hover:text-chalk"
            aria-label="Rechercher un film ou une série précis"
          >
            🔎 <span className="hidden sm:inline">Rechercher</span>
          </Link>
        </div>
      </header>

      {/* Barre mobile : utilisable au pouce, sans scroll horizontal. */}
      <nav
        aria-label="Navigation mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-night-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="flex items-stretch justify-between px-1">
          {[LINKS[0], LINKS[1], LINKS[2], LINKS[4], LINKS[7]].map((link) => (
            <li key={link.href} className="flex-1">
              <Link
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-1 py-2.5 text-[0.68rem] ${
                  isActive(link.href) ? "text-chalk" : "text-muted-dim"
                }`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {link.emoji}
                </span>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
