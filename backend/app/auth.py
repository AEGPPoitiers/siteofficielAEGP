"""Vérification du JWT Supabase (HS256) — cf docs/CONTRAT-API.md §2.

Le backend ne gère pas l'authentification : il vérifie un JWT déjà émis par Supabase
et en extrait l'identité (`sub` = user_id).
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)
JWT_AUDIENCE = "authenticated"  # claim par défaut des JWT Supabase


def get_current_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    try:
        payload = jwt.decode(
            creds.credentials,
            get_settings().supabase_jwt_secret,
            algorithms=["HS256"],
            audience=JWT_AUDIENCE,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return payload["sub"]  # UUID Supabase de l'utilisateur
