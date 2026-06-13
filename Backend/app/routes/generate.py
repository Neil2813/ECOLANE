from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.route import GenerateRouteRequest
from app.utils.auth_dep import get_current_user
from app.services import generate_routes, ensure_user

router = APIRouter()

@router.post("/generate")
def generate(payload: GenerateRouteRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    routes = generate_routes(db, payload.origin.model_dump(), payload.destination.model_dump())
    return routes
