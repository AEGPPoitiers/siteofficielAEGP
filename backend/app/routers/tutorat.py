"""Endpoints tutorat : signature d'URLs B2 pour l'upload, le download/preview et la
suppression des fichiers de documents.

Les *métadonnées* (taxonomie + lignes documents) ne passent PAS par ici : le front
les lit/écrit directement via Supabase (RLS). Ce routeur ne s'occupe que des octets.
"""

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from .. import b2
from ..auth import get_current_user_id
from ..config import get_settings
from ..deps import require_tutorat_editor

router = APIRouter(prefix="/tutorat", tags=["tutorat"])


def _extension(file_name: str) -> str:
    dot = file_name.rfind(".")
    if dot == -1 or dot == len(file_name) - 1:
        return "bin"
    return file_name[dot + 1 :].lower()


class PresignUploadIn(BaseModel):
    node_id: str = Field(min_length=1)
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=255)


class PresignUploadOut(BaseModel):
    upload_url: str
    file_key: str
    expires_in: int


@router.post("/presign-upload", response_model=PresignUploadOut)
def presign_upload(
    payload: PresignUploadIn,
    _: str = Depends(require_tutorat_editor),
) -> PresignUploadOut:
    """Réservé BDE/admin/tuteur. Génère la `file_key` côté serveur (le client ne la choisit jamais)."""
    settings = get_settings()
    file_key = f"tutorat/{payload.node_id}/{uuid.uuid4()}.{_extension(payload.file_name)}"
    url = b2.presign_put(file_key, payload.content_type, settings.upload_url_ttl)
    return PresignUploadOut(
        upload_url=url, file_key=file_key, expires_in=settings.upload_url_ttl
    )


class DownloadUrlOut(BaseModel):
    url: str
    expires_in: int


@router.get("/download-url", response_model=DownloadUrlOut)
def download_url(
    key: str = Query(..., min_length=1),
    disposition: str = Query("attachment", pattern="^(attachment|inline)$"),
    file_name: str | None = Query(None),
    content_type: str | None = Query(None),
    _: str = Depends(get_current_user_id),
) -> DownloadUrlOut:
    """Tout utilisateur authentifié. URL courte durée pour download (attachment) ou
    aperçu (inline)."""
    settings = get_settings()
    url = b2.presign_get(
        key,
        settings.download_url_ttl,
        file_name=file_name,
        inline=(disposition == "inline"),
        content_type=content_type,
    )
    return DownloadUrlOut(url=url, expires_in=settings.download_url_ttl)


@router.delete("/object", status_code=204)
def delete_object(
    key: str = Query(..., min_length=1),
    _: str = Depends(require_tutorat_editor),
) -> None:
    """Réservé BDE/admin/tuteur. Supprime l'objet B2 (cleanup après suppression d'une row document)."""
    b2.delete_object(key)
