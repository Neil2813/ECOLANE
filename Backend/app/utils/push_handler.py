from __future__ import annotations
import json
from typing import Any
from app.core.config import settings

def check_and_notify():
    # Scheduler hook; real push delivery can be wired with pywebpush.
    return {"checked": True, "sent": 0}
