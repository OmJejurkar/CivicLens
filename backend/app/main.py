"""FastAPI application entry point."""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db

# ── Create app ──
app = FastAPI(
    title=settings.app_name,
    description="AI Meeting Summarization Co-Pilot for Public Leaders & Administrators",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──
origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ──
from app.routers import auth, meetings, transcription, summary, actions, chat, export

app.include_router(auth.router)
app.include_router(meetings.router)
app.include_router(transcription.router)
app.include_router(summary.router)
app.include_router(actions.router)
app.include_router(chat.router)
app.include_router(export.router)


# ── Startup ──
@app.on_event("startup")
async def on_startup():
    # Create tables
    init_db()
    # Create upload directory
    os.makedirs(settings.upload_dir, exist_ok=True)
    # Create default admin user if none exists
    _create_default_user()


def _create_default_user():
    """Create a default admin user for first-time setup."""
    from app.database import SessionLocal
    from app.models.models import User, UserRole
    from app.middleware.auth import hash_password

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == "admin").first()
        if not existing:
            admin = User(
                username="admin",
                email="admin@gov.in",
                hashed_password=hash_password("admin123"),
                full_name="System Administrator",
                designation="IT Administrator",
                department="IT",
                role=UserRole.LEADER,
            )
            db.add(admin)
            db.commit()
            print("✅ Default admin user created (username: admin, password: admin123)")
    finally:
        db.close()


# ── Health check ──
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "env": settings.app_env,
    }


@app.get("/")
async def root():
    return {
        "message": "🏛️ AI Meeting Co-Pilot API",
        "docs": "/docs",
        "health": "/health",
    }
