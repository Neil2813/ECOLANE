from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.jwt_handler import get_bearer_token, safe_decode
from app.db.models import User

def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    token = get_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = safe_decode(token)
    if not payload or payload.get("user_id") is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == str(payload["user_id"])).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
