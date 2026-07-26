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