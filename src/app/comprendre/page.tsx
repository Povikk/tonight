"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { UnderstoodChips } from "@/components/UnderstoodChips";
import { DemoBanner } from "@/components/DemoBanner";
import { TonightButton } from "@/components/ui";
import { useTonight } from "@/components/providers/TonightProvider";

/**
 * Écran « J'ai compris » (§14) : ce que TONIGHT a retenu, éditable, puis la
 * recherche. C'est le passage obligé d'une demande en langage naturel.
 */
export default function ComprendrePage() {
  const router = useRouter();
  const { chips, preferences, removeCriterion, setPreferences, runSearch, query } = useTonight();

  // Aucun critère n'a été produit (accès direct à l'URL) : on renvoie à l'accueil.
  useEffect(() => {
    if (chips.length === 0 && !query) router.replace("/");
  }, [chips.length, query, router]);

  const launch = async () => {
    // Nouvelle demande explicite : on repart d'une liste d'exclusions vierge.
    // Sans cela, les propositions écartées lors des recherches précédentes
    // s'accumulaient sans fin et finissaient par vider le catalogue.
    await runSearch(preferences, { source: "natural_language", resetExcluded: true });
    router.push("/resultat");
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-dim">Ta demande</p>
        {query ? <p className="font-display text-lg text-chalk">« {query} »</p> : null}
      </header>

      <DemoBanner />

      <UnderstoodChips
        chips={chips}
        preferences={preferences}
        onRemove={removeCriterion}
        onChange={(next) => setPreferences(next)}
        onValidate={() => void launch()}
        validateLabel={preferences.mediaType === "tv" ? "✨ TROUVER MA SÉRIE" : "✨ TROUVER MON FILM"}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-night-line pt-6 text-sm">
        <TonightButton variant="ghost" href="/film">
          🎬 Affiner avec le questionnaire film
        </TonightButton>
        <TonightButton variant="ghost" href="/serie">
          📺 Affiner avec le questionnaire série
        </TonightButton>
        <TonightButton variant="ghost" href="/yolo">
          🎲 Laisse tomber, choisis pour moi
        </TonightButton>
      </div>
    </div>
  );
}
