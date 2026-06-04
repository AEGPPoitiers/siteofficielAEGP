"""Vérification du JWT Supabase — cf docs/CONTRAT-API.md §2.

Le backend ne gère pas l'authentification : il vérifie un JWT déjà émis par Supabase
et en extrait l'identité (`sub` = user_id).

Supabase signe désormais ses access tokens avec des clés *asymétriques* (ES256) :
on les vérifie via le JWKS public exposé sur `{supabase_url}/auth/v1/.well-known/jwks.json`
(le `kid` du token sélectionne la bonne clé). Repli sur le secret HS256 legacy pour
d'anciens tokens symétriques si `supabase_jwt_secret` est configuré.
"""

from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, PyJWKClientError

from .config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)
JWT_AUDIENCE = "authenticated"  # claim par défaut des JWT Supabase
ASYMMETRIC_ALGS = ["ES256", "RS256"]


@lru_cache
def _jwk_client() -> PyJWKClient:
    """Client JWKS (clés publiques Supabase), mis en cache. PyJWKClient garde
    lui-même le jeu de clés en cache (~5 min) pour ne pas refrapper Supabase."""
    base = get_settings().supabase_url.rstrip("/")
    return PyJWKClient(f"{base}/auth/v1/.well-known/jwks.json")


def _decode(token: str) -> dict:
    """Décode + vérifie le JWT. ES256/RS256 via JWKS, sinon HS256 legacy."""
    alg = jwt.get_unverified_header(token).get("alg", "")

    if alg in ASYMMETRIC_ALGS:
        signing_key = _jwk_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=ASYMMETRIC_ALGS,
            audience=JWT_AUDIENCE,
        )

    secret = get_settings().supabase_jwt_secret
    if not secret:
        raise jwt.InvalidTokenError("Unsupported token algorithm")
    return jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        audience=JWT_AUDIENCE,
    )


def get_current_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    try:
        payload = _decode(creds.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except (jwt.InvalidTokenError, PyJWKClientError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return payload["sub"]  # UUID Supabase de l'utilisateur
