"use client";

import { ResultView } from "@/components/ResultView";

/**
 * Écran résultat (§38, §39).
 * En cas de rechargement ou de réponse API momentanément indisponible, on
 * laisse ResultView afficher une issue de secours au lieu de déclencher une
 * redirection client fragile sur le runtime edge.
 */
export default function ResultatPage() {
  return (
    <div className="space-y-8">
      <ResultView />
    </div>
  );
}
