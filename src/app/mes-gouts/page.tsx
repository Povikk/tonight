"use client";

import { useMemo } from "react";
import { moodDefinition } from "@/data/moods";
import { useLocalStore } from "@/hooks/useLocalStore";
import { useCatalogOptions } from "@/hooks/useCatalogOptions";
import {
  favoritesStore,
  feedbackStore,
  historyStore,
  overrideTaste,
  settingsStore,
  topLikedGenres,
  topMoods,
  topRefusedGenres,
} from "@/storage";
import { computeTasteProfile } from "@/storage/tasteProfile";
import { genreName } from "@/utils/constants";
import { providerName } from "@/utils/providers";
import { REFUSAL_OPTIONS } from "@/recommendation/personalizationScore";
import { EmptyState, SectionTitle, TonightButton } from "@/components/ui";

/**
 * MES GOÛTS (§46).
 * « Tonight pense que tu aimes… », « Tu refuses souvent… », et de quoi corriger
 * le tir sans effacer son historique.
 */
export default function MesGoutsPage() {
  const { value: history, hydrated } = useLocalStore(historyStore);
  const { value: favorites } = useLocalStore(favoritesStore);
  const { value: feedback } = useLocalStore(feedbackStore);
  const { value: settings } = useLocalStore(settingsStore);
  const { genres } = useCatalogOptions(history.some((entry) => entry.mediaType === "tv") ? "tv" : "movie");

  // Le profil est recalculé à chaque changement de données locales.
  const profile = useMemo(
    () => computeTasteProfile(),
    // Dépendances volontairement explicites : toute écriture locale repasse ici.
    [history, favorites, feedback, settings.tasteOverrides],
  );

  /**
   * `hydrated` vaut `false` au rendu serveur ET au premier rendu client : tout
   * ce qui dépend du localStorage est donc neutralisé jusque-là, sinon le HTML
   * du serveur (sans données) ne correspond plus à celui du client (avec
   * données) et React casse l'hydratation.
   */
  const ready = hydrated;
  const liked = ready ? topLikedGenres(profile, 8) : [];
  const refused = ready ? topRefusedGenres(profile, 5) : [];
  const moods = ready ? topMoods(profile, 5) : [];
  const overrides = ready
    ? settings.tasteOverrides
    : ({ likedGenres: [], dislikedGenres: [] } as typeof settings.tasteOverrides);
  const acceptedCount = ready ? profile.stats.accepted : 0;
  const refusedCount = ready ? profile.stats.refused : 0;

  const genreLabel = (id: number) => genres.find((genre) => genre.id === id)?.name ?? genreName(id);

  const hasData = ready && (history.length > 0 || favorites.length > 0);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-dim">Mes goûts</p>
        <h1 className="font-display text-2xl font-semibold text-chalk sm:text-3xl">
          Ce que Tonight a retenu de toi
        </h1>
        <p className="text-sm text-muted">
          Rien n'est envoyé nulle part : c'est calculé à partir de ton historique, de tes favoris et de
          tes refus, sur cet appareil.
        </p>
      </header>

      {!hasData ? (
        <EmptyState
          emoji="🧠"
          title="Je ne te connais pas encore."
          description="Après quelques recommandations et quelques favoris, je saurai te dire ce que tu aimes, et arrêter de te proposer ce que tu refuses."
          action={<TonightButton href="/">Commencer par une recherche</TonightButton>}
        />
      ) : null}

      <section aria-labelledby="likes">
        <SectionTitle id="likes" hint={`${acceptedCount} recommandation(s) acceptée(s)`}>
          Tonight pense que tu aimes…
        </SectionTitle>
        {liked.length ? (
          <ul className="flex flex-wrap gap-2">
            {liked.map((genre) => {
              const manual = overrides.likedGenres.includes(genre);
              return (
                <li key={genre} className="t-chip border-good/30 bg-good/5">
                  {manual ? "📌" : "🎯"} {genreLabel(genre)}
                  <button
                    type="button"
                    onClick={() => overrideTaste(genre, false)}
                    aria-label={`Retirer ${genreLabel(genre)} de mes goûts`}
                    className="ml-1 text-muted-dim transition-colors hover:text-danger"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-dim">Pas encore assez de données pour trancher.</p>
        )}

        {moods.length ? (
          <>
            <p className="mt-4 text-sm text-muted">Et côté envies :</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {moods.map((mood) => (
                <li key={mood} className="t-chip">
                  {moodDefinition(mood)?.emoji} {moodDefinition(mood)?.label}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section aria-labelledby="dislikes">
        <SectionTitle id="dislikes" hint={`${refusedCount} refus`}>
          Tu refuses souvent…
        </SectionTitle>
        {refused.length ? (
          <ul className="flex flex-wrap gap-2">
            {refused.map(({ genre, count }) => (
              <li key={genre} className="t-chip border-danger/30 bg-danger/5 text-danger">
                🚫 {genreLabel(genre)} <span className="text-muted-dim">({count})</span>
                <button
                  type="button"
                  onClick={() => overrideTaste(genre, null)}
                  aria-label={`Ne plus considérer ${genreLabel(genre)} comme un refus`}
                  className="ml-1 text-muted-dim transition-colors hover:text-chalk"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-dim">
            Rien de systématique pour l'instant. Continue à me dire « pas envie », je repère les motifs.
          </p>
        )}

        {ready && feedback.length ? (
          <ul className="mt-4 flex flex-wrap gap-2 text-xs">
            {REFUSAL_OPTIONS.filter((option) =>
              feedback.some((entry) => entry.reasons.includes(option.reason)),
            ).map((option) => (
              <li key={option.reason} className="t-chip text-muted">
                {option.emoji} {option.label} dans tes refus récents
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="prefs">
        <SectionTitle id="prefs">Tes habitudes</SectionTitle>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li className="t-panel p-4 text-sm">
            <p className="text-muted-dim">Époque habituelle</p>
            <p className="text-chalk">
              {ready && profile.preferredEra
                ? `${profile.preferredEra.min}-${profile.preferredEra.max}`
                : "Pas encore définie"}
            </p>
          </li>
          <li className="t-panel p-4 text-sm">
            <p className="text-muted-dim">Plateformes mémorisées</p>
            <p className="text-chalk">
              {ready && settings.defaultProviders.length
                ? settings.defaultProviders.map(providerName).join(" · ")
                : "Aucune pour l'instant"}
            </p>
          </li>
          <li className="t-panel p-4 text-sm">
            <p className="text-muted-dim">Niveau de découverte</p>
            <p className="text-chalk">
              {ready ? profile.preferredDiscovery ?? settings.defaultDiscovery ?? "Mixte" : "Mixte"}
            </p>
          </li>
        </ul>
      </section>

      <section aria-labelledby="reset" className="t-panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 id="reset" className="font-display text-base font-semibold text-chalk">
            Repartir de zéro
          </h2>
          <p className="text-sm text-muted">
            Efface tout ce que TONIGHT sait de toi : historique, favoris, refus et goûts.
          </p>
        </div>
        <TonightButton
          variant="danger"
          onClick={() => {
            settingsStore.set((previous) => ({
              ...previous,
              tasteOverrides: { likedGenres: [], dislikedGenres: [] },
            }));
            historyStore.reset();
            favoritesStore.reset();
            feedbackStore.reset();
          }}
        >
          Réinitialiser mon profil
        </TonightButton>
      </section>
    </div>
  );
}
