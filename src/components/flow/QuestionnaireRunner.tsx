"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { createEmptyPreferences } from "@/data/defaultPreferences";
import type { Question, Questionnaire } from "@/data/questionnaires";
import { moodLabel } from "@/data/moods";
import { useCatalogOptions } from "@/hooks/useCatalogOptions";
import { rememberProviders } from "@/storage";
import type {
  HardConstraintId,
  Mood,
  SoftPreferenceId,
  TonightSearchPreferences,
} from "@/types/tonight";
import { QuestionScreen, SelectCard } from "../SelectCard";
import { AdvancedCriteria } from "./AdvancedCriteria";
import { TonightButton } from "../ui";
import { useTonight } from "../providers/TonightProvider";

/**
 * Exécute un questionnaire : une question par écran, gros boutons, retour
 * possible, progression discrète. Les réponses sont des patches appliqués à la
 * fin, aucun choix n'est perdu, aucun n'est obligatoire.
 */
export function QuestionnaireRunner({ questionnaire }: { questionnaire: Questionnaire }) {
  const router = useRouter();
  const { runSearch, preferences: sessionPreferences } = useTonight();
  const { providers } = useCatalogOptions(questionnaire.mediaType);

  const [stepIndex, setStepIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [providerSelection, setProviderSelection] = useState<number[]>(
    questionnaire.mediaType === sessionPreferences.mediaType ? sessionPreferences.providers : [],
  );
  const [acceptRental, setAcceptRental] = useState(false);
  const [moods, setMoods] = useState<Mood[]>(
    questionnaire.mediaType === sessionPreferences.mediaType ? sessionPreferences.moods : [],
  );
  const [advanced, setAdvanced] = useState<Partial<TonightSearchPreferences>>({});
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const steps = questionnaire.steps;
  const step: Question = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const visibleOptions = useMemo(
    () => (step.options ?? []).filter((option) => showAdvancedOptions || !option.advanced),
    [step.options, showAdvancedOptions],
  );
  const hasAdvancedOptions = (step.options ?? []).some((option) => option.advanced);

  const currentSelection = selections[step.id] ?? [];
  const select = useCallback(
    (optionId: string) => {
      setSelections((previous) => ({ ...previous, [step.id]: [optionId] }));
    },
    [step.id],
  );

  const toggleMood = useCallback((mood: Mood) => {
    setMoods((previous) => (previous.includes(mood) ? previous.filter((item) => item !== mood) : [...previous, mood]));
  }, []);

  /** Construit les préférences finales à partir des réponses. */
  const buildPreferences = useCallback((): TonightSearchPreferences => {
    const base = createEmptyPreferences("questionnaire", {
      mediaType: questionnaire.mediaType,
      confidence: 0.96,
    });

    let result: TonightSearchPreferences = { ...base };

    for (const question of steps) {
      const chosen = selections[question.id] ?? [];
      for (const optionId of chosen) {
        const option = question.options?.find((item) => item.id === optionId);
        if (!option?.patch) continue;
        const patch = option.patch;
        let next = { ...result };

        // Une nouvelle réponse dans une même famille REMPLACE la précédente :
        // choisir « 1990s » puis « 2020s » ne doit pas donner 2020-1990.
        if ("minYear" in patch || "maxYear" in patch) {
          next = {
            ...next,
            minYear: null,
            maxYear: null,
            softMinYear: null,
            softMaxYear: null,
            hardConstraints: next.hardConstraints.filter((item) => item !== "minYear" && item !== "maxYear"),
          };
        }
        if ("minRuntime" in patch || "maxRuntime" in patch) {
          next = {
            ...next,
            minRuntime: null,
            maxRuntime: null,
            softMinRuntime: null,
            softMaxRuntime: null,
            hardConstraints: next.hardConstraints.filter((item) => item !== "minRuntime" && item !== "maxRuntime"),
            softPreferences: next.softPreferences.filter(
              (item) => item !== "shortRuntime" && item !== "longRuntime",
            ),
          };
        }
        if ("minSeasons" in patch || "maxSeasons" in patch) {
          next = {
            ...next,
            minSeasons: null,
            maxSeasons: null,
            hardConstraints: next.hardConstraints.filter((item) => item !== "minSeasons" && item !== "maxSeasons"),
          };
        }

        result = {
          ...next,
          ...patch,
          hardConstraints: [...new Set([...next.hardConstraints, ...(patch.hardConstraints ?? [])])],
          softPreferences: [...new Set([...next.softPreferences, ...(patch.softPreferences ?? [])])],
        };
      }
    }

    const soft = new Set<SoftPreferenceId>(result.softPreferences);
    if (moods.includes("feel_good") || moods.includes("easy_watch")) soft.add("light");
    if (moods.includes("beautiful")) soft.add("beautiful");
    result.moods = moods;
    result.softPreferences = [...soft];

    if (providerSelection.length) {
      result.providers = providerSelection;
      result.monetizationTypes = acceptRental
        ? ["flatrate", "free", "ads", "rent", "buy"]
        : ["flatrate", "free", "ads"];
      const withProvider = new Set<HardConstraintId>(result.hardConstraints);
      withProvider.add("providers");
      result.hardConstraints = [...withProvider];
      result.softPreferences = [...new Set<SoftPreferenceId>([...result.softPreferences, "availableNow"])];
    }

    return {
      ...result,
      ...advanced,
      hardConstraints: [...new Set<HardConstraintId>([...result.hardConstraints, ...(advanced.hardConstraints ?? [])])],
    };
  }, [acceptRental, advanced, moods, providerSelection, questionnaire.mediaType, selections, steps]);

  const finish = useCallback(async () => {
    const built = buildPreferences();
    rememberProviders(built);
    // Nouvelle recherche guidée : liste d'exclusions vierge. La continuation
    // (« un autre », « similaire ») accumule au contraire les exclusions.
    await runSearch(built, { source: "questionnaire", resetExcluded: true });
    router.push("/resultat");
  }, [buildPreferences, router, runSearch]);

  const next = useCallback(() => {
    if (isLast) {
      void finish();
      return;
    }
    setStepIndex((value) => value + 1);
    setShowAdvancedOptions(false);
  }, [finish, isLast]);

  const skip = useCallback(() => {
    setSelections((previous) => ({ ...previous, [step.id]: [] }));
    if (step.id === "providers") {
      setProviderSelection([]);
      setAcceptRental(false);
    }
    if (step.id === "mood") setMoods([]);
    next();
  }, [next, step.id]);

  return (
    <div className="mx-auto max-w-2xl">
      <QuestionScreen
        step={stepIndex + 1}
        total={steps.length}
        question={step.question}
        subtitle={step.subtitle}
        onBack={stepIndex > 0 ? () => setStepIndex((value) => value - 1) : undefined}
        onNext={
          step.kind === "advanced" || currentSelection.length || step.kind === "multi" || step.kind === "providers"
            ? next
            : undefined
        }
        nextLabel={isLast ? (questionnaire.mediaType === "movie" ? "✨ TROUVER MON FILM" : "✨ TROUVER MA SÉRIE") : "SUIVANT"}
      >
        {step.kind === "single"
          ? visibleOptions.map((option) => (
              <SelectCard
                key={option.id}
                emoji={option.emoji}
                label={option.label ?? option.id}
                hint={option.hint}
                selected={currentSelection.includes(option.id)}
                onClick={() => select(option.id)}
              />
            ))
          : null}

        {step.kind === "multi"
          ? (step.options ?? []).map((option) => {
              const mood = option.mood as Mood;
              return (
                <SelectCard
                  key={option.id}
                  emoji={moodEmoji(mood)}
                  label={moodLabel(mood, questionnaire.mediaType)}
                  multi
                  selected={moods.includes(mood)}
                  onClick={() => toggleMood(mood)}
                />
              );
            })
          : null}

        {step.kind === "providers" ? (
          <div className="space-y-3">
            <ul className="grid gap-2 sm:grid-cols-2">
              {providers.slice(0, 12).map((provider) => {
                const active = providerSelection.includes(provider.providerId);
                return (
                  <li key={provider.providerId}>
                    <SelectCard
                      emoji="🎟️"
                      label={provider.name}
                      multi
                      selected={active}
                      onClick={() =>
                        setProviderSelection((previous) =>
                          previous.includes(provider.providerId)
                            ? previous.filter((id) => id !== provider.providerId)
                            : [...previous, provider.providerId],
                        )
                      }
                    />
                  </li>
                );
              })}
            </ul>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={acceptRental}
                onChange={(event) => setAcceptRental(event.target.checked)}
                className="size-4 accent-[#7b6cff]"
              />
              💰 Location / achat accepté
            </label>
            {!providers.length ? (
              <p className="text-sm text-muted-dim">
                La liste des plateformes arrive… (ou reste sur « Peu importe »).
              </p>
            ) : null}
          </div>
        ) : null}

        {step.kind === "advanced" ? (
          <AdvancedCriteria mediaType={questionnaire.mediaType} value={advanced} onChange={(patch) =>
            setAdvanced((previous) => ({
              ...previous,
              ...patch,
              hardConstraints: patch.hardConstraints ?? previous.hardConstraints,
            }))
          } />
        ) : null}

        {hasAdvancedOptions && step.kind === "single" ? (
          <div className="pt-1">
            <TonightButton variant="ghost" size="sm" onClick={() => setShowAdvancedOptions((value) => !value)}>
              {showAdvancedOptions ? "− Moins d'options" : "＋ Plus précis"}
            </TonightButton>
          </div>
        ) : null}
      </QuestionScreen>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        {step.allowSkip ? (
          <TonightButton variant="ghost" size="sm" onClick={skip}>
            {step.skipLabel ?? "🤷 Je sais pas"}
          </TonightButton>
        ) : null}
        {!isLast ? (
          <TonightButton variant="ghost" size="sm" onClick={() => setStepIndex(steps.length - 1)}>
            ⚙️ Plus de critères
          </TonightButton>
        ) : null}
      </div>
    </div>
  );
}

function moodEmoji(mood: Mood): string {
  const map: Record<string, string> = {
    funny: "😂",
    romance: "❤️",
    feel_good: "😌",
    easy_watch: "🛋️",
    comfort: "🛋️",
    mystery: "🧠",
    investigation: "🔍",
    mind_bending: "🤯",
    action: "💥",
    scifi: "🚀",
    fantasy: "🧙",
    adventure: "🗺️",
    emotion: "😭",
    suspense: "😱",
    horror: "🩸",
    drama: "🎭",
    family: "👨‍👩‍👧",
    beautiful: "🎨",
    intense: "🔥",
    historical: "🏰",
    detective: "👮",
    justice: "⚖️",
    medical: "🏥",
    workplace: "🏢",
  };
  return map[mood] ?? "✨";
}
