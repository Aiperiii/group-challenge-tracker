from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session 
from fastapi.security import OAuth2PasswordRequestForm

from database import get_db
from models import User, Group, GroupMember, Challenge, CheckIn, Streak
from schemas import (UserRegister, UserResponse, Token, GroupCreate, 
        GroupResponse, GroupJoin,MemberResponse, ChallengeCreate, 
        ChallengeResponse,ChallengeDetailResponse, CheckInCreate)

from auth import hash_password,verify_password
from token_utils import create_access_token, get_current_user
from utils import generate_invite_code, local_date_of
from datetime import datetime, timezone
from streaks import update_stored_streak



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
        raise HTTPException(status_code = 400, detail = "Email already registered")
    
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
        raise HTTPException(status_code = 403, detail = "You are not a member of this group")

    # join group_members with users to get each members' email
    results = (db.query(GroupMember, User).join(User, GroupMember.user_id == User.id)
            .filter(GroupMember.group_id == group_id).all())
    
    return [
    MemberResponse(user_id=user.id, email=user.email, joined_at=membership.joined_at)
    for membership, user in results
    ]

@app.post("/groups/{group_id}/challenges", response_model=ChallengeResponse)
def create_challenge(group_id: int, challenge_data: ChallengeCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)):
    """Create a challenge inside a group. Only group members can create challenges."""

    # the creator must be a member of the group
    membership = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    new_challenge = Challenge(
        group_id=group_id,
        name=challenge_data.name,
        description=challenge_data.description,
        duration_days=challenge_data.duration_days,
        start_date=challenge_data.start_date,
        check_in_type=challenge_data.check_in_type,
        goal_value=challenge_data.goal_value,
        created_by=current_user.id,
    )
    db.add(new_challenge)
    db.commit()
    db.refresh(new_challenge)

    return new_challenge

@app.get("/groups/{group_id}/challenges", response_model=list[ChallengeResponse])
def list_challenges(group_id: int, current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)):

    """List all challenges in a group. Only group members can view them."""

    # the requester must be a member of the group
    membership = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    challenges = db.query(Challenge).filter(Challenge.group_id == group_id).all()
    return challenges

@app.get("/challenges/{challenge_id}", response_model=ChallengeDetailResponse)
def get_challenge_details(challenge_id: int, current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)):

    """Get one challenge's details plus the group's members. Members only."""

    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not found")

    # the requester must be a member of the challenge's group
    membership = db.query(GroupMember).filter(
        GroupMember.group_id == challenge.group_id,
        GroupMember.user_id == current_user.id).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    # fetch the group's members (JOIN to get emails), same as the members endpoint
    results = (
        db.query(GroupMember, User)
        .join(User, GroupMember.user_id == User.id)
        .filter(GroupMember.group_id == challenge.group_id)
        .all()
    )
    members = [
        MemberResponse(user_id=user.id, email=user.email, joined_at=membership.joined_at)
        for membership, user in results
    ]

    return ChallengeDetailResponse(challenge=challenge, members=members)

@app.post("/challenges/{challenge_id}/checkin")
def checkin(challenge_id : int, check_in_data : CheckInCreate,
    current_user : User = Depends(get_current_user), db : Session = Depends(get_db)):
    """Records a check-in for the current user. One check-in per user per challenge per local day."""

    # the challenge must exist
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if challenge is None:
        raise HTTPException(status_code = 404, detail = "Challenge not found")

    # the user must be a member of the challenge's group
    membership = db.query(GroupMember).filter(GroupMember.group_id == challenge.group_id,
    GroupMember.user_id == current_user.id).first()
    if membership is None:
        raise HTTPException(status_code = 403, detail = "You are not a member of this group")

    # numeric challenges require a value, others must not have one
    if challenge.check_in_type == "numeric" and check_in_data.value is None:
        raise HTTPException(status_code = 422, detail = "This challenge requires a numeric value")
    if challenge.check_in_type != "numeric" and check_in_data.value is not None:
        raise HTTPException(status_code = 422, detail = "This challenge does not accept a value")

    # one check-in per user per challenge per LOCAL day.
    now_utc = datetime.now(timezone.utc)
    today_local = local_date_of(now_utc, current_user.timezone)


    existing_check_ins = db.query(CheckIn).filter(CheckIn.challenge_id == challenge_id, 
    CheckIn.user_id == current_user.id).all()
    # ensure no check-in per challenge per day was done before
    for ch_in in existing_check_ins:
        if local_date_of(ch_in.checked_in_at, current_user.timezone) == today_local:
            raise HTTPException(status_code = 400, detail = "You have already checked-in today")

    new_check_in = CheckIn(
        challenge_id = challenge_id,
        user_id = current_user.id,
        checked_in_at = now_utc,
        value = check_in_data.value,
        note = check_in_data.note,
    )

    db.add(new_check_in)
    db.commit()
    db.refresh(new_check_in)

    streak_result = update_stored_streak(db, current_user, challenge_id)

    return {"message": "Checked in", 
    "checked_in_at": new_check_in.checked_in_at, 
    "local_date": str(today_local),
    "current_streak": streak_result["current_streak"],
        "longest_streak": streak_result["longest_streak"]}

@app.get("/challenges/{challenge_id}/leaderboard")
def leaderboard(challenge_id : int, current_user : User = Depends(get_current_user), db : Session = Depends(get_db)):
    """Ranks a challenge's members by their current streaks."""

    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if challenge is None:
        raise HTTPException(status_code = 404, detail = "Challenge not found")

    # the user must be a member of the challenge's group
    membership = db.query(GroupMember).filter(
        GroupMember.group_id == challenge.group_id,
        GroupMember.user_id == current_user.id,
    ).first()
    if membership is None:
        raise HTTPException(status_code = 403, detail = "You are not a member of this group")

    rows = (
        db.query(Streak, User)
        .join(User, Streak.user_id == User.id)
        .filter(Streak.challenge_id == challenge_id)
        .order_by(Streak.current_streak.desc())
        .all()
    )

    return [{
        "rank" : i + 1,
        "user_id" : user.id,
        "email" : user.email,
        "current_streak" : streak.current_streak,
        "longest_streak" : streak.longest_streak,
    } for i, (streak, user) in enumerate(rows)]

