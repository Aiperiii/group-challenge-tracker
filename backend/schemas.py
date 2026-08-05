from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional
from datetime import datetime, date

class UserRegister(BaseModel):
    email : EmailStr
    name: str
    password : str
    timezone : str  = "UTC"

    @field_validator("password")
    @classmethod
    def password_length(cls, v : str) ->str:
        if(len(v) < 8):
            raise ValueError("Password must contain at least 8 characters.")
        if(len(v.encode('utf-8')) > 72):
            raise ValueError("Password must be at most 72 bytes.")
        return v

class UserResponse(BaseModel):
    id : int
    email : EmailStr
    name: str
    timezone : str
    created_at : datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class GroupCreate(BaseModel):
    name : str

    @field_validator("name")
    @classmethod
    def name_non_empty(cls, v : str) -> str:
        if not v.strip():
            raise ValueError("Group name can't be empty")
        return v.strip()

class GroupResponse(BaseModel):
    id : int 
    name : str
    invite_code : str
    created_by : int
    created_at : datetime

    class Config:
        from_attributes = True

class GroupJoin(BaseModel):
    invite_code : str

class MemberResponse(BaseModel):
    user_id : int 
    email : EmailStr
    joined_at : datetime

    class Config:
        from_attributes = True

class ChallengeCreate(BaseModel):
    name : str
    description : Optional[str] = None
    duration_days : int
    start_date : date
    check_in_type : str
    goal_value : Optional[int] = None

    @field_validator("check_in_type")
    @classmethod
    def valid_check_in_type(cls, v : str) -> str:
        allowed = {"boolean", "numeric", "text"}
        if v not in allowed:
            raise ValueError(f"check_in_type must be one of the {allowed}")
        return v
    
    @field_validator("duration_days")
    @classmethod
    def positive_duration(cls, v : int) -> int:
        if(v < 1):
            raise ValueError("duration_days must be positive")
        return v

    @model_validator(mode = "after")
    def check_goal_matches_type(self):
        if self.check_in_type == "numeric" and self.goal_value is None:
            raise ValueError("numeric challenges require a goal value")
        if self.check_in_type in {"boolean", "text"} and self.goal_value is not None:
            raise ValueError("goal_value is only allowed for numeric challenges")
        return self

class ChallengeResponse(BaseModel):
    id: int
    group_id: int
    name: str
    description: Optional[str]
    duration_days: int
    start_date: date
    check_in_type: str
    goal_value: Optional[int]
    created_by: int

    class Config:
        from_attributes = True

class ChallengeDetailResponse(BaseModel):
    challenge: ChallengeResponse
    members: list[MemberResponse]

class CheckInCreate(BaseModel):
    value : Optional[int] = None
    note : Optional[str] = None
