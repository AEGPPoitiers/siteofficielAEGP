# Site Officiel AEGP

Site officiel de l'**AEGP** (Association des Étudiant·e·s en Génie Physiologique) de l'Université de Poitiers.

🔗 **En production : https://siteofficiel-aegp.vercel.app**

## Fonctionnalités

- **Accueil** — sondage en cours (vote en ligne), dernières actualités, menu de la cafétéria.
- **Actualités** — articles (image, lien, texte de lien), filtre par année puis par mois.
- **Agenda** — calendrier des événements (vues mois / semaine), détail, image et couleur par événement.
- **Tutorat** — arborescence de cours/documents par promo et matière, aperçu et téléchargement (réservé aux comptes étudiants).
- **Boîte à idées** — soumission d'idées par les étudiants, modération côté BDE.
- **Sondages** — sondages à choix unique, résultats dévoilés à la clôture.
- **Administration** — gestion des rôles, édition des comptes, import en masse des étudiants (CSV → invitations email).

## Stack

| Couche | Techno |
|---|---|
| **Frontend** | React 19 + Vite + TypeScript + Tailwind v4 (`frontend/`) |
| **Backend** | Python + FastAPI (`backend/`) — signe les URLs B2 du tutorat, vérifie les JWT, endpoints admin |
| **BDD / Auth / Storage images** | Supabase (PostgreSQL + Auth + Storage) |
| **Stockage documents tutorat** | Backblaze B2 (bucket privé + URLs signées) |
| **Emails transactionnels** | Brevo (SMTP) — invitations et resets |
| **Hébergement** | Vercel (front) + Render (back) |

Le front parle **directement à Supabase** pour la majorité des données (Auth, RLS, Storage images). Le backend FastAPI n'intervient que là où une clé secrète est nécessaire : signature des URLs Backblaze B2 et opérations admin avec la `service_role`.

## Structure du repo

```
├── frontend/          # Application React + Vite (voir frontend/README.md)
├── backend/           # API FastAPI (voir backend/README.md)
├── supabase/          # Migrations SQL (voir supabase/README.md)
│   └── migrations/
└── docs/              # Contrat d'API, schémas, templates email, guide d'installation
    └── email-templates/
```

## Démarrage

1. Installer les outils : voir `docs/GuideSetupOutils.pdf` (Node 20 LTS, Python 3.14, VS Code recommandé).
2. Suivre le README correspondant à ce sur quoi tu travailles :
   - **Frontend** → [`frontend/README.md`](frontend/README.md)
   - **Backend** → [`backend/README.md`](backend/README.md)
   - **Base de données** → [`supabase/README.md`](supabase/README.md)

## Base de données

Les migrations SQL vivent dans `supabase/migrations/` et sont **appliquées à la main** via le SQL Editor du dashboard Supabase (pas de CLI pour l'instant). Voir [`supabase/README.md`](supabase/README.md) pour la liste, l'ordre d'application et les conventions.

## Déploiement

- **Front (Vercel)** : déploiement automatique à chaque push sur `main`. Root directory `frontend`. Variables d'environnement `VITE_*` renseignées côté Vercel.
- **Back (Render)** : service web, root directory `backend`, via `render.yaml`. Variables d'environnement dans le dashboard Render.

## Contribution

- Branche **`main` protégée** → toujours passer par une Pull Request.
- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/) (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`…).
- **Branches** : `feat/...`, `fix/...`, `refactor/...`, `docs/...`, `chore/...`.
- PR fusionnée en **squash** ; la branche est supprimée après le merge.

## Équipe

Développeurs :

- Ilan Guerizec (Promo 2028)
- Marc Bonnin (Promo 2028)

Contributeur·euse·s :
