/**
 * Choix de la bande-annonce (§49, §50).
 *
 * TMDB renvoie pêle-mêle des teasers, des extraits, des « featurettes » et des
 * bandes-annonces, en plusieurs langues (et parfois plusieurs par langue). On
 * veut UNE vidéo : la plus officielle, la plus proche de la langue de
 * l'utilisateur, et si possible une vraie bande-annonce.
 *
 * Fonction pure, donc testable sans réseau.
 */

import type { TrailerInfo } from "@/types/tonight";
import type { TmdbVideo } from "@/types/tmdb";

/** Types de vidéos acceptables, du plus intéressant au moins intéressant. */
const TYPE_PRIORITY: Record<string, number> = {
  Trailer: 3,
  Teaser: 2,
  Clip: 1,
};

/**
 * Sélectionne la meilleure bande-annonce disponible.
 *
 * @param videos          `videos.results` de TMDB (peut être absent)
 * @param preferredLanguage langue de l'utilisateur (« fr »), privilégiée
 * @returns la vidéo retenue, ou `null` s'il n'y a rien d'exploitable
 */
export function pickTrailer(
  videos: TmdbVideo[] | undefined | null,
  preferredLanguage = "fr",
): TrailerInfo | null {
  if (!videos?.length) return null;

  const playable = videos.filter(
    (video) => video.site?.toLowerCase() === "youtube" && Boolean(video.key?.trim()),
  );
  if (!playable.length) return null;

  const score = (video: TmdbVideo): number => {
    let value = (TYPE_PRIORITY[video.type] ?? 0) * 10;
    if (video.official) value += 5;
    // La langue préférée passe avant tout le reste : une bande-annonce en
    // français parle plus à un utilisateur français qu'un teaser officiel
    // en anglais.
    if (video.iso_639_1?.toLowerCase() === preferredLanguage) value += 100;
    // À qualité égale, la plus récente.
    if (video.published_at) value += Math.min(Date.parse(video.published_at) / 1e13, 1);
    return value;
  };

  const best = [...playable].sort((a, b) => score(b) - score(a))[0];
  return {
    key: best.key,
    name: best.name || "Bande-annonce",
    language: best.iso_639_1 ?? null,
    official: Boolean(best.official),
  };
}

/** URL YouTube « watch » d'une vidéo (ouverte dans un nouvel onglet). */
export function youtubeWatchUrl(key: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(key)}`;
}

/** URL d'intégration du lecteur YouTube, sans cookie ni suggestion superflue. */
export function youtubeEmbedUrl(key: string): string {
  const params = new URLSearchParams({
    autoplay: "0",
    rel: "0",
    modestbranding: "1",
    // Pas de cookies YouTube avant lecture explicite (respect de la vie privée).
    // `youtube-nocookie` est déjà utilisé côté domaine.
  });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?${params.toString()}`;
}
