"use client";

import { useTonight } from "./providers/TonightProvider";

/**
 * Mode démo : aucun token TMDB n'est configuré.
 * On le dit clairement plutôt que de faire croire à des données incomplètes.
 */
export function DemoBanner() {
  const { mode } = useTonight();
  if (mode !== "demo") return null;

  return (
    <aside className="animate-fade-in rounded-2xl border border-amber/30 bg-amber/5 px-4 py-3 text-sm text-amber">
      <strong className="font-semibold">Mode démo.</strong> Aucun token TMDB n'est configuré : TONIGHT
      tourne sur un catalogue local d'environ 120 titres réels. Tout fonctionne (parser, score,
      favoris, historique), mais les affiches TMDB et le catalogue complet reviennent dès que tu
      renseignes <code className="rounded bg-ink/60 px-1">TMDB_API_KEY</code> dans{" "}
      <code className="rounded bg-ink/60 px-1">.env.local</code>.
    </aside>
  );
}
