from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.environmental import open_meteo_aq, open_meteo_weather, openaq_client, waqi_client
from app.ml.load_tracker import tracker
from app.ml.route_forecaster import degradation_warning, forecast_note, forecast_route, project_load
from app.ml.route_generator import CandidateRoute, generate_candidate_routes
from app.ml.route_scorer import compute_ecoscore, compute_route_signals
from app.utils.osm_loader import load_graph, nearest_node


def _route_sort_score(route: CandidateRoute) -> float:
    return (
        0.40 * route.metrics["ecoscore_now"]
        + 0.35 * route.forecasts["ecoscore_t10"]
        + 0.25 * route.forecasts["ecoscore_t20"]
    )


def _preference_score(route: CandidateRoute, user_preference: str) -> float:
    if user_preference == "fastest":
        return 100 - route.duration_min
    if user_preference == "lowest_carbon":
        return 100 - route.metrics["co2_grams"]
    return route.metrics["ecoscore_now"]


def _policy_action(routes: list[CandidateRoute], user_preference: str) -> int:
    """PPO-compatible fallback policy until a trained model artifact exists."""
    best_index = 0
    best_score = float("-inf")
    for index, route in enumerate(routes):
        load_penalty = min(20.0, route.current_load * 1.5)
        degradation_penalty = route.degradation_rate * 8
        warning_penalty = 8 if route.degradation_warning else 0
        score = (
            0.55 * _route_sort_score(route)
            + 0.25 * _preference_score(route, user_preference)
            - load_penalty
            - degradation_penalty
            - warning_penalty
        )
        if score > best_score:
            best_index = index
            best_score = score
    return best_index


def _fetch_route_weather(lat: float, lng: float) -> dict:
    try:
        return open_meteo_weather.fetch(lat, lng, timeout=2)
    except Exception:
        return {}


def _fetch_route_air_quality(lat: float, lng: float) -> dict:
    merged: dict[str, Any] = {}
    for fetcher in (open_meteo_aq.fetch, waqi_client.fetch, openaq_client.fetch):
        try:
            data = fetcher(lat, lng, timeout=2)
        except Exception:
            data = {}
        for key in ("pm25", "no2"):
            if data.get(key) is not None:
                merged[key] = data[key]
    return merged


def _label_for_route(route: CandidateRoute, rank: int) -> str:
    if route.ppo_recommended:
        if route.type == "fastest":
            return "Fastest Balanced Pick"
        if route.type == "lowest_carbon":
            return "Lowest Carbon Pick"
        return "PPO Recommended"
    if route.forecasts["ecoscore_t10"] > route.metrics["ecoscore_now"] + 3:
        return "Best in 10 Minutes"
    if route.type in {"fastest", "cleanest_air", "lowest_carbon"}:
        return route.label
    return f"Adaptive Route {rank}"


def _serialise_route(route: CandidateRoute, rank: int) -> dict[str, Any]:
    ecoscore = int(route.metrics["ecoscore_now"])
    return {
        "rank": rank,
        "route_id": route.route_id,
        "type": route.type,
        "label": _label_for_route(route, rank),
        "duration_min": int(round(route.duration_min)),
        "distance_km": round(float(route.distance_km), 2),
        "ecoscore": ecoscore,
        "ecoscore_now": ecoscore,
        "ecoscore_t10": route.forecasts["ecoscore_t10"],
        "ecoscore_t20": route.forecasts["ecoscore_t20"],
        "ecoscore_t30": route.forecasts["ecoscore_t30"],
        "pm25_exposure": route.metrics["pm25_exposure"],
        "co2_grams": route.metrics["co2_grams"],
        "heat_score": int(round(route.metrics["heat_score"])),
        "noise_db": route.metrics["noise_db"],
        "current_users_on_route": route.current_load,
        "ppo_recommended": route.ppo_recommended,
        "recommended": route.ppo_recommended,
        "degradation_warning": route.degradation_warning,
        "forecast_note": route.forecast_note,
        "polyline": route.polyline,
        "segment_ids": route.segment_ids,
    }


def build_state_vector(routes: list[CandidateRoute], user_preference: str, user_state: dict | None = None) -> dict:
    preference = {
        "fastest": [1, 0, 0],
        "cleanest_air": [0, 1, 0],
        "lowest_carbon": [0, 0, 1],
    }.get(user_preference, [0, 1, 0])
    return {
        "ecoscore_now": [r.metrics["ecoscore_now"] for r in routes],
        "ecoscore_t10": [r.forecasts["ecoscore_t10"] for r in routes],
        "ecoscore_t20": [r.forecasts["ecoscore_t20"] for r in routes],
        "ecoscore_t30": [r.forecasts["ecoscore_t30"] for r in routes],
        "current_load": [r.current_load for r in routes],
        "degradation_rate": [r.degradation_rate for r in routes],
        "predicted_load_t10": [project_load(r, 10) for r in routes],
        "carbon_scores": [r.metrics["co2_grams"] for r in routes],
        "time_scores": [r.duration_min for r in routes],
        "user_preference": preference,
        "user_exposure_today": float((user_state or {}).get("user_exposure_today", 0)),
        "time_of_day": datetime.now().hour / 24,
        "trip_urgency": float((user_state or {}).get("trip_urgency", 0.5)),
    }


def recommend_routes(
    db: Session,
    origin: dict,
    destination: dict,
    user_preference: str = "cleanest_air",
    user_state: dict | None = None,
    register_load: bool = True,
) -> dict[str, Any]:
    graph = load_graph()
    origin_node = nearest_node(graph, origin["lat"], origin["lng"])
    destination_node = nearest_node(graph, destination["lat"], destination["lng"])
    routes, total_viable = generate_candidate_routes(graph, origin_node, destination_node)

    midpoint = {
        "lat": (float(origin["lat"]) + float(destination["lat"])) / 2,
        "lng": (float(origin["lng"]) + float(destination["lng"])) / 2,
    }
    weather_data = _fetch_route_weather(midpoint["lat"], midpoint["lng"])
    aq_data = _fetch_route_air_quality(midpoint["lat"], midpoint["lng"])

    for route in routes:
        route.current_load = tracker.get_route_load(route.route_id)
        route.metrics = compute_route_signals(db, route, weather_data)
        if aq_data.get("pm25"):
            route.metrics["pm25_avg"] = (route.metrics["pm25_avg"] + float(aq_data["pm25"])) / 2
        if aq_data.get("no2"):
            route.metrics["no2"] = (route.metrics["no2"] + float(aq_data["no2"])) / 2
        route.metrics["ecoscore_now"] = compute_ecoscore(route, route.current_load, weather_data)
        forecast_route(route, weather_data)
        route.degradation_warning = degradation_warning(route)
        route.forecast_note = forecast_note(route)

    if not routes:
        return {
            "routes": [],
            "recommended_index": 0,
            "total_routes_found": 0,
            "routes_shown": 0,
            "load_distribution_active": False,
            "city_avg_pm25_now": round(float(aq_data.get("pm25") or 0), 1),
            "city_avg_pm25_t10": round(float(aq_data.get("pm25") or 0), 1),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    build_state_vector(routes, user_preference, user_state)
    action = _policy_action(routes, user_preference)
    recommended = routes[action]
    recommended.ppo_recommended = True
    if register_load:
        tracker.register_user_on_route(recommended.route_id, recommended.duration_min)
        recommended.current_load = tracker.get_route_load(recommended.route_id)

    sorted_routes = sorted(routes, key=_route_sort_score, reverse=True)
    sorted_routes.remove(recommended)
    sorted_routes.insert(0, recommended)

    serialised = [_serialise_route(route, index + 1) for index, route in enumerate(sorted_routes)]
    pm25_now = round(float(aq_data.get("pm25") or routes[0].metrics["pm25_avg"]), 1)
    return {
        "routes": serialised,
        "recommended_index": 0,
        "total_routes_found": total_viable,
        "routes_shown": len(serialised),
        "load_distribution_active": True,
        "city_avg_pm25_now": pm25_now,
        "city_avg_pm25_t10": round(pm25_now * 1.05, 1),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def run():
    return {"status": "ok", "module": "ppo_router"}
