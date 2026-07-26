from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session 
from fastapi.security import OAuth2PasswordRequestForm

from database import get_db
from models import User, Group, GroupMember
from schemas import UserRegister, UserResponse, Token, GroupCreate, GroupResponse, GroupJoin,MemberResponse

from auth import hash_password,verify_password
from token_utils import create_access_token, get_current_user
from utils import generate_invite_code


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

@app.post("/groups", response_model = GroupResponse)
def create_group(group_data : GroupCreate, 
            current_user : User = Depends(get_current_user),
            db : Session = Depends(get_db)):

    """Create a new group, generate a unique invite code, and add the creator as the first member."""
    
    # generate an invite code, retrying in the rare case of duplicate invite code 
    invite_code = generate_invite_code()
    while db.query(Group).filter(Group.invite_code == invite_code).first():
        invite_code = generate_invite_code()

    new_group = Group(
        name = group_data.name,
        invite_code = invite_code,
        created_by = current_user.id,
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    membership = GroupMember(group_id = new_group.id, user_id = current_user.id)
    db.add(membership)
    db.commit()

    return new_group
    
@app.post("/groups/join", response_model = GroupResponse)
def join_group(join_data : GroupJoin, 
            current_user : User = Depends(get_current_user),
            db : Session = Depends(get_db)):

    """Join a group using its invite code."""

    group = db.query(Group).filter(Group.invite_code == join_data.invite_code).first()
    if not group:
        raise HTTPException(status_code = 404, detail = "Invalid invite code")

    # prevent joining a group you're already in
    existing  = db.query(GroupMember).filter(
        GroupMember.group_id == group.id, GroupMember.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code = 400, detail = "You are already a member of this group")

    membership = GroupMember(group_id = group.id, user_id = current_user.id)
    db.add(membership)
    db.commit()

    return group

@app.get("/groups/{group_id}/members", response_model = list[MemberResponse])
def list_members(group_id : int, 
        current_user : User = Depends(get_current_user), 
        db : Session = Depends(get_db)):
    """List all members of the group. Only accessible to the actual members of the group"""

    # the requester must be a member of the group to view its members
    requester_membership = db.query(GroupMember).filter(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id).first()
    if requester_membership is None:
        raise HTTPException(status_code = 403, details = "You are not a member of thi group")

    # join group_members with users to get each members' email
    results = (db.query(GroupMember, User).join(User, GroupMember.user_id == User.id)
            .filter(GroupMember.group_id == group_id).all())
    
    return [
    MemberResponse(user_id=user.id, email=user.email, joined_at=membership.joined_at)
    for membership, user in results
    ]
