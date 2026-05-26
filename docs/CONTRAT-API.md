# Contrat API — Backend FastAPI

Document de référence pour l'équipe backend. Définit comment le frontend React et le backend FastAPI doivent communiquer.

> **Statut** : v1, à enrichir au fur et à mesure que de nouveaux endpoints arrivent.
> Dernière mise à jour : 2026-05-26.

---

## 1. Architecture générale

```
[ React (Vercel) ] ──HTTPS──> [ FastAPI (Render) ] ──SQL──> [ Supabase Postgres ]
        │                                                            ▲
        └────────── Supabase Auth (login, JWT, storage) ─────────────┘
```

- Le **front parle directement à Supabase** pour : authentification (login, logout, reset password), upload des images d'événements vers Supabase Storage.
- Le **front parle au backend FastAPI** pour toute la logique métier : créer un événement, lister/uploader des documents de tutorat, actions d'administration.
- Le **backend ne gère pas l'authentification** : il se contente de **vérifier** un JWT déjà émis par Supabase et d'en extraire l'identité de l'utilisateur.

---

## 2. Authentification (JWT Supabase)

### Côté front (déjà implémenté)

Le client HTTP `frontend/src/lib/api.ts` attache automatiquement le JWT Supabase à chaque requête authentifiée :

```http
GET /events HTTP/1.1
Host: api.siteaegp.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...
```

- Le JWT est récupéré via `supabase.auth.getSession()` — le SDK le garde en mémoire et le rafraîchit automatiquement.
- Pour un endpoint **public** (ex: liste des événements pour un visiteur non connecté), le front appelle `apiGet('/events', { auth: false })` — aucun header `Authorization` n'est envoyé.

### Côté back (à implémenter)

Le backend doit **vérifier la signature du JWT** à chaque requête protégée et **extraire l'`user_id`** depuis le claim `sub`.

**Lib recommandée** : [PyJWT](https://pyjwt.readthedocs.io/) — plus simple que `python-jose`, suffisante pour HS256.

```bash
pip install pyjwt
```

**Algorithme** : Supabase signe les JWT en **HS256** avec un secret partagé.
Récupère le secret dans le dashboard : **Project Settings → API → JWT Settings → JWT Secret**.
Stocke-le dans `.env` sous `SUPABASE_JWT_SECRET` (à ne **jamais** commiter).

**Dependency FastAPI minimale** :

```python
# backend/app/auth.py
import os
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer_scheme = HTTPBearer(auto_error=False)
JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]
JWT_AUDIENCE = "authenticated"  # claim par défaut des JWT Supabase

def get_current_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    try:
        payload = jwt.decode(
            creds.credentials,
            JWT_SECRET,
            algorithms=["HS256"],
            audience=JWT_AUDIENCE,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return payload["sub"]  # UUID Supabase de l'utilisateur
```

Usage dans une route :

```python
@app.get("/me")
def me(user_id: str = Depends(get_current_user_id)):
    return {"user_id": user_id}
```

> **Pour plus tard (V2)** : Supabase propose aussi des "asymmetric JWTs" (ES256/RS256 + JWKS) qui évitent de partager le secret. Pour la V1 HS256 est suffisant et plus simple.

---

## 3. Rôles et permissions

Le JWT Supabase contient l'identité (`sub` = user_id) mais **pas les flags `is_bde_member` / `is_admin`**. Ces flags vivent dans une table de profils côté BDD (à modéliser dans le schéma).

**Pattern recommandé** : une dependency par niveau de droit, qui fait un lookup BDD.

```python
async def require_bde_member(
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db),
) -> str:
    row = await db.fetch_one(
        "SELECT is_bde_member FROM profiles WHERE id = :id",
        {"id": user_id},
    )
    if not row or not row["is_bde_member"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "BDE member required")
    return user_id


async def require_admin(
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db),
) -> str:
    row = await db.fetch_one(
        "SELECT is_admin FROM profiles WHERE id = :id",
        {"id": user_id},
    )
    if not row or not row["is_admin"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin required")
    return user_id
```

Notes :
- Un lookup BDD par requête est OK à notre échelle (~250 étudiants). Si optim nécessaire plus tard : cache en mémoire avec TTL, ou custom claims injectés dans le JWT via un Supabase Auth Hook.
- Toujours respecter la distinction **401 vs 403** : `401` = pas authentifié, `403` = authentifié mais pas le droit.

---

## 4. Conventions HTTP

### Codes de statut

| Code | Quand l'utiliser |
|------|------------------|
| `200 OK` | Réponse standard avec corps |
| `201 Created` | Création réussie (POST) — renvoyer la ressource créée |
| `204 No Content` | Action réussie sans corps (DELETE typiquement) |
| `400 Bad Request` | Payload invalide — Pydantic le fait automatiquement |
| `401 Unauthorized` | JWT manquant, expiré, ou invalide |
| `403 Forbidden` | JWT valide mais l'utilisateur n'a pas le droit |
| `404 Not Found` | Ressource inexistante |
| `409 Conflict` | Conflit logique (ex: création en double) |
| `500 Internal Server Error` | Bug serveur — **ne pas** l'utiliser pour des erreurs métier |

### Format d'erreur

FastAPI renvoie déjà du JSON pour les `HTTPException` :

```json
{ "detail": "BDE member required" }
```

C'est suffisant en V1. Le front (`ApiError` dans `lib/api.ts`) capture déjà `status` et `body`, il peut donc afficher `body.detail` à l'utilisateur.

Pour les erreurs de validation (400), FastAPI renvoie un format plus riche :

```json
{
  "detail": [
    { "loc": ["body", "title"], "msg": "field required", "type": "value_error.missing" }
  ]
}
```

→ Le front devra savoir gérer les deux formes (string ou liste). À traiter côté front quand on en aura besoin.

### Conventions d'URL

- **kebab-case** pour les segments : `/admin-users`, pas `/adminUsers` ni `/admin_users`.
- **Pluriel** pour les collections : `/events`, `/documents`.
- **ID dans le path** : `/events/{event_id}` (UUID).
- **Pas de préfixe `/api/v1`** en V1 — on en remettra un si on doit casser la compat.

---

## 5. CORS

Le front est servi depuis `https://siteaegp.vercel.app` en prod et `http://localhost:5173` en dev. Le back doit autoriser ces origines :

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://siteaegp.vercel.app",
    ],
    allow_origin_regex=r"https://siteaegp-.*\.vercel\.app",  # preview deploys
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

> **Note preview deploys Vercel** : chaque PR génère une URL de la forme `https://siteaegp-<hash>-<team>.vercel.app`. Le `allow_origin_regex` ci-dessus les autorise toutes.

---

## 6. Variables d'environnement (back)

| Variable | Description | Où la trouver |
|----------|-------------|---------------|
| `SUPABASE_JWT_SECRET` | Secret HS256 partagé pour vérifier les JWT | Dashboard Supabase → Settings → API → JWT Secret |
| `SUPABASE_URL` | URL du projet Supabase | Dashboard Supabase → Settings → API (= `VITE_SUPABASE_URL` côté front) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé "service role" si le back doit appeler Supabase (Storage, admin) | Settings → API → service_role — **JAMAIS** côté front |
| `DATABASE_URL` | Connection string Postgres directe | Settings → Database → Connection string |
| `FRONTEND_URL` | Origine du front autorisée en CORS | Fournie par convention |

À mettre dans `.env` (gitignored, **jamais commité**) en local, et dans le dashboard Render en prod.

---

## 7. Endpoints de référence

Deux endpoints complètement spécifiés pour servir de modèle aux autres.

### `GET /events` — Liste publique des événements

**Auth** : aucune. L'agenda est public (cf rôles dans les specs v1 : visiteur ✅).

**Query params** (tous optionnels) :
- `start_date` (ISO 8601, ex: `2026-05-01`) — bornes basses de la fenêtre.
- `end_date` (ISO 8601) — borne haute.

**Réponse `200 OK`** :
```json
[
  {
    "id": "8c5d3f12-...-...",
    "title": "Soirée de rentrée",
    "description": "...",
    "start_date": "2026-09-15T20:00:00Z",
    "location": "Foyer étudiant",
    "image_url": "https://xxx.supabase.co/storage/v1/object/public/events/...",
    "external_link": "https://www.helloasso.com/...",
    "created_by": "user-uuid"
  }
]
```

**Squelette d'implémentation** :
```python
from datetime import date
from fastapi import APIRouter, Depends, Query

router = APIRouter()

@router.get("/events", response_model=list[EventOut])
async def list_events(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db = Depends(get_db),
):
    return await events_repo.list_events(db, start_date, end_date)
```

### `POST /events` — Création (membre BDE)

**Auth** : JWT valide **et** flag `is_bde_member` côté profil.

**Body** :
```json
{
  "title": "Soirée de rentrée",
  "description": "...",
  "start_date": "2026-09-15T20:00:00Z",
  "location": "Foyer étudiant",
  "image_url": "https://xxx.supabase.co/storage/v1/object/public/events/...",
  "external_link": "https://www.helloasso.com/..."
}
```

**Réponse `201 Created`** : la ressource créée, mêmes champs que `GET /events` + `id` + `created_by` (rempli côté serveur à partir du JWT, **jamais** depuis le payload).

**Réponses d'erreur** :
- `400` payload invalide (Pydantic)
- `401` pas de JWT (ou expiré)
- `403` JWT valide mais l'utilisateur n'est pas membre BDE

**Squelette d'implémentation** :
```python
@router.post("/events", response_model=EventOut, status_code=201)
async def create_event(
    payload: EventIn,
    user_id: str = Depends(require_bde_member),
    db = Depends(get_db),
):
    return await events_repo.create_event(db, payload, created_by=user_id)
```

---

## 8. Tester en local

Une fois le back lancé sur `http://localhost:8000`, tu peux tester avec `curl` :

```bash
# Endpoint public — pas de header
curl http://localhost:8000/events

# Endpoint authentifié — récupère un token via le front
# (dans la console du navigateur, sur localhost:5173, après login) :
#   (await supabase.auth.getSession()).data.session.access_token
TOKEN="eyJhbGc..."
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/me
```

---

## 9. Pour aller plus loin

- [Supabase — Auth: JWTs](https://supabase.com/docs/guides/auth/jwts) (section "Validating a Supabase JWT")
- [PyJWT documentation](https://pyjwt.readthedocs.io/)
- [FastAPI — Security](https://fastapi.tiangolo.com/tutorial/security/)
- [FastAPI — Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/) (le pattern central pour auth + RBAC)

---

**Question, ambiguïté, point à creuser** : ouvrir une issue GitHub ou en parler sur le Discord équipe.
