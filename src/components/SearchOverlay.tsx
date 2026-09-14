"use client";

import { useEffect, useState } from "react";
import { useLoadingMessages } from "@/hooks/useLoadingMessages";
import { useTonight } from "./providers/TonightProvider";

/**
 * Voile de recherche (§58).
 *
 * POURQUOI UN VOILE GLOBAL
 * ------------------------
 * Une recherche TMDB prend 1 à 3 secondes (pool discover + enrichissement des
 * candidats). Jusqu'ici, seuls l'écran résultat et YOLO montraient quelque
 * chose : depuis la page « J'ai compris », un questionnaire ou Express, le
 * bouton restait inerte et on pouvait croire que rien ne s'était passé.
 *
 * Le voile vit dans le layout, dans le contexte TONIGHT : il s'affiche donc
 * au-dessus de N'IMPORTE QUELLE page qui déclenche une recherche, sans
 * dupliquer l'état de chargement dans chaque écran.
 *
 * Deux précautions :
 *  - un très court délai d'apparition, pour ne pas faire clignoter un voile
 *    plein écran sur une réponse immédiate (cache mémoire) ;
 *  - aucune attente artificielle : dès que la requête répond, il disparaît.
 */
export function SearchOverlay() {
  const { loading } = useTonight();
  const [visible, setVisible] = useState(false);
  const message = useLoadingMessages(visible);

  useEffect(() => {
    if (!loading) {
      setVisible(false);
      return;
    }
    // 220 ms : suffisant pour absorber les réponses instantanées, assez court
    // pour que l'utilisateur voie immédiatement que TONIGHT travaille.
    const timer = window.setTimeout(() => setVisible(true), 220);
    return () => window.clearTimeout(timer);
  }, [loading]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="animate-fade-in fixed inset-0 z-[70] flex items-center justify-center bg-ink/90 px-6 backdrop-blur-md"
    >
      <div aria-hidden className="t-aurora opacity-60" />
      <div className="relative w-full max-w-md space-y-5 text-center">
        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          <span aria-hidden className="absolute inset-0 rounded-full border border-night-line" />
          <span
            aria-hidden
            className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-violet border-r-violet/30"
            style={{ animationDuration: "1.1s" }}
          />
          <span aria-hidden className="font-display text-2xl">
            🍿
          </span>
        </div>

        <p className="font-display text-xl font-semibold text-chalk t-balance sm:text-2xl">{message}</p>

        <div aria-hidden className="t-skeleton mx-auto h-1.5 w-4/5 rounded-full" />

        <p className="text-xs uppercase tracking-[0.25em] text-muted-dim">
          Tonight regarde ce qui passe en France
        </p>
      </div>
    </div>
  );
}
