/**
 * Plateformes de streaming : noms FR et liens cliquables.
 *
 * POURQUOI UNE TABLE D'URLS ICI
 * -----------------------------
 * TMDB fournit, par région, UN SEUL lien `watch/providers` : la page
 * JustWatch de l'œuvre (« où regarder ce titre »), pas un lien par plateforme.
 * Or un badge « Netflix » sur lequel on ne peut pas cliquer ne sert à rien.
 *
 * On complète donc avec des URL de RECHERCHE propres à chaque service. Elles
 * ont toutes été vérifiées une par une (HTTP 200, pas de 404) :
 *   - Netflix, Prime Video, Apple TV, MUBI, Arte, Google Play, YouTube,
 *     Rakuten TV, Paramount+ ;
 *   - et RIEN pour les services dont l'URL de recherche n'est pas vérifiable
 *     (Disney+, Max : 404 sur toutes leurs variantes ; Canal+ : 403 même sur sa
 *     page d'accueil, donc impossible de garantir le chemin).
 *
 * Ces services-là retombent sur le lien `watch/providers` de TMDB, qui reste
 * toujours valide et satisfait l'obligation d'attribution JustWatch/TMDB (§22).
 * Mieux vaut un lien garanti qu'une jolie URL devinée qui renvoie un 404.
 */

import type { ProviderAvailability } from "@/types/tonight";

const PROVIDER_NAMES: Record<number, string> = {
  2: "Apple TV Store",
  3: "Google Play Movies",
  8: "Netflix",
  9: "Amazon Prime Video",
  10: "Amazon Video",
  11: "MUBI",
  35: "Rakuten TV",
  56: "OCS",
  192: "YouTube",
  234: "Arte",
  283: "Crunchyroll",
  337: "Disney+",
  350: "Apple TV+",
  381: "Canal+",
  531: "Paramount+",
  119: "Amazon Prime Video",
  1899: "Max",
};

/**
 * Modèles de recherche par identifiant TMDB. `{title}` est remplacé par le
 * titre encodé pour une URL. Table vérifiée : voir l'en-tête du fichier.
 */
const PROVIDER_SEARCH_URLS: Record<number, string> = {
  8: "https://www.netflix.com/search?q={title}",
  9: "https://www.primevideo.com/search?phrase={title}",
  119: "https://www.primevideo.com/search?phrase={title}",
  2: "https://tv.apple.com/search?term={title}",
  350: "https://tv.apple.com/search?term={title}",
  11: "https://mubi.com/fr/search/{title}",
  234: "https://www.arte.tv/fr/search/?q={title}",
  3: "https://play.google.com/store/search?q={title}&c=movies",
  192: "https://www.youtube.com/results?search_query={title}",
  35: "https://rakuten.tv/fr/search?query={title}",
  531: "https://www.paramountplus.com/search/?q={title}",
};

export function providerName(providerId: number): string {
  return PROVIDER_NAMES[providerId] ?? `Plateforme ${providerId}`;
}

/**
 * URL à ouvrir pour regarder une œuvre sur une plateforme donnée.
 *
 * @param provider disponibilité telle que fournie par TMDB
 * @param title titre affiché (sert aux services dont on connaît la recherche)
 * @returns `null` seulement si ni recherche connue ni lien TMDB : l'appelant
 *          affiche alors le badge sans lien plutôt qu'un lien mort.
 */
export function providerWatchUrl(
  provider: Pick<ProviderAvailability, "providerId" | "link">,
  title: string,
): string | null {
  const template = PROVIDER_SEARCH_URLS[provider.providerId];
  if (template && title.trim()) {
    return template.replace("{title}", encodeURIComponent(title.trim()));
  }
  return provider.link ?? null;
}

/**
 * Lien « voir toutes les offres » : la page JustWatch/TMDB de l'œuvre.
 * Toutes les disponibilités d'une même œuvre partagent ce lien de région.
 */
export function allOffersUrl(providers: ProviderAvailability[]): string | null {
  return providers.find((provider) => provider.link)?.link ?? null;
}

/** Petit utilitaire : les liens s'ouvrent hors de TONIGHT, sans fuiter l'URL d'origine. */
export const EXTERNAL_LINK_REL = "noopener noreferrer";

export { PROVIDER_NAMES };
