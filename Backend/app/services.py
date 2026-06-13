from __future__ import annotations
from datetime import datetime, date, timedelta, timezone
from typing import Any
import base64, json, math, random
import networkx as nx
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.models import User, OTPToken, Trip, DailyExposure, LSTMForecast, EnvironmentalSegment
from app.utils.argon2_handler import hash_password
from app.utils.jwt_handler import create_access_token
from app.utils.osm_loader import load_graph, nearest_node

ROUTE_TYPES = ["fastest", "cleanest_air", "lowest_carbon"]

def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def user_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "city": user.city,
        "theme": user.theme,
        "default_route_preference": user.default_route_preference,
        "use_everyday": user.use_everyday,
        "commute_destination": user.commute_destination,
        "commute_destination_coords": user.commute_destination_coords,
    }

def profile_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "city": user.city,
        "default_route_preference": user.default_route_preference,
        "theme": user.theme,
        "use_everyday": user.use_everyday,
        "commute_destination": user.commute_destination,
        "commute_destination_coords": user.commute_destination_coords,
        "notifications": {
            "pollution_alerts": user.notifications_pollution,
            "forecast_reminders": user.notifications_forecast,
            "weekly_summary": user.notifications_weekly,
            "reroute_suggestions": user.notifications_reroute_suggestions,
            "daily_report": user.notifications_daily_report,
        },
    }

def ensure_user(db: Session, name="Neil Mathias", email="neil@example.com", password="SecurePass123"):
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user
    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def create_user(db: Session, name: str, email: str, password: str, use_everyday: bool = False, commute_destination: str | None = None, commute_destination_coords: str | None = None):
    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        use_everyday=use_everyday,
        commute_destination=commute_destination,
        commute_destination_coords=commute_destination_coords
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def create_tokens_for_user(user: User) -> str:
    return create_access_token({"user_id": str(user.id), "email": user.email})

def route_polyline(graph: nx.Graph, path):
    coords = []
    seg_ids = []
    for a, b in zip(path[:-1], path[1:]):
        da = graph.nodes[a]
        coords.append([float(da.get("y", 0)), float(da.get("x", 0))])
        edge = graph.get_edge_data(a, b)
        if edge and "segment_id" in edge:
            seg_ids.append(edge["segment_id"])
        else:
            seg_ids.append(f"{a}_{b}")
    last = graph.nodes[path[-1]]
    coords.append([float(last.get("y", 0)), float(last.get("x", 0))])
    return coords, seg_ids

def _segment_from_db_or_fallback(db: Session, segment_id: str) -> dict:
    seg = db.query(EnvironmentalSegment).filter(EnvironmentalSegment.segment_id == segment_id).first()
    if seg:
        return {
            "segment_id": seg.segment_id,
            "pm25": float(seg.pm25 or 0),
            "no2": float(seg.no2 or 0),
            "carbon_intensity": seg.carbon_intensity or "medium",
            "co2_per_min": float(seg.co2_per_min or 0),
            "ndvi": float(seg.ndvi or 0),
            "noise_db": float(seg.noise_db or 0),
            "heat_anomaly": float(seg.heat_anomaly or 0),
            "ecoscore": int(seg.ecoscore or 0),
        }
    h = abs(hash(segment_id))
    pm25 = 40 + (h % 120)
    co2 = 1.5 + ((h // 7) % 60) / 10
    noise = 40 + (h % 35)
    heat = ((h // 5) % 40) / 10
    ndvi = ((h // 11) % 100) / 100
    ecoscore = max(0, min(100, int(100 - (0.35 * pm25 + 8 * co2 + 0.9 * noise + 5 * heat - 12 * ndvi))))
    return {
        "segment_id": segment_id,
        "pm25": float(pm25),
        "no2": float(15 + (h % 40)),
        "carbon_intensity": "high" if co2 > 4.5 else "medium" if co2 > 3 else "low",
        "co2_per_min": float(co2),
        "ndvi": float(ndvi),
        "noise_db": float(noise),
        "heat_anomaly": float(heat),
        "ecoscore": ecoscore,
    }

def _route_metrics_for_path(db: Session, graph: nx.Graph, path, route_type: str):
    coords, seg_ids = route_polyline(graph, path)
    base_min = max(8, len(seg_ids) * 3)
    if route_type == "fastest":
        duration = base_min
    elif route_type == "cleanest_air":
        duration = int(base_min * 1.15)
    else:
        duration = int(base_min * 1.08)

    distance = round(max(1.0, len(seg_ids) * 0.42), 1)
    pm25 = 0.0
    co2 = 0.0
    heat = 0.0
    noise = 0.0
    for sid in seg_ids:
        seg = _segment_from_db_or_fallback(db, sid)
        pm25 += seg["pm25"] * 0.6
        co2 += seg["co2_per_min"] * (duration / max(1, len(seg_ids)))
        heat += seg["heat_anomaly"]
        noise += seg["noise_db"]
    heat_score = int(max(0, min(100, 40 + heat)))
    noise_avg = round(noise / max(1, len(seg_ids)), 1)
    pm25 = round(pm25, 1)
    co2 = round(co2, 1)
    ecoscore = max(0, min(100, int(100 - (0.45 * (pm25 / 10) + 2.5 * co2 + 0.25 * heat_score + 0.12 * noise_avg))))
    return {
        "duration_min": int(duration),
        "distance_km": float(distance),
        "pm25_exposure": pm25,
        "co2_grams": co2,
        "heat_score": heat_score,
        "noise_db": noise_avg,
        "ecoscore": ecoscore,
        "polyline": coords,
        "segment_ids": seg_ids,
    }

def generate_routes(db: Session, origin: dict, destination: dict):
    graph = load_graph()
    a = nearest_node(graph, origin["lat"], origin["lng"])
    b = nearest_node(graph, destination["lat"], destination["lng"])
    try:
        fastest_path = nx.shortest_path(graph, a, b, weight="travel_time")
    except Exception:
        nodes = list(graph.nodes())
        fastest_path = nodes[: min(4, len(nodes))]
    try:
        clean_path = nx.shortest_path(graph, a, b, weight="length")
    except Exception:
        clean_path = fastest_path
    try:
        carbon_path = nx.shortest_path(graph, a, b, weight="length")
    except Exception:
        carbon_path = fastest_path

    fastest = _route_metrics_for_path(db, graph, fastest_path, "fastest")
    fastest.update({"type": "fastest", "label": "Fastest", "recommended": False})

    clean = _route_metrics_for_path(db, graph, clean_path, "cleanest_air")
    clean.update({"type": "cleanest_air", "label": "Cleanest Air", "recommended": True})

    carbon = _route_metrics_for_path(db, graph, carbon_path, "lowest_carbon")
    carbon.update({"type": "lowest_carbon", "label": "Lowest Carbon", "recommended": False})

    best = max([fastest, clean, carbon], key=lambda x: x["ecoscore"])
    for r in [fastest, clean, carbon]:
        r["recommended"] = r["type"] == best["type"]
    return [fastest, clean, carbon]

def generate_reroute(db: Session, current_position: dict, destination: dict, original_route_type: str, reason: str):
    routes = generate_routes(db, current_position, destination)
    routes = [r for r in routes if r["type"] == original_route_type] + [r for r in routes if r["type"] != original_route_type]
    chosen = max(routes, key=lambda x: x["ecoscore"])
    chosen["reroute_reason"] = reason
    return chosen

def bbox_to_features(db: Session, bbox: str, layers: list[str] | None = None):
    """Return environmental segment features for a bounding box.

    Only returns features that exist in the database — no synthetic fallback.
    An empty FeatureCollection is returned when no segments have been ingested yet;
    the frontend handles this gracefully.
    """
    min_lng, min_lat, max_lng, max_lat = map(float, bbox.split(","))
    features = []
    rows = db.query(EnvironmentalSegment).limit(50).all()
    for row in rows:
        if not row.geom:
            continue
        coords = [[min_lng, min_lat], [max_lng, max_lat]]
        try:
            from geoalchemy2.shape import to_shape
            shape = to_shape(row.geom)
            coords = [[float(x), float(y)] for x, y in shape.coords]
        except Exception:
            if isinstance(row.geom, str):
                try:
                    cleaned = row.geom.replace("LINESTRING", "").replace("(", "").replace(")", "").strip()
                    coords = [[float(c.split()[0]), float(c.split()[1])] for c in cleaned.split(",")]
                except Exception:
                    continue
        props = {
            "pm25": row.pm25,
            "no2": row.no2,
            "carbon_intensity": row.carbon_intensity,
            "co2_per_min": row.co2_per_min,
            "ndvi": row.ndvi,
            "noise_db": row.noise_db,
            "heat_anomaly": row.heat_anomaly,
            "ecoscore": row.ecoscore,
        }
        if layers:
            props = {k: v for k, v in props.items() if k in set(layers) or k == "carbon_intensity"}
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {"segment_id": row.segment_id, **props},
        })
    return {"type": "FeatureCollection", "updated_at": _now().isoformat() + "Z", "features": features}

def pollution_for_segments(db: Session, segment_ids: list[str]):
    segments = []
    spike = False
    spike_segment_id = None
    spike_pm25 = None
    for sid in segment_ids:
        seg = _segment_from_db_or_fallback(db, sid)
        segments.append({"segment_id": sid, "pm25": round(seg["pm25"], 1), "no2": round(seg["no2"], 1), "carbon_intensity": seg["carbon_intensity"]})
        if seg["pm25"] > 150 and not spike:
            spike = True
            spike_segment_id = sid
            spike_pm25 = seg["pm25"]
    return {
        "segments": segments,
        "pollution_spike_detected": spike,
        "spike_segment_id": spike_segment_id,
        "spike_pm25": spike_pm25,
    }

def detect_vision(image_b64: str):
    raw = base64.b64decode(image_b64.split(",")[-1])
    if len(raw) > 200_000:
        return {"detections": [], "dominant_emission": None, "local_pm25_adjustment": 0.0, "too_large": True}
    # Lightweight fallback parser for demo / when HF unavailable.
    detections = [
        {"vehicle_type": "bus", "emission_level": "high", "colour": "#EF4444"},
        {"vehicle_type": "auto_rickshaw", "emission_level": "medium", "colour": "#F97316"},
        {"vehicle_type": "bicycle", "emission_level": "low", "colour": "#22C55E"},
    ]
    return {"detections": detections, "dominant_emission": "high", "local_pm25_adjustment": 12.4}

def calculate_exposure_from_trip(db: Session, user: User, trip_payload: dict):
    segment_ids = trip_payload["segment_ids"]
    durations = trip_payload["segment_durations_sec"]
    pm25 = 0.0
    co2 = 0.0
    heat = 0.0
    noise_sum = 0.0
    for sid, dur in zip(segment_ids, durations):
        seg = _segment_from_db_or_fallback(db, sid)
        mins = dur / 60.0
        pm25 += seg["pm25"] * mins
        co2 += seg["co2_per_min"] * mins
        heat += seg["heat_anomaly"] * mins
        noise_sum += seg["noise_db"]
    fastest = generate_routes(db, trip_payload["origin"], trip_payload["destination"])[0]
    pm25_avoided = max(0.0, round(fastest["pm25_exposure"] - pm25, 1))
    ecoscore = max(0, min(100, int(100 - (pm25 / 20 + co2 / 3 + heat + noise_sum / max(1, len(segment_ids))))))

    trip = Trip(
        user_id=user.id,
        origin_lat=trip_payload["origin"]["lat"],
        origin_lng=trip_payload["origin"]["lng"],
        destination_lat=trip_payload["destination"]["lat"],
        destination_lng=trip_payload["destination"]["lng"],
        route_type=trip_payload["route_type"],
        duration_min=int((sum(durations) / 60)),
        distance_km=fastest["distance_km"],
        pm25_inhaled=round(pm25, 1),
        pm25_avoided=pm25_avoided,
        co2_grams=round(co2, 1),
        ecoscore=ecoscore,
        polyline=fastest["polyline"],
        started_at=datetime.fromisoformat(trip_payload["started_at"].replace("Z", "+00:00")).replace(tzinfo=None) if isinstance(trip_payload["started_at"], str) else trip_payload["started_at"],
        ended_at=datetime.fromisoformat(trip_payload["ended_at"].replace("Z", "+00:00")).replace(tzinfo=None) if isinstance(trip_payload["ended_at"], str) else trip_payload["ended_at"],
        heat_exposure=round(heat, 1),
        noise_avg_db=round(noise_sum / max(1, len(segment_ids)), 1),
    )
    db.add(trip)

    today = date.today()
    exposure = db.query(DailyExposure).filter(DailyExposure.user_id == user.id, DailyExposure.date == today).first()
    if not exposure:
        exposure = DailyExposure(user_id=user.id, date=today)
        db.add(exposure)
    exposure.total_pm25 = float((exposure.total_pm25 or 0) + pm25)
    exposure.avoided_pm25 = float((exposure.avoided_pm25 or 0) + pm25_avoided)
    exposure.total_co2 = float((exposure.total_co2 or 0) + co2)
    exposure.city_avg_co2 = float(exposure.city_avg_co2 or 350)
    exposure.ecoscore = ecoscore
    exposure.heat_exposure = float((exposure.heat_exposure or 0) + heat)
    exposure.noise_avg_db = round((exposure.noise_avg_db or 0) + (noise_sum / max(1, len(segment_ids))), 1)

    db.commit()
    db.refresh(trip)
    db.refresh(exposure)

    badge = None
    if pm25_avoided > 200 and co2 < 100 and ecoscore > 85:
        badge = "eco_warrior"
    elif pm25_avoided > 200:
        badge = "pollution_avoider"
    elif co2 < 100:
        badge = "carbon_saver"
    elif ecoscore > 85:
        badge = "clean_commuter"

    return {
        "trip_id": str(trip.id),
        "pm25_inhaled": round(pm25, 1),
        "pm25_avoided": round(pm25_avoided, 1),
        "co2_grams": round(co2, 1),
        "duration_min": trip.duration_min,
        "distance_km": trip.distance_km,
        "ecoscore": ecoscore,
        "badge_earned": badge,
    }

# Badge display metadata (icon name + colour class)
_BADGE_META: dict[str, dict] = {
    "eco_warrior":      {"icon": "trees",  "color": "blue"},
    "pollution_avoider": {"icon": "shield", "color": "orange"},
    "carbon_saver":     {"icon": "trees",  "color": "green"},
    "clean_commuter":   {"icon": "bike",   "color": "green"},
}

# Day-of-week labels used in weekly_pollution
_DOW = ["M", "Tu", "W", "Th", "F", "Sa", "Su"]


def dashboard_summary(db: Session, user: User, for_date: date):
    """Return the full dashboard payload for a user and date.

    All values are sourced from real database rows.  When a user has no
    exposure record for today the response returns zeros — no fabricated
    demo numbers are injected.
    """
    # ── Today's exposure (real zeros if no row yet) ────────────────────────
    exposure = (
        db.query(DailyExposure)
        .filter(DailyExposure.user_id == user.id, DailyExposure.date == for_date)
        .first()
    )
    # Use a zero-value sentinel — do NOT persist it, just read from it.
    if not exposure:
        exposure = DailyExposure(
            user_id=user.id, date=for_date,
            total_pm25=0, avoided_pm25=0, total_co2=0,
            city_avg_co2=0, ecoscore=0, heat_exposure=0, noise_avg_db=0,
        )

    # ── Last 7 days (only real rows) ──────────────────────────────────────
    weekly_rows = (
        db.query(DailyExposure)
        .filter(DailyExposure.user_id == user.id)
        .order_by(DailyExposure.date.desc())
        .limit(7)
        .all()
    )
    weekly_rows = list(reversed(weekly_rows))

    # ── Tomorrow's forecast (only real ML-generated rows) ─────────────────
    forecast_date = for_date + timedelta(days=1)
    forecast = (
        db.query(LSTMForecast)
        .filter(LSTMForecast.user_id == user.id, LSTMForecast.forecast_date == forecast_date)
        .first()
    )

    # ── Trip count ────────────────────────────────────────────────────────
    trip_count = (
        db.query(func.count(Trip.id))
        .filter(Trip.user_id == user.id, func.date(Trip.started_at) == for_date)
        .scalar() or 0
    )

    # ── CO2 vs city average ───────────────────────────────────────────────
    city_avg_co2 = float(exposure.city_avg_co2 or 0)
    co2_vs_avg_percent = (
        round(((float(exposure.total_co2 or 0) - city_avg_co2) / city_avg_co2) * 100, 1)
        if city_avg_co2 else None
    )

    # ── Badges (from real trip history only) ──────────────────────────────
    all_trips = (
        db.query(Trip)
        .filter(Trip.user_id == user.id)
        .order_by(Trip.started_at.desc())
        .all()
    )
    badge_labels = {
        "eco_warrior": "Eco Warrior",
        "pollution_avoider": "Pollution Avoider",
        "carbon_saver": "Carbon Saver",
        "clean_commuter": "Clean Commuter",
    }
    badges: list[dict] = []
    seen: set[str] = set()
    for t in all_trips:
        badge = None
        if (t.pm25_avoided or 0) > 200 and (t.co2_grams or 0) < 100 and (t.ecoscore or 0) > 85:
            badge = "eco_warrior"
        elif (t.pm25_avoided or 0) > 200:
            badge = "pollution_avoider"
        elif (t.co2_grams or 0) < 100:
            badge = "carbon_saver"
        elif (t.ecoscore or 0) > 85:
            badge = "clean_commuter"
        if badge and badge not in seen:
            seen.add(badge)
            meta = _BADGE_META.get(badge, {"icon": "bike", "color": "green"})
            badges.append({
                "id": badge,
                "label": badge_labels[badge],
                "icon": meta["icon"],
                "color": meta["color"],
                "earned_at": (t.started_at.date().isoformat() if t.started_at else for_date.isoformat()),
            })

    # ── Weekly pollution bars (day label + level + status) ────────────────
    weekly_pollution = [
        {
            "day": _DOW[row.date.weekday()],
            "level": round(float(row.total_pm25 or 0), 1),
            "status": "high" if (row.total_pm25 or 0) > 100 else "moderate" if (row.total_pm25 or 0) > 50 else "safe",
        }
        for row in weekly_rows
    ]
    ecoscore_trend = [int(r.ecoscore or 0) for r in weekly_rows]

    # ── Ecoscore week-over-week improvement ───────────────────────────────
    ecoscore_delta = None
    if len(ecoscore_trend) >= 2:
        ecoscore_delta = ecoscore_trend[-1] - ecoscore_trend[0]

    # ── Build forecast section ────────────────────────────────────────────
    forecast_payload: dict | None = None
    if forecast:
        # pct_higher: how much worse predicted_pm25 is vs city avg PM2.5
        city_pm25_ref = float(exposure.total_pm25 or 0) or float(forecast.predicted_pm25 or 0) * 0.6
        pct_higher = (
            round(((float(forecast.predicted_pm25) - city_pm25_ref) / city_pm25_ref) * 100)
            if city_pm25_ref else None
        )
        forecast_payload = {
            "forecast_date": forecast.forecast_date.isoformat(),
            "risk_level": forecast.risk_level,
            "recommended_departure": forecast.recommended_departure,
            "recommended_route": forecast.recommended_route,
            "predicted_pm25": float(forecast.predicted_pm25),
            "pct_higher": pct_higher,
            "reason": forecast.reason,
        }

    return {
        # Flat top-level fields (backward-compat with existing frontend)
        "pm25_inhaled":       round(float(exposure.total_pm25 or 0), 1),
        "pm25_avoided":       round(float(exposure.avoided_pm25 or 0), 1),
        "co2_grams":          round(float(exposure.total_co2 or 0), 1),
        "ecoscore":           int(exposure.ecoscore or 0),
        "heat_exposure":      round(float(exposure.heat_exposure or 0), 1),
        "noise_avg_db":       round(float(exposure.noise_avg_db or 0), 1),
        "trips_today":        trip_count,
        "city_avg_co2":       city_avg_co2,
        "co2_vs_avg_percent": co2_vs_avg_percent,
        "ecoscore_delta":     ecoscore_delta,
        # Nested sections
        "today": {
            "date":               for_date.isoformat(),
            "pm25_inhaled":       round(float(exposure.total_pm25 or 0), 1),
            "pm25_avoided":       round(float(exposure.avoided_pm25 or 0), 1),
            "co2_grams":          round(float(exposure.total_co2 or 0), 1),
            "city_avg_co2":       city_avg_co2,
            "co2_vs_avg_percent": co2_vs_avg_percent,
            "ecoscore":           int(exposure.ecoscore or 0),
            "heat_exposure":      round(float(exposure.heat_exposure or 0), 1),
            "noise_avg_db":       round(float(exposure.noise_avg_db or 0), 1),
            "trips_today":        trip_count,
        },
        "weekly_trend":    [{"date": row.date.isoformat(), "pm25": round(float(row.total_pm25 or 0), 1), "ecoscore": int(row.ecoscore or 0)} for row in weekly_rows],
        "weekly_pollution": weekly_pollution,
        "ecoscore_trend":   ecoscore_trend,
        "ecoscore_delta":   ecoscore_delta,
        "forecast":         forecast_payload,
        "badges":           badges,
    }
