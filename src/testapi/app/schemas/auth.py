from pydantic import BaseModel, EmailStr, Field

class UserBase(BaseModel):
    email: EmailStr
    username: str = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(UserBase):
    username: str
    password: str = Field(min_length=6)

class Token(BaseModel):
    token: str
    username: str

class TokenData(BaseModel):
    user_id: int
    token: str 