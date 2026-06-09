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
    is_bde_member: bool = False
    is_admin: bool = False
    is_tutor: bool = False


class UpdateRolesIn(BaseModel):
    is_bde_member: bool | None = None
    is_tutor: bool | None = None


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
                "select": "id,full_name,promotion,is_bde_member,is_admin,is_tutor"
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
            is_bde_member=bool(p.get("is_bde_member")),
            is_admin=bool(p.get("is_admin")),
            is_tutor=bool(p.get("is_tutor")),
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
        is_bde_member=bool(p.get("is_bde_member")),
        is_admin=bool(p.get("is_admin")),
        is_tutor=bool(p.get("is_tutor")),
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
