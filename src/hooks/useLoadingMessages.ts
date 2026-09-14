"use client";

import { useEffect, useState } from "react";

/**
 * Petites phrases TONIGHT pendant la recherche (§58).
 * Ce ne sont PAS des attentes artificielles : le rythme suit la vraie requête,
 * on se contente de rendre l'attente lisible et complice.
 */
export const TONIGHT_LOADING_MESSAGES = [
  "Je cherche…",
  "Ok, je vois le genre.",
  "Deux secondes, j'élimine les navets.",
  "J'hésite entre deux…",
  "J'ai trouvé ton programme.",
];

export function useLoadingMessages(active: boolean, intervalMs = 1100): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((previous) => Math.min(previous + 1, TONIGHT_LOADING_MESSAGES.length - 1));
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs]);

  return TONIGHT_LOADING_MESSAGES[Math.min(index, TONIGHT_LOADING_MESSAGES.length - 1)];
}
