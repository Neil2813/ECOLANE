from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.schemas.vision import VisionDetectRequest
from app.services import detect_vision

router = APIRouter()

@router.post("/detect")
def detect(payload: VisionDetectRequest, db: Session = Depends(get_db)):
    try:
        result = detect_vision(payload.image_base64)
        if result.get("too_large"):
            raise HTTPException(status_code=400, detail="Image too large")
        return result
    except HTTPException:
        raise
    except Exception:
        return {"detections": [], "dominant_emission": None, "local_pm25_adjustment": 0.0}
