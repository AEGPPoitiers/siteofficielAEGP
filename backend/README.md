# Backend — FastAPI

API du site BDE. Deux responsabilités, là où une **clé secrète** est nécessaire et ne peut donc pas vivre côté navigateur :

1. **Signataire d'URLs Backblaze B2** pour le module tutorat (le bucket est privé ; le front ne peut pas signer sans exposer la clé secrète B2).
2. **Opérations d'administration** via la `service_role` Supabase (gestion des rôles, édition des comptes, import en masse des étudiants).

Voir `docs/CONTRAT-API.md` pour les conventions générales.

## Périmètre

- **Métadonnées** (taxonomie tutorat, lignes documents, événements, idées, actualités, sondages) : le front parle **directement à Supabase** (RLS). Le backend ne s'en occupe pas.
- **Octets des fichiers tutorat** (bucket B2 privé) : le front passe par le backend pour obtenir des **URLs signées** (upload, download/preview) et supprimer un objet.
- **Admin** : endpoints protégés qui agissent avec la `service_role` (lister/éditer les comptes, inviter en masse, supprimer une promotion).

## Authentification

Supabase signe ses access tokens avec des **clés asymétriques (ES256)**, exposées sur le JWKS public `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (le `kid` du token sélectionne la clé). Le backend les vérifie via `PyJWKClient` (`auth.py`), avec un repli HS256 legacy optionnel.

> ⚠️ Un endpoint qui renvoie **401** = problème de validation du token (token manquant / expiré / mauvais algo). Un **403** = token valide mais **rôle insuffisant**. Ne pas confondre lors du debug.

Les rôles sont résolus dans `deps.py` en interrogeant la table `profiles` (via PostgREST + `service_role`) :

| Dépendance | Autorise | Usage |
|---|---|---|
| `require_bde_member` | `is_admin` | écriture du contenu BDE côté backend |
| `require_admin` | `is_admin` | gestion des rôles et des comptes |
| `require_tutorat_editor` | `is_admin` **ou** `is_tutor` | édition du tutorat |

> Le flag `is_bde_member` a été **fusionné dans `is_admin`** (migration `0016`). Le rôle « com » (`is_com`, actualités) est géré **uniquement par RLS** côté Supabase — pas d'endpoint FastAPI.

## Structure

```
backend/
  app/
    main.py             # app FastAPI + CORS + inclusion des routers
    config.py           # lecture des env vars (pydantic-settings)
    auth.py             # get_current_user_id (JWT Supabase ES256 via JWKS)
    deps.py             # require_bde_member / require_admin / require_tutorat_editor
    b2.py               # client boto3 + URLs signées B2
    routers/
      tutorat.py        # endpoints /tutorat/*
      admin.py          # endpoints /admin/*
  scripts/
    set_b2_cors.py      # configure le CORS du bucket B2 (API native B2, stdlib only)
  requirements.txt
  render.yaml           # déploiement Render
  .env.example
```

## Endpoints

### Tutorat (`/tutorat`)

| Méthode | Chemin | Auth | Rôle |
|---|---|---|---|
| `POST` | `/tutorat/presign-upload` | JWT | **éditeur tutorat** — `{node_id, file_name, content_type}` → `{upload_url, file_key, expires_in}` |
| `GET` | `/tutorat/download-url?key=&disposition=attachment\|inline&file_name=&content_type=` | JWT | authentifié → `{url, expires_in}` |
| `DELETE` | `/tutorat/object?key=` | JWT | **éditeur tutorat** — supprime l'objet B2 |

> La `file_key` est **générée côté serveur** au presign (`tutorat/<node_id>/<uuid>.<ext>`), jamais fournie par le client.

### Administration (`/admin`)

| Méthode | Chemin | Rôle | Effet |
|---|---|---|---|
| `GET` | `/admin/users` | admin | liste des comptes (profils + emails) |
| `PATCH` | `/admin/users/{id}` | admin | bascule des rôles (`is_tutor`, `is_com`) |
| `PATCH` | `/admin/users/{id}/info` | admin | édite nom / promotion / email d'un compte |
| `POST` | `/admin/users/import` | admin | import CSV → invitations Supabase (lot ≤ 100) |
| `DELETE` | `/admin/users/{id}` | admin | supprime un compte (hors admins) |
| `DELETE` | `/admin/users/by-promotion/{promo}` | admin | supprime tous les comptes d'une promo (hors admins) |

### Divers

| Méthode | Chemin | Auth | Rôle |
|---|---|---|---|
| `GET` | `/health` | — | ping |

## Lancer en local

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # puis remplir les valeurs
uvicorn app.main:app --reload --port 8000
```

Tester (récupérer un token via la console du front, cf `docs/CONTRAT-API.md`) :

```bash
curl http://localhost:8000/health

TOKEN="eyJhbGc..."   # (await supabase.auth.getSession()).data.session.access_token
curl -X POST http://localhost:8000/tutorat/presign-upload \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"node_id":"<uuid-matiere>","file_name":"cours.pdf","content_type":"application/pdf"}'
```

`403` attendu si le compte n'est pas éditeur tutorat ; `401` si le token manque ou a expiré.

### Configuration du CORS B2

L'upload se fait par un PUT direct navigateur → B2, soumis au CORS du bucket. B2 n'expose pas `PutBucketCors` (S3) ; on configure via l'API native B2 :

```bash
python scripts/set_b2_cors.py   # nécessite une clé B2 avec la capability writeBuckets (Master Key)
```

## Déploiement (Render)

Service web, root directory `backend`, via `render.yaml`. Renseigner les variables d'environnement (cf `.env.example`) dans le dashboard Render. Puis pointer le front dessus en définissant `VITE_API_URL` (local `frontend/.env` + Vercel).

> ⚠️ **Free tier** : le service s'endort après ~15 min d'inactivité (cold start ~30–50 s). Le premier upload/download après inactivité est lent — l'UI prévoit un spinner et une suppression optimiste.
