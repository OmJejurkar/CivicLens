"""Auth router: login, register, profile."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User, UserRole
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.middleware.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_role
)
from app.middleware.audit import log_action

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.id, "role": user.role.value})
    log_action(db, user.id, "LOGIN", "auth")
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user)
    )


@router.post("/register", response_model=UserOut)
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # Check uniqueness
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=req.username,
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        designation=req.designation,
        department=req.department,
        role=UserRole(req.role) if req.role in [r.value for r in UserRole] else UserRole.SECRETARY,
        contact=req.contact,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, user.id, "REGISTER", "user", user.id)
    return UserOut.model_validate(user)


@router.get("/me", response_model=UserOut)
async def get_profile(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
