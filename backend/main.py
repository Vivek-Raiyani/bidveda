import os
import logging
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.utils.logger import handler


logging.basicConfig(level=logging.INFO, handlers=[handler])

# Ensure media directory exists
os.makedirs("media", exist_ok=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/api/openapi.json"
)

# Build list of allowed origins
cors_origins = [str(o).strip().rstrip("/") for o in settings.BACKEND_CORS_ORIGINS if str(o).strip()]
if settings.FRONTEND_URL:
    clean_frontend = settings.FRONTEND_URL.strip().rstrip("/")
    if clean_frontend and clean_frontend not in cors_origins:
        cors_origins.append(clean_frontend)

# Required by Authlib for Starlette
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https?://.*",  # Dynamically permits all HTTP/HTTPS origins with credential support
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.mount("/media", StaticFiles(directory="media"), name="media")

app.include_router(api_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Welcome to the FastAPI Template. Visit /docs for the API documentation."}
