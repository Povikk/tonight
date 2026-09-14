"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import { SelectCard } from "@/components/SelectCard";
import { useTonight } from "@/components/providers/TonightProvider";
import type { MediaTypeChoice } from "@/types/tonight";

/**
 * 🎲 YOLO (§52).
 *
 * Ce n'est PAS du hasard pur : TONIGHT évite les contenus très mal notés, ceux
 * qui n'ont presque pas de votes, ce qui a déjà été refusé ou vu, et tient
 * compte des goûts. Le hasard ne sert qu'à trancher entre de bons candidats.
 */
export default function YoloPage() {
  const router = useRouter();
  const { runSearch, loading } = useTonight();
  const [launching, setLaunching] = useState(false);

  const go = async (choice: MediaTypeChoice) => {
    setLaunching(true);
    const preferences = createEmptyPreferences("yolo", {
      mediaType: choice,
      discoveryLevel: "surprise",
      qualityPreference: "solid",
      minRating: 6,
      hardConstraints: choice === "any" ? ["minRating"] : ["minRating", "mediaType"],
      softPreferences: ["wellRated"],
      confidence: 0.75,
    });
    // YOLO relance un tirage neuf à chaque clic : la liste d'exclusions doit
    // repartir de zéro, sinon au bout de quelques essais il ne reste rien.
    await runSearch(preferences, { source: "yolo", resetExcluded: true });
    router.push("/resultat");
  };

  // Le chargement est affiché par le voile global (SearchOverlay) : ici on se
  // contente de verrouiller les choix pour éviter un double lancer.
  const busy = launching || loading;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-dim">Mode YOLO</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-chalk">Fais-moi confiance.</h1>
        <p className="text-sm text-muted">
          Je pioche dans ce qui est bien noté, j'écarte ce que tu as déjà vu ou refusé, et je te sers une
          seule chose. Aucun questionnaire.
        </p>
      </header>

      <div className="space-y-3">
        <SelectCard
          emoji="🎬"
          label="UN FILM"
          hint="environ 2 heures et on n'en parle plus"
          disabled={busy}
          onClick={() => void go("movie")}
        />
        <SelectCard
          emoji="📺"
          label="UNE SÉRIE"
          hint="quelque chose à commencer ce soir"
          disabled={busy}
          onClick={() => void go("tv")}
        />
        <SelectCard
          emoji="🌙"
          label="CHOISIS POUR MOI"
          hint="je tranche, tu t'installes"
          disabled={busy}
          onClick={() => void go("any")}
        />
      </div>

      <p className="text-center text-xs text-muted-dim">
        Ton historique et tes refus sont pris en compte : YOLO n'est pas du hasard.
      </p>
    </div>
  );
}
