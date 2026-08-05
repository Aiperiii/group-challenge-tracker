from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Date
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(320), unique = True, nullable = False)
    name = Column(String(100), nullable = False, default = "")
    password_hash = Column(String(225), nullable = False)
    timezone = Column(String(50), nullable = False, default = "UTC")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable = False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable = False)
    invite_code = Column(String(20), unique = True, nullable = False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_user"),
    )

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable = False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable = False)
    joined_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

class Challenge(Base):
    __tablename__ = "challenges"
    
    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable = False)
    name = Column(String(100), nullable = False)
    description = Column(String(500), nullable = True)
    duration_days = Column(Integer, nullable = False)
    start_date = Column(Date, nullable = False)
    check_in_type =  Column(String(20), nullable=False)
    goal_value = Column(Integer, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

class CheckIn(Base):
    __tablename__ = "check_ins"

    id = Column(Integer, primary_key=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    checked_in_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    value = Column(Integer, nullable=True)
    note = Column(String(500), nullable=True)

class Streak(Base):
    __tablename__ = "streaks"
    __table_args__ = (
        UniqueConstraint("challenge_id", "user_id", name="uq_streak_challenge_user"),
    )

    id = Column(Integer, primary_key=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    current_streak = Column(Integer, nullable=False, default=0)
    longest_streak = Column(Integer, nullable=False, default=0)
    last_calculated_at = Column(DateTime(timezone=True), nullable=True)