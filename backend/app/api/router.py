from fastapi import APIRouter
from app.api.routes import auth, assets, users, request_quote, quote

api_router = APIRouter()

# Auth Endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Profile Endpoints
api_router.include_router(users.router, prefix="/users", tags=["users"])

# Assets Endpoints
api_router.include_router(assets.router, prefix="/assets", tags=["assets"])

# RFQ Endpoints
api_router.include_router(request_quote.router, prefix="/rfqs", tags=["rfqs"])

# Quote Endpoints
api_router.include_router(quote.router, prefix="", tags=["quotes"])


