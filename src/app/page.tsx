import Link from "next/link";
import { DemoBanner } from "@/components/DemoBanner";
import { HomeSearch } from "@/components/HomeSearch";
import { TonightLogo } from "@/components/TonightLogo";

/**
 * Page d'accueil (§3) : sombre, premium, très simple.
 * Le champ de recherche est l'élément dominant.
 */
export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-night-line/60 px-5 py-12 sm:px-10 sm:py-16">
        <div aria-hidden className="t-aurora" />
        <div aria-hidden className="t-grain absolute inset-0" />

        <div className="relative space-y-8">
          <div className="space-y-4">
            <TonightLogo size="lg" asLink={false} />
            <h1 className="font-display text-2xl font-semibold tracking-tight text-chalk t-balance sm:text-3xl">
              Arrête de chercher. Choisis.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Moins de choix. Plus de soirées. Tu m'expliques ton envie, je te sors{" "}
              <span className="text-chalk">un seul</span> programme, et si ça ne te va pas, j'en ai un autre.
            </p>
          </div>

          <HomeSearch />
        </div>
      </section>

      <DemoBanner />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/film", emoji: "🎬", label: "CHOISIR UN FILM", hint: "6 questions, 30 secondes" },
          { href: "/serie", emoji: "📺", label: "CHOISIR UNE SÉRIE", hint: "engagement, format, mood" },
          { href: "/express", emoji: "⚡", label: "TONIGHT EXPRESS", hint: "une recommandation en 10 s" },
          { href: "/yolo", emoji: "🎲", label: "YOLO", hint: "fais-moi confiance" },
        ].map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="t-panel group flex flex-col gap-1 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-violet/50"
          >
            <span aria-hidden className="text-2xl">
              {entry.emoji}
            </span>
            <span className="font-display text-sm font-semibold tracking-wide text-chalk">{entry.label}</span>
            <span className="text-xs text-muted-dim">{entry.hint}</span>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {[
          {
            title: "Une seule reco",
            body: "TONIGHT ne t'affiche pas 47 films. Il t'en conseille un, explique pourquoi, et n'en propose un autre que si tu le demandes.",
          },
          {
            title: "Compris en français",
            body: "« Pas triste », « pas trop long », « que je connais pas », « avec une vraie fin » : les négations et les nuances sont interprétées.",
          },
          {
            title: "Tes goûts, chez toi",
            body: "Historique, favoris, refus : tout est enregistré dans ton navigateur. Aucun compte, aucune donnée envoyée à un service tiers.",
          },
        ].map((card) => (
          <article key={card.title} className="space-y-2">
            <h2 className="font-display text-base font-semibold text-chalk">{card.title}</h2>
            <p className="text-sm leading-relaxed text-muted-dim">{card.body}</p>
          </article>
        ))}
      </section>

      <section className="t-panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-display text-base font-semibold text-chalk">Tu ne sais pas du tout ?</p>
          <p className="text-sm text-muted">Trois questions, zéro effort, une vraie réponse.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/express"
            className="rounded-full border border-night-line px-4 py-2 text-muted transition-colors hover:text-chalk"
          >
            ⚡ TONIGHT EXPRESS
          </Link>
          <Link
            href="/yolo"
            className="rounded-full border border-night-line px-4 py-2 text-muted transition-colors hover:text-chalk"
          >
            🎲 YOLO
          </Link>
        </div>
      </section>
    </div>
  );
}
