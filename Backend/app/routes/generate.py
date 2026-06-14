from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from app.db.models import User
from app.db.session import get_db
from app.schemas.route import GenerateRouteRequest
from app.utils.jwt_handler import get_bearer_token, safe_decode
from app.ml.ppo_router import recommend_routes

router = APIRouter()

@router.post("/generate")
def generate(
    payload: GenerateRouteRequest,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    preference = "cleanest_air"
    token = get_bearer_token(authorization)
    payload_data = safe_decode(token) if token else None
    if payload_data and payload_data.get("user_id") is not None:
        user = db.query(User).filter(User.id == str(payload_data["user_id"])).first()
        if user:
            preference = getattr(user, "default_route_preference", preference)

    return recommend_routes(
        db,
        payload.origin.model_dump(),
        payload.destination.model_dump(),
        user_preference=preference,
    )
