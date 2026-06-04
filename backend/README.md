# Backend — FastAPI

API du site BDE. Sert de **signataire d'URLs Backblaze B2** pour le module tutorat
(le front ne peut pas signer sans exposer la clé secrète B2) et vérifie les JWT
Supabase. Voir `docs/CONTRAT-API.md` pour les conventions générales.

## Rôle

- **Métadonnées** (taxonomie, lignes documents, événements, idées) : le front parle
  **directement à Supabase** (RLS). Le backend ne s'en occupe pas.
- **Octets des fichiers tutorat** (bucket B2 privé) : le front passe par le backend
  pour obtenir des **URLs signées** (upload, download/preview) et supprimer un objet.

## Structure

```
backend/
  app/
    main.py            # app FastAPI + CORS + routes
    config.py          # lecture des env vars (pydantic-settings)
    auth.py            # get_current_user_id (JWT Supabase HS256)
    deps.py            # require_bde_member (lookup profiles via REST + service role)
    b2.py              # client boto3 + URLs signées
    routers/tutorat.py # endpoints /tutorat/*
  requirements.txt
  render.yaml          # déploiement Render
  .env.example
```

## Endpoints

| Méthode | Chemin | Auth | Rôle |
|---|---|---|---|
| `GET` | `/health` | — | ping |
| `POST` | `/tutorat/presign-upload` | JWT | **BDE** — `{node_id, file_name, content_type}` → `{upload_url, file_key, expires_in}` |
| `GET` | `/tutorat/download-url?key=&disposition=attachment\|inline&file_name=&content_type=` | JWT | authentifié → `{url, expires_in}` |
| `DELETE` | `/tutorat/object?key=` | JWT | **BDE** — supprime l'objet B2 |

> La `file_key` est **générée côté serveur** au presign (`tutorat/<node_id>/<uuid>.<ext>`),
> jamais fournie par le client.

## Lancer en local

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # puis remplir les valeurs
uvicorn app.main:app --reload --port 8000
```

Tester (récupérer un token via la console du front, cf `docs/CONTRAT-API.md` §8) :

```bash
curl http://localhost:8000/health

TOKEN="eyJhbGc..."   # (await supabase.auth.getSession()).data.session.access_token
curl -X POST http://localhost:8000/tutorat/presign-upload \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"node_id":"<uuid-matiere>","file_name":"cours.pdf","content_type":"application/pdf"}'
```

`403` attendu si le compte n'est pas membre BDE ; `401` si le token manque/expire.

## Déploiement (Render)

Service web, root directory `backend`, via `render.yaml`. Renseigner les env vars
(cf `.env.example`) dans le dashboard Render. Puis pointer le front dessus en
définissant `VITE_API_URL` (local `frontend/.env` + Vercel).

> ⚠️ Free tier : le service s'endort après ~15 min d'inactivité (cold start ~30–50 s).
> Le premier upload/download après inactivité est lent — l'UI doit prévoir un spinner.
