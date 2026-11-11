from datetime import datetime, timedelta
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "adminpass")
JWT_SECRET = os.getenv("JWT_SECRET", "secret")

security = HTTPBearer()


def create_token(username: str):
  payload = {"sub": username, "exp": datetime.utcnow() + timedelta(hours=12)}
  return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
  try:
    payload = jwt.decode(
        credentials.credentials, JWT_SECRET, algorithms=["HS256"]
    )
    return payload["sub"]
  except jwt.PyJWTError:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
    )
