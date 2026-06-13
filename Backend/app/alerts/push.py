import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.schemas.alerts import SubscribeRequest
from app.db.models import User

router = APIRouter()

@router.post("/subscribe")
def subscribe(payload: SubscribeRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    user.push_subscription = payload.subscription.model_dump_json()
    db.commit()
    return {"message": "Push subscription saved"}

@router.post("/trigger")
def trigger(db: Session = Depends(get_db)):
    # Internal scheduler hook; keeps response simple.
    return {"message": "Push check triggered"}
