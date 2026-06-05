"""Point d'entrée FastAPI — cf docs/CONTRAT-API.md.

L'app n'instancie pas la config à l'import (CORS en dur, conforme au contrat), pour
qu'un simple `import app.main` fonctionne sans environnement rempli.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import admin, tutorat

app = FastAPI(title="SiteAEGP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://siteofficiel-aegp.vercel.app",
    ],
    allow_origin_regex=r"https://siteofficiel-aegp-.*\.vercel\.app",  # preview deploys
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tutorat.router)
app.include_router(admin.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
