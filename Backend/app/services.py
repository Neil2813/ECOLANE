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
    min_lng, min_lat, max_lng, max_lat = map(float, bbox.split(","))
    features = []
    # Demo features from DB if any; else synthetic grid.
    rows = db.query(EnvironmentalSegment).limit(25).all()
    if rows:
        for row in rows:
            if not row.geom:
                continue
            coords = [[min_lng, min_lat], [max_lng, max_lat]]
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
    else:
        for i in range(5):
            sid = f"seg_demo_{i}"
            coords = [
                [min_lng + (i * 0.002), min_lat + (i * 0.002)],
                [min_lng + (i * 0.002) + 0.003, min_lat + (i * 0.002) + 0.0015],
            ]
            seg = _segment_from_db_or_fallback(db, sid)
            props = {k: seg[k] for k in ["pm25", "no2", "carbon_intensity", "co2_per_min", "ndvi", "noise_db", "heat_anomaly", "ecoscore"]}
            if layers:
                props = {k: v for k, v in props.items() if k in set(layers) or k == "carbon_intensity"}
            features.append({
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": coords},
                "properties": {"segment_id": sid, **props},
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

def dashboard_summary(db: Session, user: User, for_date: date):
    exposure = db.query(DailyExposure).filter(DailyExposure.user_id == user.id, DailyExposure.date == for_date).first()
    if not exposure:
        exposure = DailyExposure(user_id=user.id, date=for_date, total_pm25=340, avoided_pm25=430, total_co2=210, city_avg_co2=350, ecoscore=74, heat_exposure=1.8, noise_avg_db=58)
    weekly_rows = db.query(DailyExposure).filter(DailyExposure.user_id == user.id).order_by(DailyExposure.date.desc()).limit(7).all()
    weekly_rows = list(reversed(weekly_rows))
    if not weekly_rows:
        weekly_rows = [
            DailyExposure(date=for_date - timedelta(days=i), total_pm25=520-i*20, ecoscore=62+i*2, user_id=user.id)
            for i in range(6, -1, -1)
        ]
    forecast_date = for_date + timedelta(days=1)
    forecast = db.query(LSTMForecast).filter(LSTMForecast.user_id == user.id, LSTMForecast.forecast_date == forecast_date).first()
    if not forecast:
        if user.use_everyday and user.commute_destination:
            dest_short = user.commute_destination.split(",")[0]
            forecast = LSTMForecast(
                user_id=user.id,
                forecast_date=forecast_date,
                risk_level="moderate",
                recommended_departure="08:15",
                recommended_route=f"Cleanest Route to {dest_short}",
                predicted_pm25=145.0,
                reason=f"Optimal window found: PM2.5 levels drop to 145µg near {dest_short} corridor between 8:00 AM and 8:30 AM.",
            )
        else:
            forecast = LSTMForecast(
                user_id=user.id,
                forecast_date=forecast_date,
                risk_level="high",
                recommended_departure="07:45",
                recommended_route="Residency Road corridor",
                predicted_pm25=580.0,
                reason="Forecasted northeast wind shift increases diesel particulate concentration on Anna Salai corridor",
            )
    trip_count = db.query(func.count(Trip.id)).filter(Trip.user_id == user.id, func.date(Trip.started_at) == for_date).scalar() or 0
    city_avg_co2 = float(exposure.city_avg_co2 or 350)
    co2_vs_avg_percent = round(((float(exposure.total_co2 or 0) - city_avg_co2) / city_avg_co2) * 100, 1) if city_avg_co2 else 0

    all_trips = db.query(Trip).filter(Trip.user_id == user.id).order_by(Trip.started_at.desc()).all()
    badges = []
    badge_map = {"clean_commuter": "Clean Commuter", "pollution_avoider": "Pollution Avoider", "carbon_saver": "Carbon Saver", "eco_warrior": "Eco Warrior"}
    seen = set()
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
            badges.append({"id": badge, "label": badge_map[badge], "earned_at": (t.started_at.date().isoformat() if t.started_at else for_date.isoformat())})

    return {
        "today": {
            "date": for_date.isoformat(),
            "pm25_inhaled": round(float(exposure.total_pm25 or 0), 1),
            "pm25_avoided": round(float(exposure.avoided_pm25 or 0), 1),
            "co2_grams": round(float(exposure.total_co2 or 0), 1),
            "city_avg_co2": city_avg_co2,
            "co2_vs_avg_percent": co2_vs_avg_percent,
            "ecoscore": int(exposure.ecoscore or 0),
            "heat_exposure": round(float(exposure.heat_exposure or 0), 1),
            "noise_avg_db": round(float(exposure.noise_avg_db or 0), 1),
            "trips_today": trip_count,
        },
        "weekly_trend": [
            {"date": row.date.isoformat(), "pm25": round(float(row.total_pm25 or 0), 1), "ecoscore": int(row.ecoscore or 0)}
            for row in weekly_rows
        ],
        "forecast": {
            "forecast_date": forecast.forecast_date.isoformat(),
            "risk_level": forecast.risk_level,
            "recommended_departure": forecast.recommended_departure,
            "recommended_route": forecast.recommended_route,
            "predicted_pm25": float(forecast.predicted_pm25),
            "reason": forecast.reason,
        },
        "ecoscore_history": [int(r.ecoscore or 0) for r in weekly_rows],
        "badges": badges,
    }
