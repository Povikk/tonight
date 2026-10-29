# TONIGHT

TONIGHT aide à choisir un film ou une série à regarder selon ses envies, le temps disponible et ses plateformes de streaming. Une demande en français ou quelques réponses à un questionnaire donnent une recommandation principale, des alternatives et une explication du choix.

[Ouvrir l’application](https://tonight.povik.workers.dev/)

## Fonctionnalités

- Décrire une envie en français : « Un thriller des années 90 de moins de deux heures », par exemple.
- Choisir ses critères dans les questionnaires Film et Série : ambiance, époque, durée, saisons, statut et plateformes.
- Utiliser Express pour un parcours en quatre étapes, ou YOLO pour obtenir une suggestion sans questionnaire.
- Affiner un résultat avec les boutons « Plus récent », « Plus court », « Moins effrayant » ou une demande libre.
- Demander une autre proposition ou chercher un titre similaire.
- Consulter les fiches, les notes, les bandes-annonces disponibles et les plateformes de diffusion en France.
- Rechercher un titre, l’ajouter aux favoris, le marquer comme déjà vu ou indiquer pourquoi il ne convient pas.
- Retrouver son historique, consulter et ajuster ses goûts, exporter ou supprimer ses données locales.

## Fonctionnement

Les différents parcours alimentent le même moteur de recommandation. Il compare les titres selon les critères demandés, les notes et leur nombre de votes, les disponibilités et les préférences issues de l’historique. Si les critères sont trop restrictifs, il peut les élargir et signale les assouplissements appliqués.

L’analyse du français repose sur des règles et des dictionnaires intégrés au projet. Elle ne nécessite aucun service d’intelligence artificielle externe.

L’application fonctionne sans compte. Les favoris, l’historique, les refus et les réglages sont conservés dans le navigateur. Le profil et les critères sont transmis à l’API de l’application lors d’une recommandation, sans stockage persistant du profil côté serveur.

## Technologies utilisées

- TypeScript, React 19 et Next.js 16 avec l’App Router.
- Tailwind CSS 4 pour les styles.
- Zod pour la validation des requêtes API.
- Vitest pour les tests automatisés.
- Vite et Vinext pour la version déployée sur Cloudflare Workers ; Wrangler pour le déploiement.
- Cloudflare Workers KV pour les notes IMDb et GitHub Actions pour leur import quotidien.
- `localStorage` pour les données personnelles conservées sur l’appareil.

Les fiches, les images et les bandes-annonces proviennent de [TMDB](https://www.themoviedb.org/). Les disponibilités de streaming sont issues de JustWatch via TMDB. Les notes IMDb proviennent du jeu de données officiel non commercial ; si elles ne sont pas disponibles, l’application affiche les notes TMDB.

## Installation et utilisation

L’[application en ligne](https://tonight.povik.workers.dev/) s’utilise directement, sans installation.

Pour lancer le projet en local, il faut Node.js **22.12 ou supérieur** et npm. Depuis la racine du dépôt :

```bash
npm install
npm run dev
```

L’application est accessible sur [http://localhost:3777](http://localhost:3777).

Sans identifiant TMDB, elle utilise automatiquement un catalogue de démonstration intégré. Ce mode permet d’essayer les recommandations et les fonctions locales, avec un catalogue limité et sans les images ni les bandes-annonces de TMDB.

### Connecter TMDB

Copier `.env.example` vers `.env.local`, puis renseigner un jeton de lecture ou une clé API obtenue depuis un compte TMDB. Une seule des deux variables suffit :

```dotenv
TMDB_READ_ACCESS_TOKEN=votre_jeton_de_lecture
# Ou : TMDB_API_KEY=votre_cle_api

TONIGHT_LANGUAGE=fr-FR
TONIGHT_REGION=FR
```

Redémarrer le serveur après modification. Les identifiants TMDB sont utilisés côté serveur et ne doivent pas être publiés dans le dépôt.

### Commandes utiles

```bash
npm test                # Tests automatisés
npm run typecheck       # Vérification TypeScript
npm run build           # Compilation de production Next.js
npm start               # Serveur de production sur le port 3777
npm run dev:vinext      # Développement avec Vinext sur le port 3001
npm run build:vinext    # Compilation pour Cloudflare Workers
```

`npm run verify:live` vérifie les recommandations contre TMDB. Cette commande nécessite un serveur déjà lancé sur le port 3777 et des identifiants TMDB configurés.

Le déploiement Workers et l’import des notes IMDb utilisent les ressources définies dans `wrangler.jsonc`. Pour déployer sa propre instance, il faut adapter le compte et l’espace KV à son environnement. Les données IMDb sont soumises à leurs conditions d’utilisation personnelle et non commerciale.

## Auteur

**Jonathan Ragot**

GitHub : [Povikk](https://github.com/Povikk)
