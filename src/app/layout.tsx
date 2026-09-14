import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { FirstLaunchOverlay } from "@/components/FirstLaunchOverlay";
import { SearchOverlay } from "@/components/SearchOverlay";
import { TonightProvider } from "@/components/providers/TonightProvider";
import { TonightLogo } from "@/components/TonightLogo";

export const metadata: Metadata = {
  title: {
    default: "TONIGHT. Arrête de chercher. Choisis.",
    template: "%s · TONIGHT.",
  },
  description:
    "TONIGHT analyse ce que tu as envie de regarder ce soir, cherche ce qui est disponible et te recommande UNE œuvre. Moins de choix. Plus de soirées.",
  applicationName: "TONIGHT",
  keywords: ["film", "série", "streaming", "recommandation", "quoi regarder ce soir"],
};

export const viewport: Viewport = {
  themeColor: "#04050a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh">
        <TonightProvider>
          <FirstLaunchOverlay />
          {/* Voile global : visible dès qu'une recherche est en cours, quelle que
              soit la page qui l'a déclenchée (§58). */}
          <SearchOverlay />
          <Navigation />
          <main id="contenu" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-16">
            {children}
          </main>
          <footer className="mx-auto max-w-6xl px-4 pb-24 text-xs text-muted-dim sm:px-6 md:pb-10">
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-night-line/60 pt-5">
              <TonightLogo size="sm" asLink={false} />
              <div className="max-w-xl space-y-1 leading-relaxed">
                <p>
                  Tes préférences restent sur cet appareil. Données de films et de séries fournies
                  par TMDB. Disponibilités issues de JustWatch via TMDB.
                </p>
                {/*
                  Attribution exigée par les conditions d'utilisation de TMDB
                  (notice à afficher telle quelle, de façon visible).
                */}
                <p>
                  This product uses the TMDB API but is not endorsed or certified by TMDB. Ce produit
                  utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.
                </p>
              </div>
              <div className="flex gap-3">
                <Link href="/reglages" className="hover:text-chalk">
                  Réglages
                </Link>
                <Link href="/recherche" className="hover:text-chalk">
                  Recherche
                </Link>
              </div>
            </div>
          </footer>
        </TonightProvider>
      </body>
    </html>
  );
}
