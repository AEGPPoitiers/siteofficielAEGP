# Frontend — Site AEGP

Application **React 19 + Vite + Tailwind v4 + TypeScript** pour le site du BDE.

C'est le cœur de l'application : elle parle **directement à Supabase** (Auth, données via RLS, Storage des images) et n'appelle le backend FastAPI que pour le tutorat (URLs signées Backblaze B2) et l'administration (import d'étudiants, gestion des comptes).

## Stack

- **React 19** + **TypeScript**
- **Vite** (build tool + serveur de dev)
- **Tailwind CSS v4** (styling, plugin Vite — pas de fichier CSS séparé)
- **React Router v7** (routing)
- **@supabase/supabase-js** (client BDD / Auth / Storage)
- **react-big-calendar** + **date-fns** (agenda)
- **lucide-react** (icônes)

## Démarrage

### 1. Pré-requis

Avoir suivi le guide `docs/GuideSetupOutils.pdf` : Node 20 LTS (via nvm), un éditeur (VS Code recommandé).

### 2. Installation des dépendances

```bash
cd frontend
npm install
```

### 3. Configuration des variables d'environnement

```bash
cp .env.example .env
```

Puis remplir `.env` :

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé publique (anon / publishable) du projet Supabase |
| `VITE_API_URL` | URL du backend FastAPI (ex. `http://localhost:8000` en dev, l'URL Render en prod). Requise pour le tutorat et l'admin. |

> ⚠️ **Préfixe `VITE_` obligatoire** pour que Vite expose la variable au client. **Ne jamais** mettre de clé secrète (`service_role`, clé B2…) dans une variable `VITE_*` : elles sont visibles côté navigateur.

### 4. Lancer le serveur de dev

```bash
npm run dev
```

Le site est servi sur http://localhost:5173 avec hot reload.

## Scripts disponibles

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (port 5173) |
| `npm run build` | Vérifie les types (`tsc -b`) puis build de production dans `dist/` |
| `npm run preview` | Sert le build de prod localement (test avant déploiement) |
| `npm run lint` | Vérifie le code avec ESLint |

> Prettier est installé (dépendance) ; le formatage se fait via l'intégration éditeur.

## Structure

```
frontend/
├── public/                  # fichiers statiques (favicon…)
├── src/
│   ├── assets/              # images importées (logo, affiche cafét…)
│   ├── components/
│   │   ├── Layout.tsx       # header + nav + footer + fond coloré par route
│   │   ├── ProtectedRoute.tsx      # garde « connecté »
│   │   ├── BdeProtectedRoute.tsx   # garde « membre BDE / admin »
│   │   ├── AdminProtectedRoute.tsx # garde « admin »
│   │   ├── UserMenu.tsx, NewsSection.tsx, PollWidget.tsx,
│   │   ├── EventForm.tsx, DocumentForm.tsx, NodeManager.tsx, … # briques métier
│   │   └── ui/              # primitives réutilisables (Button, Input, Textarea,
│   │                        # FieldError, FormCard, ConfirmDialog)
│   ├── contexts/
│   │   ├── AuthContext.tsx  # session Supabase + signIn/signOut/reset
│   │   └── ConfirmContext.tsx  # dialogues de confirmation
│   ├── lib/
│   │   ├── supabase.ts      # client Supabase (singleton)
│   │   ├── api.ts           # client HTTP du backend (attache le JWT)
│   │   ├── useIsBdeMember.ts   # hook rôles (isAdmin / canEditTutorat / canEditNews)
│   │   ├── news.ts, polls.ts, tutorat.ts, adminUsers.ts, studentsImport.ts, …
│   ├── pages/               # une page par route (voir ci-dessous)
│   ├── App.tsx              # routing principal
│   ├── main.tsx            # point d'entrée (providers)
│   └── index.css           # import Tailwind
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Routes

| Route | Page | Accès |
|---|---|---|
| `/` | Accueil (sondage + actus + cafét) | public |
| `/actualites` | Actualités | public (édition : admin / com) |
| `/sondages` | Sondages | public (création/clôture : admin) |
| `/agenda`, `/agenda/:id` | Agenda + détail événement | public |
| `/agenda/new`, `/agenda/:id/edit` | Créer / éditer un événement | membre BDE / admin |
| `/tutorat` | Tutorat (vue étudiant ou admin selon le rôle) | connecté |
| `/boiteaidee` | Boîte à idées (soumission + modération) | connecté |
| `/admin` | Gestion des rôles et des comptes | admin |
| `/admin/import` | Import d'étudiants par CSV | admin |
| `/login`, `/set-password`, `/reset-password` | Authentification | public |
| `*` | Page 404 | public |

## Rôles (côté front)

Le hook `useIsBdeMember` lit les flags du profil Supabase et expose :

- **`isAdmin`** — accès complet au contenu BDE (agenda, idées, tutorat, actus) et à l'admin.
- **`canEditTutorat`** — admin **ou** tuteur (`is_tutor`).
- **`canEditNews`** — admin **ou** chargé de com (`is_com`).

> Ces gardes côté client sont du confort UX. La **vraie** sécurité est dans les policies RLS Supabase et les dépendances FastAPI — voir `supabase/README.md` et `backend/README.md`.

## Conventions

- **Composants** : PascalCase, un fichier `.tsx` par composant. Primitives partagées dans `src/components/ui/`.
- **Helpers / clients** : dans `src/lib/`, camelCase.
- **Tailwind** : utilitaires inline dans les composants, pas de CSS séparé.
- **Imports** : chemins relatifs (pas d'alias).
