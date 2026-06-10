"""Endpoints admin : gestion des rôles (flags `profiles`). Réservé aux admins.

Les emails vivent dans `auth.users` (schéma protégé, non lisible côté front) : on
les récupère via l'API admin GoTrue avec la service role key, et on lit/écrit les
flags via PostgREST (la service role bypasse la RLS). Le front ne voit jamais la
service role.

On n'expose volontairement PAS la modification de `is_admin` ici (garde-fou contre
l'auto-exclusion / escalade) — la gestion des admins reste manuelle (SQL).
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..config import get_settings
from ..deps import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])

_PAGE_SIZE = 200


class AdminUser(BaseModel):
    id: str
    email: str | None = None
    full_name: str | None = None
    promotion: str | None = None
    is_admin: bool = False
    is_tutor: bool = False
    is_com: bool = False


class UpdateRolesIn(BaseModel):
    is_tutor: bool | None = None
    is_com: bool | None = None


class UpdateUserInfoIn(BaseModel):
    # Champs d'identité éditables par l'admin. `exclude_unset` côté endpoint :
    # seuls les champs réellement envoyés sont modifiés (promotion="" → effacée).
    full_name: str | None = None
    promotion: str | None = None
    email: str | None = None


class ImportStudentIn(BaseModel):
    email: str
    full_name: str | None = None
    promotion: str | None = None


class ImportRequestIn(BaseModel):
    students: list[ImportStudentIn]


class ImportItemError(BaseModel):
    email: str
    message: str


class ImportResult(BaseModel):
    invited: list[str]
    updated: list[str]  # déjà inscrits dont la promotion a été mise à jour (scénario A)
    skipped: list[str]  # déjà inscrits, rien à mettre à jour
    errors: list[ImportItemError]


class BulkError(BaseModel):
    id: str
    message: str


class DeletePromotionResult(BaseModel):
    deleted: int
    errors: list[BulkError]


# Borne par requête : le front découpe l'import en lots et agrège les rapports.
_IMPORT_MAX = 100

# Promotions reconnues (niveau, mis à jour chaque rentrée via ré-import).
_PROMOTIONS = {"L3", "M1", "M2"}


def _service_headers() -> dict[str, str]:
    key = get_settings().supabase_service_role_key
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def _gotrue_message(resp: httpx.Response) -> str:
    """Extrait un message d'erreur lisible d'une réponse GoTrue."""
    try:
        data = resp.json()
    except ValueError:
        return resp.text or f"HTTP {resp.status_code}"
    if isinstance(data, dict):
        return (
            data.get("msg")
            or data.get("error_description")
            or data.get("message")
            or data.get("error")
            or f"HTTP {resp.status_code}"
        )
    return f"HTTP {resp.status_code}"


def _is_already_registered(resp: httpx.Response) -> bool:
    """True si l'invite échoue parce que l'email est déjà inscrit (→ skip)."""
    if resp.status_code not in (400, 422):
        return False
    msg = _gotrue_message(resp).lower()
    return "registered" in msg or "already" in msg or "exists" in msg


async def _email_by_id(client: httpx.AsyncClient) -> dict[str, str]:
    """Mappe user_id → email via l'API admin GoTrue (paginée)."""
    base = get_settings().supabase_url
    emails: dict[str, str] = {}
    page = 1
    while True:
        resp = await client.get(
            f"{base}/auth/v1/admin/users",
            params={"page": page, "per_page": _PAGE_SIZE},
            headers=_service_headers(),
        )
        if resp.status_code != 200:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY, "Échec du lookup auth users"
            )
        data = resp.json()
        users = data.get("users", []) if isinstance(data, dict) else data
        for u in users:
            if u.get("id"):
                emails[u["id"]] = u.get("email")
        if len(users) < _PAGE_SIZE:
            return emails
        page += 1


async def _email_to_id(client: httpx.AsyncClient) -> dict[str, str]:
    """Mappe email (minuscule) → user_id, pour retrouver un compte existant."""
    by_id = await _email_by_id(client)
    return {email.lower(): uid for uid, email in by_id.items() if email}


@router.get("/users", response_model=list[AdminUser])
async def list_users(_: str = Depends(require_admin)) -> list[AdminUser]:
    base = get_settings().supabase_url
    async with httpx.AsyncClient(timeout=20) as client:
        prof_resp = await client.get(
            f"{base}/rest/v1/profiles",
            params={
                "select": "id,full_name,promotion,is_admin,is_tutor,is_com"
            },
            headers=_service_headers(),
        )
        if prof_resp.status_code != 200:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY, "Échec du lookup profils"
            )
        profiles = prof_resp.json()
        emails = await _email_by_id(client)

    users = [
        AdminUser(
            id=p["id"],
            email=emails.get(p["id"]),
            full_name=p.get("full_name"),
            promotion=p.get("promotion"),
            is_admin=bool(p.get("is_admin")),
            is_tutor=bool(p.get("is_tutor")),
            is_com=bool(p.get("is_com")),
        )
        for p in profiles
    ]
    users.sort(key=lambda u: (u.email or u.full_name or "").lower())
    return users


@router.patch("/users/{user_id}", response_model=AdminUser)
async def update_user_roles(
    user_id: str,
    payload: UpdateRolesIn,
    _: str = Depends(require_admin),
) -> AdminUser:
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Aucun flag à modifier"
        )
    base = get_settings().supabase_url
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.patch(
            f"{base}/rest/v1/profiles",
            params={"id": f"eq.{user_id}"},
            headers={
                **_service_headers(),
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json=updates,
        )
    if resp.status_code not in (200, 204):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Échec de la mise à jour du profil"
        )
    rows = resp.json() if resp.content else []
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil introuvable")
    p = rows[0]
    return AdminUser(
        id=p["id"],
        full_name=p.get("full_name"),
        is_admin=bool(p.get("is_admin")),
        is_tutor=bool(p.get("is_tutor")),
        is_com=bool(p.get("is_com")),
    )


@router.patch("/users/{user_id}/info", response_model=AdminUser)
async def update_user_info(
    user_id: str,
    payload: UpdateUserInfoIn,
    _: str = Depends(require_admin),
) -> AdminUser:
    """Modifie l'identité d'un compte : nom complet, promotion, email.

    - `full_name` / `promotion` vivent dans `profiles` (PATCH PostgREST).
    - `email` vit dans `auth.users` → mis à jour via l'API admin GoTrue
      (`email_confirm=true` pour que la nouvelle adresse soit utilisable aussitôt).
    - Garde-fou : on refuse de modifier un compte admin (cohérent avec delete).
    - `exclude_unset` : seuls les champs envoyés sont touchés ; `promotion=""`
      efface la promotion (NULL).
    """
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Aucune information à modifier"
        )

    base = get_settings().supabase_url
    async with httpx.AsyncClient(timeout=20) as client:
        # Garde-fou : compte admin non modifiable.
        prof = await client.get(
            f"{base}/rest/v1/profiles",
            params={"id": f"eq.{user_id}", "select": "is_admin"},
            headers=_service_headers(),
        )
        if prof.status_code != 200:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY, "Échec du lookup profil"
            )
        prof_rows = prof.json()
        if not prof_rows:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil introuvable")
        if prof_rows[0].get("is_admin"):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Impossible de modifier un compte admin"
            )

        # 1) Email → auth.users (en premier : c'est l'écriture la plus susceptible
        #    d'échouer — ex. adresse déjà utilisée — et on évite un profil modifié
        #    pour rien).
        if "email" in fields:
            email = (fields["email"] or "").strip().lower()
            if not email:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, "Adresse email vide"
                )
            resp = await client.put(
                f"{base}/auth/v1/admin/users/{user_id}",
                headers={
                    **_service_headers(),
                    "Content-Type": "application/json",
                },
                json={"email": email, "email_confirm": True},
            )
            if resp.status_code not in (200, 201):
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, _gotrue_message(resp)
                )

            # L'adresse de connexion a changé → on révoque les sessions de
            # l'utilisateur pour le forcer à se reconnecter avec la nouvelle
            # adresse (le refresh token est tué tout de suite ; un access token
            # déjà émis reste valide jusqu'à expiration). Voir la migration
            # 0014 : RPC `security definer` car PostgREST n'expose pas `auth`.
            revoke = await client.post(
                f"{base}/rest/v1/rpc/admin_revoke_user_sessions",
                headers={
                    **_service_headers(),
                    "Content-Type": "application/json",
                },
                json={"uid": user_id},
            )
            if revoke.status_code not in (200, 204):
                raise HTTPException(
                    status.HTTP_502_BAD_GATEWAY,
                    "Email modifié mais échec de la révocation des sessions ; "
                    "réessayez pour forcer la déconnexion.",
                )

        # 2) profiles : full_name / promotion
        profile_updates: dict = {}
        if "full_name" in fields:
            profile_updates["full_name"] = (fields["full_name"] or "").strip()
        if "promotion" in fields:
            promo = (fields["promotion"] or "").strip().upper()
            if promo and promo not in _PROMOTIONS:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Promotion inconnue : {fields['promotion']}",
                )
            profile_updates["promotion"] = promo or None
        if profile_updates:
            patch = await client.patch(
                f"{base}/rest/v1/profiles",
                params={"id": f"eq.{user_id}"},
                headers={
                    **_service_headers(),
                    "Content-Type": "application/json",
                    "Prefer": "return=representation",
                },
                json=profile_updates,
            )
            if patch.status_code not in (200, 204):
                raise HTTPException(
                    status.HTTP_502_BAD_GATEWAY,
                    "Échec de la mise à jour du profil",
                )

        # État final : on relit le profil + l'email (refléte les deux écritures).
        prof2 = await client.get(
            f"{base}/rest/v1/profiles",
            params={
                "id": f"eq.{user_id}",
                "select": "id,full_name,promotion,is_admin,is_tutor,is_com",
            },
            headers=_service_headers(),
        )
        if prof2.status_code != 200 or not prof2.json():
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY, "Échec de la relecture du profil"
            )
        p = prof2.json()[0]
        user_resp = await client.get(
            f"{base}/auth/v1/admin/users/{user_id}",
            headers=_service_headers(),
        )
        current_email = (
            user_resp.json().get("email") if user_resp.status_code == 200 else None
        )

    return AdminUser(
        id=p["id"],
        email=current_email,
        full_name=p.get("full_name"),
        promotion=p.get("promotion"),
        is_admin=bool(p.get("is_admin")),
        is_tutor=bool(p.get("is_tutor")),
        is_com=bool(p.get("is_com")),
    )


@router.post("/users/import", response_model=ImportResult)
async def import_students(
    payload: ImportRequestIn,
    _: str = Depends(require_admin),
) -> ImportResult:
    """Invite en masse un lot d'étudiants (le front découpe et agrège).

    Pour chaque entrée : POST /auth/v1/invite — crée le compte dans auth.users ET
    envoie l'email d'invitation via le SMTP custom configuré dans Supabase. Le
    `data.full_name` est repris par le trigger `handle_new_user` → écrit dans
    `profiles.full_name` (ce qui fait afficher le nom de l'auteur des idées).

    Scénario A (ré-import annuel) : un email déjà inscrit n'est PAS une simple
    erreur — si une promotion valide est fournie, on met à jour `profiles.promotion`
    (« updated ») pour refléter la montée de niveau (L3→M1→M2). Sans promotion à
    écrire, il est « skipped ». L'import reste ainsi ré-exécutable sans doublon.
    """
    if not payload.students:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Aucun étudiant à importer"
        )
    if len(payload.students) > _IMPORT_MAX:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Lot trop grand (max {_IMPORT_MAX}). Découpez l'import.",
        )

    base = get_settings().supabase_url
    invited: list[str] = []
    updated: list[str] = []
    skipped: list[str] = []
    errors: list[ImportItemError] = []
    # Map email→id construite paresseusement (seulement si on rencontre un existant).
    email_to_id: dict[str, str] | None = None

    async with httpx.AsyncClient(timeout=30) as client:
        for student in payload.students:
            email = student.email.strip().lower()
            if not email:
                continue
            promotion = (student.promotion or "").strip().upper()
            promotion = promotion if promotion in _PROMOTIONS else ""

            data: dict = {}
            full_name = (student.full_name or "").strip()
            if full_name:
                data["full_name"] = full_name
            if promotion:
                data["promotion"] = promotion
            body: dict = {"email": email}
            if data:
                body["data"] = data

            try:
                resp = await client.post(
                    f"{base}/auth/v1/invite",
                    headers={
                        **_service_headers(),
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
            except httpx.HTTPError:
                errors.append(
                    ImportItemError(email=email, message="Erreur réseau Supabase")
                )
                continue

            if resp.status_code in (200, 201):
                invited.append(email)
                continue
            if not _is_already_registered(resp):
                errors.append(
                    ImportItemError(email=email, message=_gotrue_message(resp))
                )
                continue

            # Compte déjà inscrit : on met à jour sa promotion si fournie.
            if not promotion:
                skipped.append(email)
                continue
            if email_to_id is None:
                email_to_id = await _email_to_id(client)
            uid = email_to_id.get(email)
            if not uid:
                skipped.append(email)
                continue
            patch = await client.patch(
                f"{base}/rest/v1/profiles",
                params={"id": f"eq.{uid}"},
                headers={
                    **_service_headers(),
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                json={"promotion": promotion},
            )
            if patch.status_code in (200, 204):
                updated.append(email)
            else:
                errors.append(
                    ImportItemError(
                        email=email, message="Échec mise à jour promotion"
                    )
                )

    return ImportResult(
        invited=invited, updated=updated, skipped=skipped, errors=errors
    )


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    _: str = Depends(require_admin),
) -> None:
    """Supprime un compte (auth.users → profil supprimé en cascade).

    Garde-fou : on refuse de supprimer un compte admin (protège le compte
    « tous droits »).
    """
    base = get_settings().supabase_url
    async with httpx.AsyncClient(timeout=20) as client:
        prof = await client.get(
            f"{base}/rest/v1/profiles",
            params={"id": f"eq.{user_id}", "select": "is_admin"},
            headers=_service_headers(),
        )
        if prof.status_code == 200:
            rows = prof.json()
            if rows and rows[0].get("is_admin"):
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "Impossible de supprimer un compte admin",
                )
        resp = await client.delete(
            f"{base}/auth/v1/admin/users/{user_id}",
            headers=_service_headers(),
        )
    if resp.status_code not in (200, 204):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Échec de la suppression du compte"
        )


@router.delete(
    "/users/by-promotion/{promotion}", response_model=DeletePromotionResult
)
async def delete_promotion(
    promotion: str,
    _: str = Depends(require_admin),
) -> DeletePromotionResult:
    """Supprime en masse les comptes d'une promotion (diplômés en fin d'année).

    Les comptes admin sont exclus (garde-fou). À utiliser pour vider la promotion
    sortante (ex. les M2) une fois l'année terminée.
    """
    promo = promotion.strip().upper()
    if promo not in _PROMOTIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Promotion inconnue : {promotion}"
        )

    base = get_settings().supabase_url
    deleted = 0
    errors: list[BulkError] = []
    async with httpx.AsyncClient(timeout=30) as client:
        prof = await client.get(
            f"{base}/rest/v1/profiles",
            params={
                "promotion": f"eq.{promo}",
                "is_admin": "eq.false",
                "select": "id",
            },
            headers=_service_headers(),
        )
        if prof.status_code != 200:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY, "Échec du lookup profils"
            )
        ids = [row["id"] for row in prof.json() if row.get("id")]
        for uid in ids:
            try:
                resp = await client.delete(
                    f"{base}/auth/v1/admin/users/{uid}",
                    headers=_service_headers(),
                )
            except httpx.HTTPError:
                errors.append(BulkError(id=uid, message="Erreur réseau Supabase"))
                continue
            if resp.status_code in (200, 204):
                deleted += 1
            else:
                errors.append(
                    BulkError(id=uid, message=_gotrue_message(resp))
                )

    return DeletePromotionResult(deleted=deleted, errors=errors)
