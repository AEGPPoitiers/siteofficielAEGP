"""Configuration : lit les variables d'environnement (cf docs/CONTRAT-API.md §6).

Les valeurs sont lues paresseusement via `get_settings()` (mis en cache), pour que
l'import du module ne nécessite pas que l'environnement soit déjà rempli — pratique
pour un smoke-test d'import en local.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Auth Supabase
    # Les access tokens récents sont signés en ES256 (clés asymétriques) et
    # vérifiés via le JWKS dérivé de `supabase_url`. Le secret HS256 legacy n'est
    # plus indispensable : conservé en option pour d'anciens tokens / le local.
    supabase_jwt_secret: str | None = None
    supabase_url: str
    supabase_service_role_key: str

    # Backblaze B2 (S3-compatible)
    b2_key_id: str
    b2_app_key: str
    b2_endpoint: str  # ex: https://s3.eu-central-003.backblazeb2.com
    b2_region: str  # ex: eu-central-003
    b2_bucket: str  # ex: siteaegp-tutorat

    # CORS (origine du front ; les origines connues + le regex preview sont en dur dans main.py)
    frontend_url: str = "http://localhost:5173"

    # Durées de validité des URLs signées (secondes)
    upload_url_ttl: int = 600
    download_url_ttl: int = 300


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
