# TONIGHT.

> **Arrête de chercher. Choisis.**
> Moins de choix. Plus de soirées.

TONIGHT aide à décider **quoi regarder ce soir** quand on ne sait pas quoi choisir.
Ce n'est pas un catalogue : c'est un **conseiller**. Une envie, quelques critères, et
TONIGHT recommande **UNE** œuvre, pas 47.

```
« Je veux un film récent, joli à regarder, avec un peu d'amour,
  pas déprimant et moins de deux heures. »

→  J'ai compris : 🎬 Film · 🔥 Récent · ❤️ Un peu d'amour · 🎨 Beau · ⏱️ < 2h · 🚫 Pas triste
→  TONIGHT, TU REGARDES…        ⭐ 7,4      92 % MATCH
   PALM SPRINGS · 2020 · 1h30 · Comédie · Romance
   « Tu voulais quelque chose de drôle, romantique, récent et assez court. »
```

---

## 1. Périmètre de la V1

Réellement fonctionnel, de bout en bout :

| Fonctionnalité | État |
| --- | --- |
| 🎬 Films | ✅ |
| 📺 Séries | ✅ |
| ✨ Recherche en langage naturel (français) | ✅ |
| ⚡ TONIGHT Express | ✅ |
| 🎲 Mode YOLO | ✅ |
| ❤️ Favoris | ✅ |
| 👁️ Déjà vu / déjà vue | ✅ |
| 🚫 Pas envie (+ raison du refus) | ✅ |
| 📜 Historique | ✅ |
| 🧠 Mes goûts | ✅ |
| 🌍 Streaming France (TMDB / JustWatch) | ✅ |
| 🎟️ Plateformes cliquables (liens de recherche vérifiés) | ✅ |
| 🎞️ Bandes-annonces (lecteur YouTube sans cookie, chargé au clic) | ✅ |
| ⏳ Chargement visible pendant la recherche | ✅ |

Hors périmètre assumé : jeux vidéo, réseau social, app mobile native, comptes,
back-office, Supabase, base de données. Les goûts vivent dans le `localStorage`.

---

## 2. Stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript** strict
- **Tailwind CSS 4**
- **Vitest** pour les tests
- **TMDB** comme source de données, interrogée dynamiquement
- **localStorage** (via un service dédié) pour les goûts et l'historique

Aucune API d'IA payante n'est nécessaire : le parser est **local** et l'explication
de la recommandation est **générée à partir des critères réels** du score.

---

## 3. Installation

Prérequis : **Node.js 20+** et npm.

```bash
npm install
```

### ⚠️ Lancer depuis cette machine

Node.js n'est pas installé globalement sur ce poste : une distribution portable a
été provisionnée dans `.tools/node` (dossier ignoré par Git). Il faut donc mettre
ce dossier en tête du `PATH` **avant** toute commande npm :

```bash
export PATH="/f/Projets/Tonight/.tools/node:$PATH"
npm run dev
```

(Sous PowerShell : `$env:PATH = "F:\Projets\Tonight\.tools\node;$env:PATH"`.)
Une fois Node installé proprement sur la machine, cette étape devient inutile.

## 4. Lancement

```bash
npm run dev          # http://localhost:3777
```

Autres commandes :

```bash
npm run typecheck    # TypeScript, sans émission
npm test             # tests parser + moteur (Vitest)
npm run build        # build de production
npm start            # serveur de production (port 3777)
npm run verify:live  # vérifie les parcours contre la VRAIE API TMDB
```

> Le port est fixé à **3777** dans `package.json` pour éviter de tomber sur un
> autre serveur de dev déjà lancé.

## 5. Configuration TMDB

1. Crée un compte sur <https://www.themoviedb.org/>
2. Paramètres → API → crée une **clé API v3** ou un **API Read Access Token (v4)**
3. Copie `.env.example` en `.env.local` et renseigne **une** des deux variables :

```bash
cp .env.example .env.local
```

```dotenv
# Option A (recommandée) : token v4 « API Read Access Token »
TMDB_READ_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiJ9...

# Option B : clé API v3 (32 caractères)
TMDB_API_KEY=0123456789abcdef0123456789abcdef

# Langue et région (FR par défaut)
TONIGHT_LANGUAGE=fr-FR
TONIGHT_REGION=FR
```

### Variables d'environnement

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `TMDB_READ_ACCESS_TOKEN` | aucun | Token v4 (Bearer). Recommandé. |
| `TMDB_API_KEY` | aucun | Clé v3 (`api_key=`). Alternative. |
| `TONIGHT_LANGUAGE` | `fr-FR` | Langue des données TMDB. |
| `TONIGHT_REGION` | `FR` | Région des plateformes de streaming. |

### 🔐 Sécurité du token

Le token **n'est jamais hardcodé** et **jamais envoyé au navigateur** :

```
Navigateur  →  /api/parse · /api/recommend · /api/catalog · /api/search · /api/status
                        ↓
              services TMDB (côté serveur uniquement)
                        ↓
                 api.themoviedb.org   (Bearer token)
```

Toutes les requêtes TMDB partent de routes serveur (`src/app/api/*`) ou de serveurs
components. Aucune variable `NEXT_PUBLIC_*` n'est utilisée pour TMDB.

Les routes publiques ajoutent également plusieurs garde-fous :

- validation stricte des corps JSON et rejet des champs inattendus ;
- taille maximale de 32 Kio (`/api/recommend`) ou 4 Kio (`/api/parse`) ;
- limites par adresse IP pour les routes de parsing, recherche et recommandation ;
- réponses `400`, `413`, `429` et `503` explicites, jamais de détail technique exposé ;
- en-têtes CSP, anti-framing, anti-MIME-sniffing et permissions navigateur minimales.

Le limiteur en mémoire protège chaque instance. Sur un déploiement distribué, il
doit être complété par une règle globale au niveau du proxy ou du WAF de
l'hébergeur.

### 🔎 Comment TONIGHT interroge TMDB

Un point capital, souvent ignoré : **`discover` ne renvoie pas tout**.

| Donnée | `discover/movie` | `discover/tv` |
| --- | --- | --- |
| durée du film | ❌ | ❌ |
| durée d'un épisode | ❌ | ❌ |
| nombre de saisons / épisodes | ❌ | ❌ |
| statut (terminée, annulée…) | ❌ | ❌ |
| plateformes de streaming | ❌ | ❌ |

Or ces informations sont le cœur de TONIGHT (« moins de 2h », « petite série
terminée »). Le mode TMDB fonctionne donc en deux temps :

1. **`discover`** : filtres larges appliqués par TMDB (genres, années, durée côté
   serveur pour les films, note, plateformes, keywords de mood), tri distant,
   plusieurs pages ;
2. **enrichissement de TOUT le pool** (`POOL_TARGET_SIZE` = 70 candidats) via
   `/movie/{id}` et `/tv/{id}` avec `append_to_response=watch/providers` : durée
   exacte, saisons, statut, plateformes. Concurrence 8, cache 24 h.

Sans cette seconde étape, les contraintes dures de durée, de saisons et de statut
ne s'appliqueraient pas. C'est exactement ce que vérifient les tests du mode TMDB
(voir la section Tests) : leurs fixtures reproduisent l'asymétrie de l'API.

Trois pièges de l'API TMDB ont été découverts en conditions réelles et sont
verrouillés par des tests :

- **`discover/tv` ignore `with_runtime`** sans renvoyer d'erreur (une série de
  57 min ressort avec `with_runtime.lte=44`). On ne l'envoie donc jamais pour les
  séries : la durée d'épisode est vérifiée après enrichissement.
- **`search/keyword` est une recherche floue** : « feel good » renvoie « feel good
  music ». Seule une correspondance exacte est acceptée : mieux vaut aucun
  keyword qu'un mauvais.
- **Les plafonds d'enrichissement sont un piège.** Un candidat non enrichi a des
  champs à `null`, et `null` ne veut pas dire « conforme » : TONIGHT ne peut pas
  promettre « maximum 2 saisons » s'il ignore le nombre de saisons. D'où le
  drapeau `Candidate.verified` : toute contrainte dure portant sur un champ
  inconnu d'un candidat **non vérifié** est traitée comme une violation, et
  l'assouplissement prend le relais en le disant à l'utilisateur (§37).

### 🎭 Mode démo (aucune clé requise)

Sans identifiant TMDB, TONIGHT **démarre quand même** : il bascule sur un catalogue
local embarqué (`src/data/demoCatalog.ts`, ~120 titres réels) et une bannière
« mode démo » s'affiche. Le parser, le moteur, le scoring, les favoris, l'historique
et toute l'interface restent 100 % fonctionnels. Les affiches et les disponibilités
streaming sont alors indisponibles (visuels générés localement).

---

## 6. Architecture

```
src/
  app/                        # routes Next.js (App Router)
    api/                      # ← seule frontière avec TMDB (côté serveur)
      status/                 #   état du token (démo ou connecté)
      catalog/                #   genres + plateformes (pool de référence)
      parse/                  #   langage naturel → TonightSearchPreferences
      recommend/              #   préférences → UNE recommandation + alternatives
      search/                 #   recherche manuelle (film / série)
    page.tsx                  # accueil (champ en langage naturel + raccourcis)
    comprendre/               # « J'ai compris » : chips éditables
    film/ serie/              # questionnaires guidés (1 question par écran)
    film/[id]/ serie/[id]/    # fiches détaillées
    express/                  # ⚡ TONIGHT Express (≈10 s)
    yolo/                     # 🎲 YOLO
    resultat/                 # écran de recommandation
    favoris/ historique/ mes-gouts/ recherche/ reglages/    naturalLanguage/            # PARSER FRANÇAIS (§7 → §15), zéro dépendance réseau
    parseRequest.ts           #   point d'entrée : parseNaturalLanguageRequest()
    normalizeText.ts          #   normalisation + analyse des négations
    dictionaries.ts           #   synonymes FR (genres, moods, durées, plateformes…)
    detectMediaType.ts        #   film / série
    detectGenres.ts           #   genres souhaités ET exclus
    detectMoods.ts            #   intentions (« faire rire », « mindfuck »)
    detectExclusions.ts       #   « pas triste », « sans horreur », combos
    detectRuntime.ts          #   durées (« moins de 2h », « 1h30 », « pas trop long »)
    detectDates.ts            #   années, décennies (« années 90 », « récent »)
    detectSeriesPreferences.ts#   saisons, statut terminée, durée d'épisode
    detectDiscovery.ts        #   pépite / incontournable / surprends-moi
    detectQuality.ts          #   niveau d'exigence et note minimale
    detectProviders.ts        #   plateformes (Netflix, Canal+…)
    chips.ts                  #   préférences → chips « J'ai compris »

  recommendation/             # MOTEUR TONIGHT (§32 → §37)
    engine.ts                 #   orchestrateur : pool → filtres → score → sélection
    ranking.ts                #   poids dynamiques, sélection avec VARIÉTÉ cadrée
    movieScore.ts             #   calculateMovieTonightScore()
    seriesScore.ts            #   calculateSeriesTonightScore()
    moodScore.ts              #   moods : genres + keywords + synopsis + conflits
    qualityScore.ts           #   qualité bayésienne (jamais une note brute)
    discoveryScore.ts         #   calculateDiscoveryScore() (pépites / mainstream)
    runtimeScore.ts           #   durées film ET épisodes de série
    providerScore.ts          #   plateformes + époque
    personalizationScore.ts   #   goûts, historique, feedback
    filters.ts                #   contraintes DURES
    relaxation.ts             #   assouplissement intelligent des critères
    explain.ts                #   « Pourquoi Tonight l'a choisi » (sans IA externe)

  storage/                    # localStorage, jamais appelé directement depuis l'UI
    storageVersion.ts safeStorage.ts
    preferences.ts history.ts favorites.ts feedback.ts tasteProfile.ts

  services/
    tmdb/                     # client HTTP, discover, details, search, genres,
                              # keywords, mappers, images (tailles correctes)
    catalog/                  # abstraction source TMDB ⇆ démo (interface unique)

  data/                       # démo, dictionnaire de moods, questionnaires,
                              # préférences vides
  components/
    providers/TonightProvider.tsx  # session : critères, propositions, exclusions
    SearchOverlay.tsx              # voile de recherche global
    DetailView.tsx cards.tsx       # fiche détaillée, grilles, badges plateformes
  hooks/ types/
  utils/
    providers.ts              # noms FR + URL de recherche par plateforme
    trailers.ts               # choix de la bande-annonce (fonction pure)
```

### Principe de conception clé

**Toutes** les méthodes de recherche produisent le **même objet interne** :
`TonightSearchPreferences`. Questionnaire Film, questionnaire Série, Express, YOLO
et langage naturel ne sont que des **producteurs de critères**.

> Le moteur de recommandation ne sait jamais d'où viennent les critères.

C'est ce qui permet de brancher plus tard un LLM sans toucher au moteur : il suffira
qu'il produise le même objet.

---

## 7. Comment fonctionne le parser

`parseNaturalLanguageRequest(text)` est **synchrone et local** :

```
texte brut
   ↓  normalizeText            normalisation (accents, ponctuation, élisions)
   ↓  détecteurs indépendants  média · genres · moods · dates · durée ·
   ↓                           exclusions · séries · découverte · qualité · plateformes
   ↓  analyse des négations    « pas », « sans », « sauf », « évite »,
   ↓                           « pas forcément » (qui NE nie PAS le critère)
   ↓  assemblage               TonightSearchPreferences + hardConstraints +
   ↓                           softPreferences + chips + confidence
TonightSearchPreferences { confidence: 0.96, … }
```

### Négations (§12)

C'est la partie la plus délicate, et elle est testée sérieusement :

| Phrase | Interprétation |
| --- | --- |
| « pas d'horreur » | genre **exclu** (contrainte dure) |
| « pas triste » | mood `sad` **pénalisé** (préférence `notHeavy`) |
| « pas trop vieux » | préférence **souple** pour du récent, pas une borne dure |
| « pas forcément récent » | ⚠️ **n'active pas** la préférence « récent » |
| « romantique mais pas une comédie romantique » | romance ✅, combo romance+comédie **pénalisé** |

### Hard constraints vs soft preferences (§13)

| Demande | Type | Effet |
| --- | --- | --- |
| « moins de 2h » | **dur** | `maxRuntime = 120` |
| « pas trop long » | **souple** | viser ~110 min, sans exclure |
| « je veux absolument une série terminée » | **dur** | `seriesEnded` |
| « terminée si possible » | **souple** | bonus au score |
| « pas d'horreur » | **dur** | genre exclu |

Un **hard constraint n'est jamais cassé silencieusement** : soit il tient, soit
l'utilisateur est prévenu (« J'ai quelque chose à 1h36 qui colle parfaitement au reste. »).

### Confiance (§15)

Le parser renvoie une `confidence` (0 → 0.97). Sous le seuil, TONIGHT pose **UNE**
question (« Plutôt ? 🎬 FILM / 📺 SÉRIE / 🎲 CHOISIS POUR MOI ») au lieu de partir
dans la mauvaise direction, jamais un questionnaire de douze étapes.

---

## 8. Comment fonctionne le scoring

Chaque candidat reçoit un **Tonight Score** (0 → 1), puis un **% MATCH** affiché.

```
moodMatch       25 %   intentions (genres + keywords + synopsis + conflits)
genreMatch      18 %   genres souhaités, exclus, combinaisons refusées
qualityScore    17 %   qualité BAYÉSIENNE (voir ci-dessous)
discoveryScore  13 %   pépite / valeur sûre / incontournable
runtimeMatch    10 %   durée (film) ou durée d'épisode (série)
providerMatch    9 %   disponibilité en France
eraMatch         5 %   époque
personalTaste    3 %   goûts appris + historique
```

Les **poids sont dynamiques** : une dimension dont l'utilisateur n'a rien dit est
neutralisée pour ne pas diluer celles qui comptent réellement.

Puis des **pénalités multiplicatives** : contenus déjà vus, déjà refusés, feedbacks
négatifs. Une œuvre refusée ne remonte jamais parce qu'elle matche bien.

### Qualité : jamais une note brute (§34)

```
Film A : 9,8/10 (8 votes)       →  ne gagne PAS contre
Film B : 8,2/10 (95 000 votes)
```

`calculateQualityConfidence()` applique un **lissage bayésien** : la note est tirée
vers la moyenne globale d'autant plus fort que le nombre de votes est faible.

### Pépites (§35)

`calculateDiscoveryScore()` ne cherche pas « popularité basse ». Une pépite =
**bonne note + assez de votes + popularité sous les blockbusters + confiance
statistique**. Un film inconnu avec 12 votes n'est pas une pépite, c'est un trou noir.

### Variété sans perdre la pertinence (§36)

Sur les 20 meilleurs candidats, la sélection tire au sort… **mais uniquement à
l'intérieur d'une bande de pertinence** autour du meilleur score. Un « surprends-moi »
élargit la bande, une demande précise la resserre. L'aléatoire ne s'éloigne jamais
du haut du classement : TONIGHT ne sacrifie pas la pertinence pour du hasard.

### Assouplissement intelligent (§37)

Si rien ne correspond, TONIGHT ne renvoie **pas** « Aucun résultat » : il relâche
les critères **souples** en commençant par les moins importants, trace chaque
relâchement et l'explique. Demande typique restée sans réponse :

> « Je n'ai rien trouvé sur Netflix, mais j'ai un très bon candidat sur Prime Video. »

---

## 9. Stockage local & confidentialité (§44 → §46, §68)

Tout vit dans le navigateur, via `src/storage/*` (jamais `localStorage` en direct
depuis les composants) :

| Clé | Contenu |
| --- | --- |
| `tonight.preferences` | plateformes mémorisées, réglages |
| `tonight.history` | recommandations et leur statut (accepté / vu / favori / refusé) |
| `tonight.favorites` | films et séries mis en favori |
| `tonight.feedback` | raisons de refus (« trop long », « pas le mood »…) |
| `tonight.taste` | profil de goûts dérivé (genres, moods, époques, durée) |

- Chaque enregistrement porte un **numéro de version** (`storageVersion.ts`) pour
  permettre les migrations futures.
- Le profil de goûts n'est **pas** du machine learning : ce sont des **poids
  évolutifs** lisibles et affichables tels quels dans « Mes goûts ».
- **Aucun compte, aucun serveur, aucun tracking.** « Tes préférences restent sur cet
  appareil. » Et un bouton **SUPPRIMER MES DONNÉES LOCALES** dans Réglages.

---

## 10. Tests

```bash
npm test
```

- `src/naturalLanguage/parseRequest.test.ts` couvre 31 cas du parser français (§70) :
  négations, durées, décennies, saisons, plateformes, confiance, contrainte dure
  vs préférence tempérée, les 18 phrases de référence de la spécification.
- `src/recommendation/scoring.test.ts` couvre 26 cas du scoring (§71) : qualité avec
  peu/beaucoup de votes, pépites (y compris au niveau du score FINAL),
  incontournables, hard constraints, ordre des alternatives, assouplissement.
- `src/recommendation/relaxation.test.ts` couvre 6 cas de l'assouplissement (§37) :
  ordre des tentatives, et surtout **desserrer une contrainte dure sans la
  lâcher** (une « mini-série » élargie à 3 saisons reste bornée à 3 saisons).
- `src/recommendation/engine.test.ts` couvre 10 cas du parcours critique (§72) :
  demande en français → préférences → pool → score → UNE reco → « un autre » →
  refus → nouvelle reco, sur films **et** séries, plus YOLO.
- `src/utils/mediaLinks.test.ts` couvre 11 cas des liens sortants : sélection de la
  bande-annonce (VF avant teaser VO, jamais un site non intégrable) et résolution
  des URL de plateformes (recherche connue, repli JustWatch/TMDB, jamais de lien
  mort).
- `src/recommendation/nextOffer.test.ts` couvre 7 cas du tirage de « UN AUTRE » :
  jamais la proposition courante, jamais une déjà vue, exploration complète du lot
  avant épuisement, et surtout **ce n'est pas l'index suivant** (avec un aléa qui
  balaie la plage, tous les index restants doivent pouvoir sortir).
- `src/services/catalog/tmdbSource.test.ts` couvre 16 cas du **mode TMDB** avec un
  faux serveur TMDB **fidèle** (les listes `discover` n'y portent ni durée, ni
  saisons, ni statut, ni plateformes ; `discover/tv` y ignore `with_runtime` ;
  `search/keyword` y est flou ; `episode_run_time` y est vide pour certaines
  séries, exactement comme chez TMDB) : enrichissement, repli de la durée
  d'épisode, piscines de format (mini-série, sitcom), contraintes dures
  réellement appliquées, résolution des keywords, 429, clé refusée.

Les tests tournent **sans réseau et sans clé TMDB** : le catalogue de démonstration
pour les uns, un faux serveur TMDB en mémoire pour les autres.

### Vérification en vraie grandeur : `npm run verify:live`

Les tests unitaires ne peuvent pas attraper les propriétés de l'API elle-même.
D'où `scripts/verify-tmdb.mjs`, qui rejoue six phrases de référence contre TMDB
et échoue si le contrat n'est pas tenu :

```bash
npm run build && npm start   # dans un terminal
npm run verify:live          # dans un autre
```

Pour chaque phrase, sur plusieurs tirages :

- **ce que TONIGHT a compris** (type, durée, saisons, statut, niveau de découverte) ;
- **les contraintes dures sur CHAQUE œuvre renvoyée**, et non seulement sur la
  première, relues depuis le **contrat effectif** (`appliedPreferences`), pas
  depuis la demande initiale ;
- **aucune contrainte cassée en silence** : si une dimension n'est plus appliquée,
  un assouplissement doit l'annoncer (§37) ;
- **la cohérence du classement** : alternatives triées, jamais mieux notées que la
  recommandation principale ;
- **les données enrichies** : `verified`, affiche et backdrop présents ;
- le mode, la latence et les assouplissements, dans un rapport lisible.

Sortie : code 0 si tout est conforme, 1 sinon. C'est ce harnais qui a révélé, en
conditions réelles, les bugs que le catalogue de démonstration masquait :
contraintes dures jamais appliquées, `discover/tv` qui ignore `with_runtime`,
keywords de mood inexistants, mode pépite couronnant un blockbuster,
assouplissement qui *retirait* la contrainte au lieu de la desserrer, et
`episode_run_time` vide pour la plupart des séries.

```bash
npm run verify:live -- --base=http://127.0.0.1:4000   # autre port
npm run verify:live -- --seeds=1,7,13,21              # plus de tirages
```

---

## 11. Session, chargement et liens sortants

### Ce qui se passe pendant une recherche

Une recherche TMDB coûte 1 à 3 secondes : `discover` renvoie une liste, puis
chaque candidat est enrichi (`/movie/{id}`, `/tv/{id}`) pour obtenir durée,
saisons, statut et plateformes. Sans retour visuel, un bouton qui ne bouge pas
donne l'impression que rien ne se passe.

`SearchOverlay` est monté **dans le layout**, à l'intérieur du contexte de
session : il s'affiche au-dessus de n'importe quelle page qui déclenche une
recherche (accueil, `comprendre`, questionnaires, Express, YOLO, fiche, résultat).
Les phrases défilent (§58) et il n'ajoute **aucune** attente artificielle. Un
délai d'apparition de 220 ms évite un clignotement plein écran sur une réponse
déjà en cache.

### Exclusions de session : « un autre » vs « nouvelle recherche »

C'est le point qui décide si TONIGHT repropose toujours le même titre, ou si au
contraire il finit par ne plus rien trouver.- **Continuation** (`🎲 UN AUTRE`, `🎲 Trouver quelque chose de similaire`):
  les exclusions **s'accumulent** pendant toute la session. L'œuvre affichée est
  en plus exclue *explicitement*, sans quoi elle revient en tête, puisque c'est
  elle qui correspond le mieux à ses propres genres.

### « UN AUTRE » tire au hasard, il ne descend pas la liste

Avancer d'un cran dans `offers` revenait à dérouler « Mes idées pour ce soir »
dans l'ordre : on voyait le carrousel défiler et TONIGHT ne semblait plus
trancher. `pickNextOfferIndex()` (`src/recommendation/nextOffer.ts`, fonction
pure) tire donc **au hasard parmi les propositions pas encore montrées**, sans
jamais revenir sur la courante. Toutes viennent de la même bande de pertinence
(§36), donc le tirage reste de qualité ; il n'est juste plus prévisible. La
bande estompe les propositions déjà vues et recentre celle qui est affichée.

Quand tout le lot est passé, on relance une recherche en excluant le lot entier,
puisque ses affiches étaient visibles à l'écran.

### La barre d'actions ne bouge pas

Objectif : pouvoir enchaîner « 🎲 UN AUTRE » sans que le bouton se dérobe sous le
curseur. Le bloc de recommandation est donc ordonné pour que **rien de variable
ne se trouve au-dessus des boutons** :

- titre réservé sur **deux lignes**, synopsis sur **quatre lignes** (avec un
texte de repli quand TMDB n'en fournit pas), ligne de métadonnées sur **une
ligne** ;
- la ligne des **plateformes** est placée **après** les boutons : avec
  `showMonetization`, elle occupe une à trois lignes selon le titre et les offres,
  et c'est de loin le premier facteur de variation. En dessous, elle peut grandir
  (y compris quand on déplie le « +N autres ») sans rien déplacer au-dessus ;
- la ligne de confirmation (« Bon visionnage ») a un **emplacement réservé**.

Mesuré en conditions réelles : la position du bouton est **identique sur 12
tirages consécutifs**, y compris après dépliage de « +N autres ».
- **Nouvelle intention** (champ en langage naturel, questionnaire, Express, YOLO,
  « réessayer », « assouplir mes critères ») : `runSearch(..., { resetExcluded: true })`
  repart d'une liste vierge. Sans cela, les refus des recherches précédentes
  s'empilaient sans fin et finissaient par vider le catalogue : le « au bout d'un
  moment il ne met plus rien ».

Les refus et les « déjà vus » restent exclus dans tous les cas : ils ne viennent
pas de la session mais de l'historique local, injecté côté moteur.

### Plateformes et bandes-annonces

TMDB ne fournit **qu'un seul** lien de région par œuvre (la page JustWatch). Un
badge « Netflix » non cliquable n'apprend donc rien : `utils/providers.ts`
complète avec des URL de **recherche** propres à chaque service (Netflix, Prime
Video, Apple TV, MUBI, Arte, Google Play, YouTube, Rakuten, Paramount+), toutes
vérifiées une par une. Les services dont l'URL n'est pas garantissable (Disney+,
Max, Canal+) retombent sur le lien TMDB, toujours valide. Un badge sans lien
reste affiché sans lien plutôt que de pointer vers un 404. Le compte « +N » est un
bouton qui **déplie** la liste.

Les bandes-annonces (`utils/trailers.ts`) sont choisies par une fonction pure :
vraie bande-annonce avant teaser, **version française avant tout le reste**, et
uniquement des vidéos YouTube intégrables. Le lecteur n'est chargé qu'au clic et
via `youtube-nocookie.com` : aucune page de TONIGHT ne dépose de cookie YouTube
sans action explicite.

---

## 12. Build production

```bash
npm run build
npm start            # http://localhost:3777
```

Le token TMDB n'est lu qu'au moment des requêtes serveur : le build n'a besoin
d'aucun secret.

---

## 13. Données et attributions

- Données films/séries, affiches et backdrops : **TMDB**
  (<https://www.themoviedb.org/>).
- Disponibilités de streaming : fournies par TMDB, issues de **JustWatch**.
  L'attribution « JustWatch » est affichée dans l'interface.

TMDB impose l'affichage de cette notice, présente dans le pied de page de
l'application :

> This product uses the TMDB API but is not endorsed or certified by TMDB.

TONIGHT n'est donc **pas** un produit TMDB : c'est une application indépendante
qui consomme leur API.
