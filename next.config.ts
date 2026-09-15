import type { NextConfig } from "next";

/**
 * TONIGHT, configuration Next.js.
 *
 * Le token TMDB n'est JAMAIS exposé au navigateur : toutes les requêtes TMDB
 * passent par les routes serveur de `src/app/api/*` ou par les services
 * `src/lib/catalog/*` utilisés côté serveur (route handlers / server components).
 * Seules les variables préfixées NEXT_PUBLIC_ seraient visibles côté client, et
 * nous n'en utilisons aucune pour TMDB.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "img-src 'self' data: https://image.tmdb.org",
              "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
  // Le serveur de dev est aussi ouvert via 127.0.0.1 (aperçus, boucle locale) :
  // sans cette liste, Next.js bloque les ressources de dev et le HMR se coupe.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Les affiches/backdrops sont servis directement par TMDB avec la taille
  // exacte nécessaire (srcset/sizes gérés dans `PosterImage`), donc on ne
  // déclare aucune liste blanche d'optimisation d'images.
};

export default nextConfig;
