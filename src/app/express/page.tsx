"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import { MOVIE_MOODS, SERIES_MOODS, type DiscoveryLevel, type MediaType, type Mood } from "@/types/tonight";
import { moodLabel } from "@/data/moods";
import { QuestionScreen, SelectCard } from "@/components/SelectCard";
import { useTonight } from "@/components/providers/TonightProvider";

/**
 * ⚡ TONIGHT EXPRESS (§51) : une recommandation en trois questions.
 * Rien à décider, juste à répondre.
 */
export default function ExpressPage() {
  const router = useRouter();
  const { runSearch } = useTonight();

  const [step, setStep] = useState(0);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [third, setThird] = useState<string | null>(null);
  const [fourth, setFourth] = useState<DiscoveryLevel | null>(null);

  const total = 4;

  const launch = async () => {
    if (!mediaType) return;
    const preferences = createEmptyPreferences("express", {
      mediaType,
      moods,
      confidence: 0.9,
      discoveryLevel: fourth,
    });

    if (mediaType === "movie") {
      const runtimes: Record<string, number> = { express: 90, calm: 120, plenty: 150 };
      const runtime = third ? runtimes[third] : undefined;
      if (runtime) {
        preferences.maxRuntime = runtime;
        preferences.hardConstraints.push("maxRuntime");
      }
    } else if (third === "mini") {
      preferences.commitment = "mini";
      preferences.maxSeasons = 1;
      preferences.seriesStatus = "ended";
      preferences.softPreferences.push("fewSeasons", "strongEnding");
    } else if (third === "small") {
      preferences.commitment = "small";
      preferences.maxSeasons = 2;
      preferences.softPreferences.push("fewSeasons");
    } else if (third === "long") {
      preferences.commitment = "long";
      preferences.minSeasons = 4;
      preferences.softPreferences.push("longRuntime");
    }

    if (moods.includes("feel_good") || moods.includes("easy_watch")) {
      preferences.softPreferences.push("light");
    }

    // Parcours neuf : on ne traîne pas les exclusions des recherches passées.
    await runSearch(preferences, { source: "express", resetExcluded: true });
    router.push("/resultat");
  };

  const toggleMood = (mood: Mood) =>
    setMoods((previous) => (previous.includes(mood) ? previous.filter((item) => item !== mood) : [...previous, mood]));

  if (step === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <QuestionScreen step={1} total={total} question="Tu veux quoi ce soir ?" subtitle="Environ 10 secondes, promis.">
          <SelectCard
            emoji="🎬"
            label="FILM"
            onClick={() => {
              setMediaType("movie");
              setStep(1);
            }}
          />
          <SelectCard
            emoji="📺"
            label="SÉRIE"
            onClick={() => {
              setMediaType("tv");
              setStep(1);
            }}
          />
          <SelectCard
            emoji="🎲"
            label="JE SAIS PAS, DÉCIDE POUR MOI"
            hint="On tire à pile ou face, mais intelligemment."
            onClick={() => {
              setMediaType(Math.random() > 0.5 ? "movie" : "tv");
              setStep(1);
            }}
          />
        </QuestionScreen>
      </div>
    );
  }

  if (step === 1) {
    const options = mediaType === "tv" ? SERIES_MOODS.slice(0, 10) : MOVIE_MOODS.slice(0, 10);
    return (
      <div className="mx-auto max-w-2xl">
        <QuestionScreen
          step={2}
          total={total}
          question="Ton mood, en un mot ?"
          subtitle="Si tu touches à rien, je fais confiance à ton profil."
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
          nextLabel={moods.length ? "SUIVANT" : "PEU IMPORTE"}
          multiHint="Plusieurs choix possibles."
        >
          {options.map((mood) => (
            <SelectCard
              key={mood}
              label={moodLabel(mood, mediaType === "tv" ? "tv" : "movie")}
              multi
              selected={moods.includes(mood)}
              onClick={() => toggleMood(mood)}
            />
          ))}
        </QuestionScreen>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="mx-auto max-w-2xl">
        <QuestionScreen
          step={3}
          total={total}
          question={mediaType === "movie" ? "Combien de temps tu as ?" : "Petite ou longue série ?"}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          nextLabel={third ? "SUIVANT" : "PEU IMPORTE"}
        >
          {mediaType === "movie" ? (
            <>
              <SelectCard emoji="⚡" label="COURT" hint="moins de 1h30" selected={third === "express"} onClick={() => setThird("express")} />
              <SelectCard emoji="🍿" label="NORMAL" hint="moins de 2 heures" selected={third === "calm"} onClick={() => setThird("calm")} />
              <SelectCard emoji="🎬" label="J'AI LE TEMPS" hint="jusqu'à 2h30" selected={third === "plenty"} onClick={() => setThird("plenty")} />
              <SelectCard emoji="🏛️" label="PEU IMPORTE" selected={third === "any"} onClick={() => setThird("any")} />
            </>
          ) : (
            <>
              <SelectCard emoji="⚡" label="MINI-SÉRIE" hint="une saison, une vraie fin" selected={third === "mini"} onClick={() => setThird("mini")} />
              <SelectCard emoji="📺" label="PETITE SÉRIE" hint="1 à 2 saisons" selected={third === "small"} onClick={() => setThird("small")} />
              <SelectCard emoji="🏠" label="LONGUE SÉRIE" hint="je veux m'installer" selected={third === "long"} onClick={() => setThird("long")} />
              <SelectCard emoji="🤷" label="PEU IMPORTE" selected={third === "any"} onClick={() => setThird("any")} />
            </>
          )}
        </QuestionScreen>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <QuestionScreen
        step={4}
        total={total}
        question="Valeur sûre ou découverte ?"
        onBack={() => setStep(2)}
        onNext={() => void launch()}
        nextLabel="✨ BALANCE-MOI ÇA"
        nextDisabled={!mediaType}
      >
        <SelectCard emoji="🏆" label="VALEUR SÛRE" selected={fourth === "safe"} onClick={() => setFourth("safe")} />
        <SelectCard emoji="💎" label="PÉPITE" selected={fourth === "hidden_gem"} onClick={() => setFourth("hidden_gem")} />
        <SelectCard emoji="🎲" label="SURPRENDS-MOI" selected={fourth === "surprise"} onClick={() => setFourth("surprise")} />
        <SelectCard emoji="🤷" label="PEU IMPORTE" selected={fourth === null} onClick={() => setFourth(null)} />
      </QuestionScreen>
    </div>
  );
}
