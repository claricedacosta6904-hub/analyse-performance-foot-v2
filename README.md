# ANALYSE DE PERFORMANCE FOOT ⚽

Application web d'analyse automatique des performances de tes équipes de football, connectée en direct à API-Football, avec cache intelligent et suivi des matchs en direct.

## Fonctionnalités

- Import d'une liste d'équipes (collées en une fois), avec recherche et correspondance automatique sur API-Football
- Dashboard, Équipes, Matchs, Classement, Forme, Domicile, Extérieur, Analyse comparative, Paramètres
- Clé API jamais exposée au navigateur (elle reste côté serveur, dans Netlify)
- Cache intelligent (Netlify Blobs) pour économiser le quota API — se raccourcit automatiquement pendant un match en direct
- Export CSV sur chaque page
- Messages d'erreur clairs (quota atteint, équipe introuvable, API indisponible...)

## Comment déployer (étapes pour débutant, aucune connaissance technique requise)

**1. Récupérer le ZIP**
Télécharge `analyse-performance-foot-complet.zip` et décompresse-le sur ton appareil (sur tablette : ouvre-le dans ton application de fichiers et choisis "Décompresser" / "Extraire").

**2. Le mettre sur GitHub**
Crée un compte sur [github.com](https://github.com) si besoin, puis crée un nouveau dépôt (bouton "New repository"), vide, sans aucune case cochée. Ajoute ensuite tous les fichiers du dossier décompressé dans ce dépôt, en conservant bien les dossiers (`src`, `netlify`, etc.) — si tu es sur tablette et que l'upload classique perd les sous-dossiers, utilise l'éditeur intégré **github.dev** (remplace `github.com` par `github.dev` dans l'adresse de ton dépôt) : il permet de glisser le dossier complet dans le panneau de gauche en conservant sa structure, puis de valider avec "Commit & Push".

**3. Connecter le dépôt à Netlify**
Sur [app.netlify.com](https://app.netlify.com), "Add new site" → "Import an existing project" → connecte ton compte GitHub → choisis ton dépôt. Les réglages de build sont déjà détectés automatiquement grâce au fichier `netlify.toml` fourni (`npm run build`, dossier `dist`, fonctions dans `netlify/functions`).

**4. Ajouter la variable API_FOOTBALL_KEY**
Avant de déployer : "Site configuration" → "Environment variables" → ajoute une variable nommée exactement `API_FOOTBALL_KEY`, avec ta vraie clé API-Football comme valeur.

**5. Lancer le déploiement**
Clique sur "Deploy site". Netlify installe tout et construit l'application automatiquement (`npm install` puis `npm run build` tournent sur les serveurs de Netlify — tu n'as rien à faire sur ton appareil).

**6. Ouvrir l'application**
Une fois le déploiement terminé ("Published"), Netlify te donne une URL (ex. `https://ton-site.netlify.app`). Ouvre-la directement : l'application fonctionne seule, sans repasser par Claude.

## Structure du projet

```
analyse-performance-foot/
├── index.html
├── package.json
├── vite.config.js
├── netlify.toml
├── .env.example
├── netlify/
│   └── functions/
│       ├── football.js       → proxy API-Football + cache + gestion des erreurs
│       └── clear-cache.js    → vide le cache serveur (bouton Paramètres)
└── src/
    ├── main.jsx, App.jsx, index.css
    ├── components/            → Sidebar, Header, badges, messages d'état, ballon d'arrière-plan
    ├── context/TeamsContext.jsx → état global (équipes, cache client, détection des matchs en direct)
    ├── pages/                 → Accueil, Équipes, Matchs, Classement, Forme, Domicile, Extérieur, Analyse, Paramètres
    ├── services/api.js        → appels vers les Netlify Functions
    ├── utils/                 → calculs de forme, correspondance de noms, export CSV, statuts live
    └── data/config.js         → saison en cours, navigation
```

## Notes importantes

- `API_FOOTBALL_KEY` ne doit jamais apparaître dans le code frontend — seulement dans les variables d'environnement Netlify. Le fichier `.env.example` ne contient que le nom de la variable, pas de vraie clé.
- Le cache serveur évite de refaire 51 appels API à chaque ouverture ; pendant un match en direct, seule l'équipe concernée est rafraîchie plus souvent (toutes les minutes).
- Si le quota API est atteint ou si l'API est indisponible, l'application affiche les dernières données connues avec un message clair plutôt qu'une erreur technique.
- La saison utilisée est définie dans `src/data/config.js` (`CURRENT_SEASON`) — modifiable à un seul endroit.
- Aucune donnée fictive : tout provient d'API-Football via le backend.
