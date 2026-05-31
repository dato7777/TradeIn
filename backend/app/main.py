"""TradeIn FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import get_settings

settings = get_settings()

cors_kwargs: dict = {
    "allow_origins": settings.cors_origin_list,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
# Next.js may use 3001 when 3000 is busy; browsers send Origin as localhost or 127.0.0.1
if any("localhost" in o or "127.0.0.1" in o for o in settings.cors_origin_list):
    cors_kwargs["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

app = FastAPI(title="TradeIn API", version="1.0.0")

app.add_middleware(CORSMiddleware, **cors_kwargs)

app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {"service": "RES PARTS API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
