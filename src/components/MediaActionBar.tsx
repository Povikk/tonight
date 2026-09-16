"use client";

import { useEffect, useState } from "react";
import { isFavorite, recordRecommendation, toggleFavorite } from "@/storage";
import type { Candidate, RefusalReason } from "@/types/tonight";
import { displayedRating } from "@/utils/ratings";
import { TonightButton } from "./ui";

/**
 * Actions sur une œuvre, réutilisées partout (résultat, fiche détaillée) :
 * favori, déjà vu, pas envie, plus « Trouver quelque chose de similaire ».
 *
 * `inline` permet d'insérer les boutons dans une rangée existante (écran
 * résultat, §41) au lieu de créer leur propre groupe.
 */
export function MediaActionBar({
  candidate,
  onRefuse,
  onSimilar,
  compact = false,
  vertical = false,
  inline = false,
}: {
  candidate: Candidate;
  onRefuse?: () => void;
  onSimilar?: () => void;
  compact?: boolean;
  vertical?: boolean;
  inline?: boolean;
}) {
  const [favorite, setFavorite] = useState(false);
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    setFavorite(isFavorite(candidate.mediaType, candidate.id));
    setWatched(false);
  }, [candidate.id, candidate.mediaType]);

  const toggleFav = () => {
    const rating = displayedRating(candidate);
    const next = toggleFavorite({
      key: `${candidate.mediaType}:${candidate.id}`,
      id: candidate.id,
      mediaType: candidate.mediaType,
      title: candidate.title,
      year: candidate.year,
      posterPath: candidate.posterPath,
      voteAverage: rating.average,
      ratingSource: rating.source === "IMDb" ? "imdb" : undefined,
      genres: candidate.genres,
    });
    setFavorite(next);
  };

  /**
   * « Déjà vu » doit fonctionner même si l'œuvre n'est jamais passée par
   * l'historique (recherche manuelle, fiche ouverte depuis un favori) : on
   * enregistre donc l'entrée au lieu de se contenter de la mettre à jour.
   * Le statut « vu » nourrit ensuite le profil de goûts et les exclusions.
   */
  const markWatched = () => {
    recordRecommendation({
      key: `${candidate.mediaType}:${candidate.id}`,
      id: candidate.id,
      mediaType: candidate.mediaType,
      title: candidate.title,
      originalTitle: candidate.originalTitle,
      year: candidate.year,
      posterPath: candidate.posterPath,
      overview: candidate.overview,
      genres: candidate.genres,
      matchPercent: 0,
      status: "watched",
      runtime: candidate.runtime,
      seasons: candidate.seasons,
      popularity: candidate.popularity,
      providers: candidate.providers.map((provider) => provider.providerId),
    });
    setWatched(true);
  };

  const size = compact ? "sm" : "md";
  const container = vertical ? "flex flex-col items-stretch gap-2" : "flex flex-wrap items-center gap-2";

  const children = (
    <>
      <TonightButton variant="soft" size={size} onClick={toggleFav} ariaLabel="Ajouter ou retirer des favoris">
        {favorite ? "❤️ Favori" : "🤍 Favori"}
      </TonightButton>
      <TonightButton variant="soft" size={size} onClick={markWatched} ariaLabel="Marquer comme déjà vu">
        {watched ? "👁️ Vu ✓" : `👁️ Déjà ${candidate.mediaType === "movie" ? "vu" : "vue"}`}
      </TonightButton>
      {onRefuse ? (
        <TonightButton variant="ghost" size={size} onClick={onRefuse} ariaLabel="Je n'ai pas envie de celui-là">
          🚫 Pas envie
        </TonightButton>
      ) : null}
      {onSimilar ? (
        <TonightButton variant="ghost" size={size} onClick={onSimilar}>
          🎲 Quelque chose de similaire
        </TonightButton>
      ) : null}
    </>
  );

  if (inline) return <>{children}</>;
  return <div className={container}>{children}</div>;
}

export type { RefusalReason };
