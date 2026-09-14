/**
 * Deux demandes utilisateur verrouillées par des tests :
 *  - une bande-annonce exploitable sur les fiches (§49, §50) ;
 *  - des badges de plateformes RÉELLEMENT cliquables (§22).
 *
 * Fonctions pures : aucun réseau, aucun rendu.
 */

import { describe, expect, it } from "vitest";
import type { ProviderAvailability } from "@/types/tonight";
import type { TmdbVideo } from "@/types/tmdb";
import { allOffersUrl, providerWatchUrl } from "./providers";
import { pickTrailer, youtubeEmbedUrl, youtubeWatchUrl } from "./trailers";

function video(overrides: Partial<TmdbVideo> & Pick<TmdbVideo, "key" | "type">): TmdbVideo {
  return {
    id: `v-${overrides.key}`,
    name: `Vidéo ${overrides.key}`,
    site: "YouTube",
    ...overrides,
  };
}

describe("pickTrailer", () => {
  it("ne renvoie rien quand TMDB ne fournit aucune vidéo", () => {
    expect(pickTrailer(undefined)).toBeNull();
    expect(pickTrailer([])).toBeNull();
  });

  it("ignore tout ce qui n'est pas une vidéo YouTube lisible", () => {
    // Vimeo ne s'intègre pas dans le lecteur, une clé vide ne mène nulle part.
    const videos = [
      video({ key: "abc", type: "Trailer", site: "Vimeo" }),
      video({ key: "   ", type: "Trailer" }),
    ];
    expect(pickTrailer(videos)).toBeNull();
  });

  it("préfère une vraie bande-annonce à un extrait", () => {
    const videos = [
      video({ key: "clip", type: "Clip", iso_639_1: "en" }),
      video({ key: "trailer", type: "Trailer", iso_639_1: "en" }),
      video({ key: "teaser", type: "Teaser", iso_639_1: "en" }),
    ];
    expect(pickTrailer(videos, "en")?.key).toBe("trailer");
  });

  it("privilégie la langue de l'utilisateur avant toute autre considération", () => {
    // Une VF bat un teaser officiel : c'est elle qui parle à l'utilisateur.
    const videos = [
      video({ key: "en-official", type: "Trailer", official: true, iso_639_1: "en" }),
      video({ key: "fr", type: "Teaser", official: false, iso_639_1: "fr" }),
    ];
    expect(pickTrailer(videos, "fr")?.key).toBe("fr");
  });

  it("expose la langue retenue pour prévenir qu'une vidéo est en VO", () => {
    const best = pickTrailer([video({ key: "en", type: "Trailer", iso_639_1: "en" })], "fr");
    expect(best).toEqual({ key: "en", name: "Vidéo en", language: "en", official: false });
  });

  it("construit des URLs d'intégration et de lecture sûres", () => {
    expect(youtubeWatchUrl("abc 123")).toBe("https://www.youtube.com/watch?v=abc%20123");
    const embed = youtubeEmbedUrl("abc123");
    expect(embed.startsWith("https://www.youtube-nocookie.com/embed/abc123?")).toBe(true);
    expect(embed).toContain("autoplay=1");
  });
});

function provider(overrides: Partial<ProviderAvailability>): ProviderAvailability {
  return {
    providerId: 8,
    name: "Netflix",
    logoPath: null,
    monetization: "flatrate",
    ...overrides,
  };
}

describe("providerWatchUrl", () => {
  it("mène à la recherche de la plateforme quand on la connaît", () => {
    const url = providerWatchUrl(provider({ providerId: 8, name: "Netflix" }), "Dune : deuxième partie");
    expect(url).toBe("https://www.netflix.com/search?q=Dune%20%3A%20deuxi%C3%A8me%20partie");
  });

  it("retombe sur le lien JustWatch de TMDB pour les services sans URL vérifiée", () => {
    // Disney+ n'a aucune URL de recherche garantie : mieux vaut un lien juste
    // que joli mais 404.
    const disney = provider({ providerId: 337, name: "Disney+", link: "https://www.justwatch.com/fr/x" });
    expect(providerWatchUrl(disney, "Encanto")).toBe("https://www.justwatch.com/fr/x");
  });

  it("renvoie null plutôt qu'un lien mort quand rien n'est disponible", () => {
    expect(providerWatchUrl(provider({ providerId: 4242 }), "Truc")).toBeNull();
  });

  it("ignore la recherche si le titre est vide ou blanc", () => {
    const netflix = provider({ providerId: 8, link: "https://www.justwatch.com/fr/y" });
    expect(providerWatchUrl(netflix, "   ")).toBe("https://www.justwatch.com/fr/y");
  });

  it("expose l'unique lien régional pour « voir toutes les offres »", () => {
    const providers = [
      provider({ providerId: 8, link: null }),
      provider({ providerId: 9, name: "Prime Video", link: "https://www.justwatch.com/fr/z" }),
    ];
    expect(allOffersUrl(providers)).toBe("https://www.justwatch.com/fr/z");
    expect(allOffersUrl([provider({ providerId: 8, link: null })])).toBeNull();
  });
});
