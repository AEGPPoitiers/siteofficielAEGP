#!/usr/bin/env python3
"""Configure les règles CORS du bucket B2 pour l'upload direct navigateur → B2.

Pourquoi : le front demande au backend une URL signée (presign-upload) puis fait
un PUT *direct* sur B2 depuis le navigateur. Ce PUT cross-origin déclenche un
préflight CORS ; sans règle CORS sur le bucket, B2 ne renvoie pas les en-têtes
attendus et le navigateur bloque (« CORS request did not succeed »).

B2 n'expose PAS l'opération S3 PutBucketCors : on configure donc le CORS via
l'API *native* B2 (b2_authorize_account → b2_list_buckets → b2_update_bucket).

Aucune dépendance : stdlib seule. Lance-le avec tes identifiants B2.

    python3 backend/scripts/set_b2_cors.py

Les identifiants sont lus depuis les variables d'environnement, sinon depuis
backend/.env (B2_KEY_ID, B2_APP_KEY, B2_BUCKET). La clé applicative doit avoir
la capability « writeBuckets » (sinon b2_update_bucket renvoie 401/403 — utilise
une clé master ou ajoute la capability).
"""

import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

AUTH_URL = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account"

# Origines autorisées à uploader/télécharger directement sur B2.
# (Les preview deploys Vercel utiliseraient https://*.vercel.app — ajoute-le si besoin.)
CORS_RULES = [
    {
        "corsRuleName": "frontendDirectUpload",
        "allowedOrigins": [
            "https://siteofficiel-aegp.vercel.app",
            "http://localhost:5173",
        ],
        "allowedOperations": ["s3_put", "s3_get", "s3_head"],
        "allowedHeaders": ["*"],
        "exposeHeaders": ["etag"],
        "maxAgeSeconds": 3600,
    }
]


def _load_env() -> dict[str, str]:
    """Variables d'env réelles, complétées par backend/.env si présent."""
    env = dict(os.environ)
    dotenv = Path(__file__).resolve().parent.parent / ".env"
    if dotenv.exists():
        for line in dotenv.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            env.setdefault(key.strip(), val.strip().strip('"').strip("'"))
    return env


def _post(url: str, token: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Authorization": token, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def main() -> int:
    env = _load_env()
    try:
        key_id = env["B2_KEY_ID"]
        app_key = env["B2_APP_KEY"]
        bucket_name = env["B2_BUCKET"]
    except KeyError as missing:
        print(f"Variable manquante : {missing}. Renseigne backend/.env.", file=sys.stderr)
        return 2

    # 1) Authentification
    basic = base64.b64encode(f"{key_id}:{app_key}".encode()).decode()
    auth_req = urllib.request.Request(AUTH_URL, headers={"Authorization": f"Basic {basic}"})
    try:
        with urllib.request.urlopen(auth_req, timeout=30) as resp:
            auth = json.load(resp)
    except urllib.error.HTTPError as e:
        print(f"Échec b2_authorize_account ({e.code}) : {e.read().decode()}", file=sys.stderr)
        return 1

    api_url = auth["apiUrl"]
    token = auth["authorizationToken"]
    account_id = auth["accountId"]

    # 2) Résolution du bucketId
    allowed = auth.get("allowed") or {}
    if allowed.get("bucketName") == bucket_name and allowed.get("bucketId"):
        bucket_id = allowed["bucketId"]
    else:
        buckets = _post(
            f"{api_url}/b2api/v2/b2_list_buckets",
            token,
            {"accountId": account_id, "bucketName": bucket_name},
        )["buckets"]
        if not buckets:
            print(f"Bucket introuvable : {bucket_name}", file=sys.stderr)
            return 1
        bucket_id = buckets[0]["bucketId"]

    # 3) Mise à jour des règles CORS
    try:
        result = _post(
            f"{api_url}/b2api/v2/b2_update_bucket",
            token,
            {"accountId": account_id, "bucketId": bucket_id, "corsRules": CORS_RULES},
        )
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"Échec b2_update_bucket ({e.code}) : {body}", file=sys.stderr)
        if e.code in (401, 403):
            print(
                "→ La clé n'a probablement pas la capability « writeBuckets ». "
                "Utilise une clé master ou configure le CORS via le dashboard B2.",
                file=sys.stderr,
            )
        return 1

    print(f"✅ CORS appliqué au bucket « {bucket_name} ».")
    print(json.dumps(result.get("corsRules", CORS_RULES), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
