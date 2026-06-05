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
    is_bde_member: bool = False
    is_admin: bool = False
    is_tutor: bool = False


class UpdateRolesIn(BaseModel):
    is_bde_member: bool | None = None
    is_tutor: bool | None = None


def _service_headers() -> dict[str, str]:
    key = get_settings().supabase_service_role_key
    return {"apikey": key, "Authorization": f"Bearer {key}"}


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


@router.get("/users", response_model=list[AdminUser])
async def list_users(_: str = Depends(require_admin)) -> list[AdminUser]:
    base = get_settings().supabase_url
    async with httpx.AsyncClient(timeout=20) as client:
        prof_resp = await client.get(
            f"{base}/rest/v1/profiles",
            params={"select": "id,full_name,is_bde_member,is_admin,is_tutor"},
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
