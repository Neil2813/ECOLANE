from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import EnvironmentalSegment
from app.ml.route_generator import CandidateRoute
from app.ml.signal_normaliser import compute_weather_score, inverted_ndvi_score, normalise


WEIGHTS = {
    "pm25": 0.25,
    "no2": 0.10,
    "carbon": 0.15,
    "heat": 0.10,
    "noise": 0.08,
    "ndvi": 0.07,
    "weather": 0.05,
    "time": 0.10,
    "distance": 0.05,
    "load": 0.05,
}


def _segment_from_db_or_fallback(db: Session, segment_id: str) -> dict:
    seg = None
    if not db.info.get("segment_lookup_unavailable"):
        try:
            seg = db.query(EnvironmentalSegment).filter(EnvironmentalSegment.segment_id == segment_id).first()
        except Exception:
            db.info["segment_lookup_unavailable"] = True
            try:
                db.rollback()
            except Exception:
                pass
    if seg:
        return {
            "pm25": float(seg.pm25 or 0),
            "no2": float(seg.no2 or 0),
            "co2_per_min": float(seg.co2_per_min or 0),
            "ndvi": float(seg.ndvi or 0),
            "noise_db": float(seg.noise_db or 0),
            "heat_anomaly": float(seg.heat_anomaly or 0),
        }

    h = abs(hash(segment_id))
    return {
        "pm25": float(40 + (h % 120)),
        "no2": float(15 + (h % 40)),
        "co2_per_min": float(1.5 + ((h // 7) % 60) / 10),
        "ndvi": float(((h // 11) % 100) / 100),
        "noise_db": float(40 + (h % 35)),
        "heat_anomaly": float(((h // 5) % 40) / 10),
    }


def compute_route_signals(db: Session, route: CandidateRoute, weather_data: dict | None = None) -> dict:
    segments = [_segment_from_db_or_fallback(db, sid) for sid in route.segment_ids]
    count = max(1, len(segments))
    duration_per_segment = route.duration_min / count

    pm25_exposure = sum(seg["pm25"] * 0.6 for seg in segments)
    co2_grams = sum(seg["co2_per_min"] * duration_per_segment for seg in segments)
    heat_anomaly = sum(seg["heat_anomaly"] for seg in segments) / count
    heat_score = max(0.0, min(100.0, normalise(heat_anomaly, "heat")))
    noise_db = sum(seg["noise_db"] for seg in segments) / count
    no2 = sum(seg["no2"] for seg in segments) / count
    ndvi = sum(seg["ndvi"] for seg in segments) / count
    pm25_avg = sum(seg["pm25"] for seg in segments) / count
    carbon_per_min = co2_grams / max(route.duration_min, 1)
    weather_score = compute_weather_score(weather_data)

    return {
        "pm25_avg": pm25_avg,
        "pm25_exposure": round(pm25_exposure, 1),
        "no2": no2,
        "co2_grams": round(co2_grams, 1),
        "carbon_per_min": carbon_per_min,
        "heat_anomaly": heat_anomaly,
        "heat_score": heat_score,
        "noise_db": round(noise_db, 1),
        "ndvi": ndvi,
        "weather_score": weather_score,
    }


def compute_ecoscore(route: CandidateRoute, load: int, weather_data: dict | None = None) -> int:
    signals = route.metrics
    raw = (
        WEIGHTS["pm25"] * normalise(signals["pm25_avg"], "pm25")
        + WEIGHTS["no2"] * normalise(signals["no2"], "no2")
        + WEIGHTS["carbon"] * normalise(signals["carbon_per_min"], "carbon")
        + WEIGHTS["heat"] * normalise(signals["heat_anomaly"], "heat")
        + WEIGHTS["noise"] * normalise(signals["noise_db"], "noise")
        + WEIGHTS["ndvi"] * inverted_ndvi_score(signals["ndvi"])
        + WEIGHTS["weather"] * normalise(signals.get("weather_score") or compute_weather_score(weather_data), "weather")
        + WEIGHTS["time"] * normalise(route.duration_min, "time")
        + WEIGHTS["distance"] * normalise(route.distance_km, "distance")
        + WEIGHTS["load"] * normalise(load, "load")
    )
    return int(max(0, min(100, round(100 - raw))))
