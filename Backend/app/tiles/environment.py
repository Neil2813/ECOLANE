from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.services import bbox_to_features

router = APIRouter()

@router.get("/environment")
def environment(
    bbox: str = Query(..., description="min_lng,min_lat,max_lng,max_lat"),
    layers: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        layer_list = [x.strip() for x in layers.split(",") if x.strip()] if layers else None
        return bbox_to_features(db, bbox, layer_list)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid bbox")
