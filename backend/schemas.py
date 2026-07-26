from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime

class UserRegister(BaseModel):
    email : EmailStr
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
