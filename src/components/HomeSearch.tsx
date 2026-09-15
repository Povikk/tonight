"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getSettings, updateSettings } from "@/storage";
import type { MediaTypeChoice, ParsedRequest } from "@/types/tonight";
import { SelectCard } from "./SelectCard";
import { TonightButton } from "./ui";
import { useTonight } from "./providers/TonightProvider";

const PLACEHOLDER =
  "Un film récent, beau visuellement, avec un peu d'amour, pas triste et moins de 2h…";

const EXAMPLES = [
  "Une petite série feel-good terminée avec des épisodes de 30 minutes",
  "Un thriller des années 90 de moins de deux heures",
  "Quelque chose de beau visuellement et récent",
  "Un film romantique mais pas une comédie romantique",
];

/**
 * Le champ de langage naturel (§3) : l'élément le plus visible de TONIGHT.
 * Il produit les mêmes préférences que n'importe quel autre parcours.
 */
export function HomeSearch() {
  const router = useRouter();
  const { setQuery, setPreferences } = useTonight();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoLaunching, setAutoLaunching] = useState(false);
  /**
   * La dernière recherche vit dans localStorage : la lire pendant le rendu
   * ferait diverger le HTML serveur (vide) du rendu client (avec la valeur),
   * donc une erreur d'hydratation. On la charge après le montage.
   */
  const [lastQuery, setLastQuery] = useState<string | null>(null);

  /**
   * Deux analyses ne doivent pas se marcher dessus (Entrée + clic, exemples) :
   * seule la plus récente publie ses préférences et redirige.
   */
  const analysisIdRef = useRef(0);
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setLastQuery(getSettingsSafe());
  }, []);

  useEffect(
    () => () => {
      if (redirectTimerRef.current !== null) window.clearTimeout(redirectTimerRef.current);
    },
    [],
  );

  const analyze = async (query: string, forcedMediaType?: MediaTypeChoice) => {
    if (!query.trim()) {
      setError("Dis-moi juste ce que tu as envie de regarder ce soir.");
      return;
    }
    const requestId = analysisIdRef.current + 1;
    analysisIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, forcedMediaType, source: "natural_language" }),
      });
      const payload = (await response.json()) as ParsedRequest & { error?: string };
      if (requestId !== analysisIdRef.current) return;
      if (payload.error) throw new Error(payload.error);

      setQuery(query);
      updateSettings({ lastQuery: query, lastMediaType: payload.preferences.mediaType });
      setParsed(payload);
      setPreferences(payload.preferences, payload.chips);

      // Si TONIGHT a besoin de savoir si c'est un film ou une série, on pose
      // UNE question, jamais un questionnaire de douze étapes (§15).
      if (!payload.needsMediaTypeQuestion) {
        setAutoLaunching(true);
        if (redirectTimerRef.current !== null) window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = window.setTimeout(() => router.push("/comprendre"), 420);
      }
    } catch {
      if (requestId !== analysisIdRef.current) return;
      setError("Je n'ai pas réussi à analyser ta demande. Réessaie, ou passe par un questionnaire.");
    } finally {
      if (requestId === analysisIdRef.current) setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void analyze(value);
        }}
      >
        <label htmlFor="tonight-query" className="sr-only">
          Dis-moi ce que tu veux regarder ce soir
        </label>
        <div className="group relative">
          <div
            aria-hidden
            className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-violet/25 via-transparent to-amber/20 opacity-70 blur-xl transition-opacity group-focus-within:opacity-100"
          />
          <textarea
            id="tonight-query"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void analyze(value);
              }
            }}
            rows={2}
            placeholder={PLACEHOLDER}
            aria-describedby="tonight-query-help"
            className="relative w-full resize-none rounded-3xl border border-night-line bg-night/80 px-5 py-4 font-display text-lg leading-snug text-chalk placeholder:text-muted-dim/80 focus:border-violet/60 focus:outline-none sm:text-xl"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <TonightButton type="submit" size="lg" disabled={loading}>
            {loading ? "… JE RÉFLÉCHIS" : "✨ TROUVE-MOI ÇA"}
          </TonightButton>
          <p id="tonight-query-help" className="text-xs text-muted-dim">
            Écris comme tu parles. « Pas trop long », « pas triste », « un truc qui retourne le cerveau » :
            je comprends.
          </p>
        </div>
      </form>

      {error ? (
        <p role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {parsed?.needsMediaTypeQuestion ? (
        <div className="t-panel animate-fade-up space-y-3 p-5">
          <p className="font-display text-lg font-semibold text-chalk">{parsed.question ?? "Plutôt ?"}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <SelectCard emoji="🎬" label="FILM" onClick={() => void analyze(value, "movie")} />
            <SelectCard emoji="📺" label="SÉRIE" onClick={() => void analyze(value, "tv")} />
            <SelectCard emoji="🎲" label="CHOISIS POUR MOI" onClick={() => void analyze(value, "any")} />
          </div>
        </div>
      ) : null}

      {autoLaunching ? (
        <p className="animate-fade-in text-sm text-good">J'ai compris. Je regarde ce qu'il y a…</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setValue(example);
              void analyze(example);
            }}
            className="t-chip t-chip-wrap text-left text-muted transition-colors hover:border-violet/50 hover:text-chalk"
          >
            « {example} »
          </button>
        ))}
      </div>

      {lastQuery ? (
        <p className="text-xs text-muted-dim">
          Dernière recherche : <span className="text-muted">{lastQuery}</span>
        </p>
      ) : null}
    </div>
  );
}

/** Lit la dernière requête mémorisée, sans casser le SSR. */
function getSettingsSafe(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return getSettings().lastQuery || null;
  } catch {
    return null;
  }
}
