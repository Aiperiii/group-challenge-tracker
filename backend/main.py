from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session 
from fastapi.security import OAuth2PasswordRequestForm

from database import get_db
from models import User
from schemas import UserRegister, UserResponse, Token
from auth import hash_password,verify_password
from token_utils import create_access_token, get_current_user

app = FastAPI()

@app.get('/')
def read_root():
    return {"message": "Challenge Tracker API is running"}

@app.post("/register", response_model = UserResponse)
def register(user : UserRegister, db : Session = Depends(get_db)):
    """Register a new user with a hashed password and return the safe public fields."""

    # Reject duplicate emails with a clean 400 before the DB's UNIQUE
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        return HTTPException(status_code = 400, detail = "Email already registered")
    
    # Hash the password here — the plain password is never stored.
    new_user = User(
        email = user.email,
        password_hash = hash_password(user.password),
        timezone  = user.timezone,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user) # reload to get DB-generated id and created_at

    return new_user


@app.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Verify email and password, and return a signed access token."""

    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
        )

    access_token = create_access_token(user_id=user.id)
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's information."""
    return current_user