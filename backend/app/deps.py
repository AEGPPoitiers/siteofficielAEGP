"""Dépendances de rôle — cf docs/CONTRAT-API.md §3.

⚠️ La RLS Supabase ne protège PAS les endpoints FastAPI : on revérifie donc le rôle
côté backend pour les actions sensibles (presign-upload, suppression d'objet B2).

Le lookup du flag se fait via l'API REST PostgREST de Supabase avec la *service role
key* — plus léger qu'une connexion Postgres directe sur le free tier Render.
"""

import httpx
from fastapi import Depends, HTTPException, status

from .auth import get_current_user_id
from .config import get_settings


async def _fetch_profile(user_id: str) -> dict | None:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{settings.supabase_url}/rest/v1/profiles",
            params={
                "id": f"eq.{user_id}",
                "select": "is_bde_member,is_admin,is_tutor",
            },
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
            },
        )
    if resp.status_code != 200:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Échec du lookup profil Supabase"
        )
    rows = resp.json()
    return rows[0] if rows else None


async def require_bde_member(
    user_id: str = Depends(get_current_user_id),
) -> str:
    profile = await _fetch_profile(user_id)
    if not profile or not (
        profile.get("is_bde_member") or profile.get("is_admin")
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "BDE member required")
    return user_id


async def require_admin(
    user_id: str = Depends(get_current_user_id),
) -> str:
    """Réservé aux admins (is_admin) — gestion des rôles, etc."""
    profile = await _fetch_profile(user_id)
    if not profile or not profile.get("is_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin required")
    return user_id


async def require_tutorat_editor(
    user_id: str = Depends(get_current_user_id),
) -> str:
    """Édition du tutorat : membres BDE, admins OU tuteurs (is_tutor).

    Les tuteurs n'ont ce droit QUE sur le tutorat — les endpoints agenda/idées
    restent gardés par require_bde_member.
    """
    profile = await _fetch_profile(user_id)
    if not profile or not (
        profile.get("is_bde_member")
        or profile.get("is_admin")
        or profile.get("is_tutor")
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Tutorat editor required"
        )
    return user_id
