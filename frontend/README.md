# Frontend — Site AEGP

Application React + Vite + Tailwind v4 + TypeScript pour le site du BDE.

## Stack

- **React 19** + **TypeScript**
- **Vite 7** (build tool)
- **Tailwind CSS v4** (styling, plugin Vite)
- **React Router v7** (routing)
- **@supabase/supabase-js** (client BDD/Auth/Storage)

## Démarrage

### 1. Pré-requis

Avoir suivi le guide `docs/setup-outils.pdf` :
- Node 20 LTS via nvm
- Un éditeur (VS Code recommandé)

### 2. Installation des dépendances

```bash
cd frontend
npm install
```

### 3. Configuration des variables d'environnement

```bash
cp .env.example .env
```

Puis ouvre `.env` et remplis les deux variables :

- `VITE_SUPABASE_URL` — l'URL de ton projet Supabase
- `VITE_SUPABASE_ANON_KEY` — la clé publique (anon) du projet Supabase

> ⚠️ **Préfixe `VITE_` obligatoire** pour que Vite expose la variable au client. **Ne jamais** mettre de clé secrète (`service_role`) dans une variable `VITE_*` — elles sont visibles côté navigateur.

### 4. Lancer le serveur de dev

```bash
npm run dev
```

Le site est servi sur http://localhost:5173. Le hot reload est actif.

## Scripts disponibles

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (port 5173) |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Sert le build de prod localement (test avant déploiement) |
| `npm run lint` | Vérifie le code avec ESLint |
| `npm run format` | Formate le code avec Prettier |

## Structure

```
frontend/
├── public/                 # fichiers statiques (favicon, etc.)
├── src/
│   ├── components/
│   │   └── Layout.tsx      # header + footer + navigation
│   ├── lib/
│   │   └── supabase.ts     # client Supabase (singleton)
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Agenda.tsx
│   │   ├── Tutorat.tsx
│   │   └── Login.tsx
│   ├── App.tsx             # routing principal
│   ├── main.tsx            # point d'entrée
│   └── index.css           # import Tailwind
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Conventions

- **Composants** : PascalCase, un fichier `.tsx` par composant
- **Hooks custom** : préfixe `use`, dans `src/hooks/` (à créer si besoin)
- **Helpers/utils** : dans `src/lib/`, kebab-case ou camelCase
- **Tailwind** : utilitaires inline dans les composants, pas de fichier CSS séparé
- **Imports** : pas d'alias pour l'instant, chemins relatifs

## À implémenter (à venir)

- Auth Supabase (magic link)
- Page Agenda : intégration d'une lib calendrier (FullCalendar / react-big-calendar)
- Page Tutorat : navigation hiérarchique, recherche, aperçu PDF
- Page Admin (réservée aux admins) : import emails, activation comptes, modération docs
- Tests (Vitest)
