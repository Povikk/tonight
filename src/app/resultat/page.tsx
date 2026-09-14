"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ResultView } from "@/components/ResultView";
import { useTonight } from "@/components/providers/TonightProvider";

/**
 * Écran résultat (§38, §39).
 * Il n'est accessible qu'après une recherche : sinon retour à l'accueil.
 */
export default function ResultatPage() {
  const router = useRouter();
  const { loading, offers, runSearch } = useTonight();

  useEffect(() => {
    if (!loading && offers.length === 0) {
      // Arrivée directe sur l'URL : on relance une recherche par défaut.
      router.replace("/");
    }
  }, [loading, offers.length, router, runSearch]);

  return (
    <div className="space-y-8">
      <ResultView />
    </div>
  );
}
