"use client";

import { useState } from "react";
import { MOVIE_MOODS, SERIES_MOODS, type DiscoveryLevel, type Mood, type TonightSearchPreferences, type UnderstoodChip } from "@/types/tonight";
import { moodDefinition, moodLabel } from "@/data/moods";
import { useCatalogOptions } from "@/hooks/useCatalogOptions";
import { Pill, TonightButton } from "./ui";

/**
 * « J'ai compris » : les critères détectés dans la demande naturelle (§14).
 * Chaque chip est supprimable, et on peut ajouter un critère sans repasser par
 * un questionnaire complet.
 */
export function UnderstoodChips({
  chips,
  preferences,
  onRemove,
  onChange,
  onValidate,
  validateLabel = "✨ TROUVER MON FILM",
}: {
  chips: UnderstoodChip[];
  preferences: TonightSearchPreferences;
  onRemove: (chipId: string) => void;
  onChange: (next: TonightSearchPreferences) => void;
  onValidate?: () => void;
  validateLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const mediaType = preferences.mediaType === "tv" ? "tv" : "movie";
  const { providers } = useCatalogOptions(mediaType);

  const moods = mediaType === "tv" ? SERIES_MOODS : MOVIE_MOODS;
  const activeMoods = preferences.moods;

  const toggleMood = (mood: Mood) => {
    const has = activeMoods.includes(mood);
    onChange({
      ...preferences,
      moods: has ? activeMoods.filter((item) => item !== mood) : [...activeMoods, mood],
    });
  };

  const setDiscovery = (level: DiscoveryLevel | null) => onChange({ ...preferences, discoveryLevel: level });

  const setRuntime = (minutes: number | null) =>
    onChange({ ...preferences, maxRuntime: minutes, softMaxRuntime: null });

  const toggleProvider = (providerId: number) => {
    const has = preferences.providers.includes(providerId);
    onChange({
      ...preferences,
      providers: has
        ? preferences.providers.filter((id) => id !== providerId)
        : [...preferences.providers, providerId],
      monetizationTypes: preferences.monetizationTypes.length
        ? preferences.monetizationTypes
        : ["flatrate", "free", "ads"],
    });
  };

  return (
    <section aria-labelledby="understood-title" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="understood-title" className="font-display text-lg font-semibold text-chalk">
          J'ai compris :
        </h2>
        <span className="text-xs text-muted-dim">
          Retire ou ajoute ce que tu veux, puis lance la recherche.
        </span>
      </div>

      <ul className="flex flex-wrap gap-2">
        {chips.map((chip, index) => (
          <li
            key={chip.id}
            className="animate-fade-up"
            style={{ animationDelay: `${Math.min(index * 45, 320)}ms` }}
          >
            <button
              type="button"
              onClick={() => onRemove(chip.id)}
              aria-label={`Retirer le critère ${chip.label}`}
              className={`t-chip group transition-colors ${
                chip.tone === "negative"
                  ? "border-danger/40 hover:border-danger"
                  : chip.tone === "positive"
                    ? "border-violet/40 hover:border-violet"
                    : "hover:border-chalk/50"
              }`}
            >
              <span aria-hidden>{chip.emoji}</span>
              <span>{chip.label}</span>
              <span aria-hidden className="ml-1 text-muted-dim transition-colors group-hover:text-danger">
                ✕
              </span>
            </button>
          </li>
        ))}
        {chips.length === 0 ? (
          <li className="text-sm text-muted-dim">Rien de précis… je vais devoir te surprendre.</li>
        ) : null}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <TonightButton variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>
          {editing ? "− Fermer l'édition" : "＋ Ajouter / modifier un critère"}
        </TonightButton>
        {onValidate ? (
          <TonightButton onClick={onValidate} size="lg">
            {validateLabel}
          </TonightButton>
        ) : null}
      </div>

      {editing ? (
        <div className="t-panel animate-fade-up space-y-5 p-5">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-chalk">Ton mood</legend>
            <ul className="flex flex-wrap gap-2">
              {moods.map((mood) => {
                const active = activeMoods.includes(mood);
                return (
                  <li key={mood}>
                    <button
                      type="button"
                      onClick={() => toggleMood(mood)}
                      aria-pressed={active}
                      className={`t-chip ${
                        active ? "border-violet bg-violet/20 text-chalk" : "text-muted hover:text-chalk"
                      }`}
                    >
                      <span aria-hidden>{moodDefinition(mood).emoji}</span>
                      <span>{moodLabel(mood, mediaType)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-chalk">
              {mediaType === "movie" ? "Durée maximum" : "Durée des épisodes"}
            </legend>
            <ul className="flex flex-wrap gap-2">
              {(mediaType === "movie" ? [90, 105, 120, 150, null] : [22, 30, 45, 60, null]).map((minutes) => (
                <li key={String(minutes)}>
                  <button
                    type="button"
                    aria-pressed={minutes === null ? preferences.maxRuntime === null : preferences.maxRuntime === minutes}
                    onClick={() => setRuntime(minutes === null ? null : minutes)}
                    className={`t-chip ${
                      minutes === null
                        ? preferences.maxRuntime === null
                          ? "border-violet bg-violet/20"
                          : "text-muted"
                        : preferences.maxRuntime === minutes
                          ? "border-violet bg-violet/20"
                          : "text-muted hover:text-chalk"
                    }`}
                  >
                    {minutes === null ? "♾️ Peu importe" : `≤ ${minutes} min`}
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-chalk">Découverte</legend>
            <ul className="flex flex-wrap gap-2">
              {(
                [
                  ["mainstream", "🏆 Incontournable"],
                  ["safe", "⭐ Valeur sûre"],
                  ["hidden_gem", "💎 Pépite"],
                  ["obscure", "🕳️ Peu connu"],
                  ["surprise", "🎲 Surprends-moi"],
                  [null, "♾️ Peu importe"],
                ] as Array<[DiscoveryLevel | null, string]>
              ).map(([level, label]) => (
                <li key={String(level)}>
                  <button
                    type="button"
                    aria-pressed={preferences.discoveryLevel === level}
                    onClick={() => setDiscovery(level)}
                    className={`t-chip ${
                      preferences.discoveryLevel === level ? "border-violet bg-violet/20" : "text-muted hover:text-chalk"
                    }`}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>

          {providers.length ? (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-chalk">Où tu peux regarder</legend>
              <ul className="flex flex-wrap gap-2">
                {providers.slice(0, 12).map((provider) => {
                  const active = preferences.providers.includes(provider.providerId);
                  return (
                    <li key={provider.providerId}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleProvider(provider.providerId)}
                        className={`t-chip ${active ? "border-violet bg-violet/20" : "text-muted hover:text-chalk"}`}
                      >
                        {provider.name}
                      </button>
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ ...preferences, providers: [], monetizationTypes: [] })
                    }
                    className={`t-chip ${preferences.providers.length === 0 ? "border-violet bg-violet/20" : "text-muted"}`}
                  >
                    🌍 Peu importe
                  </button>
                </li>
              </ul>
            </fieldset>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-night-line pt-4">
            <p className="text-xs text-muted-dim">
              Pour aller plus loin, tu peux aussi passer par le questionnaire. <Pill>🎬 Film</Pill>{" "}
              <Pill>📺 Série</Pill>
            </p>
            <TonightButton variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Terminé
            </TonightButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
