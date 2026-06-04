"""Client Backblaze B2 (S3-compatible) + génération d'URLs signées.

B2 expose une API S3 — on utilise boto3 avec la signature v4 (requise par B2).
Le bucket est PRIVÉ : aucune URL n'est publique, tout passe par des URLs signées
à durée de vie courte.
"""

from functools import lru_cache

import boto3
from botocore.client import BaseClient, Config

from .config import get_settings


@lru_cache
def _client() -> BaseClient:
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.b2_endpoint,
        aws_access_key_id=settings.b2_key_id,
        aws_secret_access_key=settings.b2_app_key,
        region_name=settings.b2_region,
        config=Config(signature_version="s3v4"),
    )


def presign_put(key: str, content_type: str, expires_in: int) -> str:
    """URL signée pour un upload direct (PUT) navigateur → B2.

    Le front DOIT envoyer le même `Content-Type` que celui signé ici, sinon B2
    rejette la signature.
    """
    return _client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": get_settings().b2_bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )


def presign_get(
    key: str,
    expires_in: int,
    *,
    file_name: str | None = None,
    inline: bool = False,
    content_type: str | None = None,
) -> str:
    """URL signée pour un download/preview (GET).

    `inline=True` (+ content_type application/pdf) pour l'aperçu navigateur ;
    sinon `attachment` force le téléchargement avec le nom de fichier original.
    """
    params: dict[str, str] = {"Bucket": get_settings().b2_bucket, "Key": key}
    if file_name:
        disposition = "inline" if inline else "attachment"
        params["ResponseContentDisposition"] = (
            f'{disposition}; filename="{file_name}"'
        )
    if content_type:
        params["ResponseContentType"] = content_type
    return _client().generate_presigned_url(
        "get_object", Params=params, ExpiresIn=expires_in
    )


def delete_object(key: str) -> None:
    _client().delete_object(Bucket=get_settings().b2_bucket, Key=key)
