from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from typing import Any

import networkx as nx
import requests


@dataclass
class CandidateRoute:
    route_id: str
    type: str
    label: str
    path: list[Any]
    polyline: list[list[float]]
    segment_ids: list[str]
    duration_min: float
    distance_km: float
    primary_road_class: str = "mixed"
    metrics: dict = field(default_factory=dict)
    forecasts: dict = field(default_factory=dict)
    current_load: int = 0
    degradation_rate: float = 0.0
    ppo_recommended: bool = False
    degradation_warning: str | None = None
    forecast_note: str = ""
    risk_segments: list[dict] = field(default_factory=list)


def _edge_data(graph: nx.Graph, a: Any, b: Any) -> dict:
    edge = graph.get_edge_data(a, b) or {}
    if 0 in edge and isinstance(edge[0], dict):
        return edge[0]
    if edge and all(isinstance(v, dict) for v in edge.values()):
        return next(iter(edge.values()))
    return edge


def _route_polyline(graph: nx.Graph, path: list[Any]) -> tuple[list[list[float]], list[str]]:
    coords: list[list[float]] = []
    segment_ids: list[str] = []
    for a, b in zip(path[:-1], path[1:]):
        node = graph.nodes[a]
        coords.append([float(node.get("x", 0)), float(node.get("y", 0))])
        edge = _edge_data(graph, a, b)
        segment_ids.append(str(edge.get("segment_id") or f"{a}_{b}"))
    last = graph.nodes[path[-1]]
    coords.append([float(last.get("x", 0)), float(last.get("y", 0))])
    return coords, segment_ids


def _route_id(segment_ids: list[str]) -> str:
    digest = hashlib.sha1("|".join(segment_ids).encode("utf-8")).hexdigest()[:8]
    return f"route_{digest}"


def _path_cost(graph: nx.Graph, path: list[Any], weight: str) -> float:
    total = 0.0
    for a, b in zip(path[:-1], path[1:]):
        edge = _edge_data(graph, a, b)
        total += float(edge.get(weight) or edge.get("length") or 1)
    return total


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = a
    lat2, lon2 = b
    radius = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    x = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(x))


def _nearest_node_distance_km(graph: nx.Graph, node: Any, lat: float, lng: float) -> float:
    data = graph.nodes[node]
    return _haversine_km((lat, lng), (float(data.get("y", 0)), float(data.get("x", 0))))


def _osrm_routes(origin: dict, destination: dict, max_routes: int = 8) -> list[CandidateRoute]:
    url = (
        "https://router.project-osrm.org/route/v1/driving/"
        f"{origin['lng']},{origin['lat']};{destination['lng']},{destination['lat']}"
    )
    try:
        response = requests.get(
            url,
            params={
                "alternatives": "true",
                "overview": "full",
                "geometries": "geojson",
                "steps": "false",
            },
            timeout=8,
        )
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return []

    routes: list[CandidateRoute] = []
    for index, item in enumerate(payload.get("routes", [])[:max_routes]):
        coords = item.get("geometry", {}).get("coordinates") or []
        if len(coords) < 2:
            continue
        segment_ids = [f"osrm_{index}_{i}" for i in range(len(coords) - 1)]
        route_type = ["fastest", "cleanest_air", "lowest_carbon"][index] if index < 3 else f"alternative_{index + 1}"
        label = ["Fastest", "Cleanest Air", "Lowest Carbon"][index] if index < 3 else f"Adaptive Route {index + 1}"
        duration_min = max(1.0, float(item.get("duration") or 0) / 60)
        distance_km = max(0.1, float(item.get("distance") or 0) / 1000)
        routes.append(
            CandidateRoute(
                route_id=_route_id(segment_ids + [str(round(distance_km, 2)), str(round(duration_min, 2))]),
                type=route_type,
                label=label,
                path=[],
                polyline=[[float(lng), float(lat)] for lng, lat in coords],
                segment_ids=segment_ids,
                duration_min=duration_min,
                distance_km=round(distance_km, 2),
                primary_road_class="mixed",
            )
        )
    return routes


def is_viable(route: CandidateRoute, graph: nx.Graph, fastest_duration: float) -> bool:
    if route.duration_min > fastest_duration * 3:
        return False
    for a, b in zip(route.path[:-1], route.path[1:]):
        edge = _edge_data(graph, a, b)
        if edge.get("waterway") and not edge.get("bridge"):
            return False
        if edge.get("access") in {"private", "no"}:
            return False
        if edge.get("highway") == "construction":
            return False
    return True


def is_sufficiently_different(
    new_route: CandidateRoute,
    existing_routes: list[CandidateRoute],
    min_divergence: float = 0.3,
) -> bool:
    if not new_route.segment_ids:
        return False
    new_segments = set(new_route.segment_ids)
    for existing in existing_routes:
        shared = new_segments & set(existing.segment_ids)
        overlap_ratio = len(shared) / max(1, len(new_segments))
        if overlap_ratio > (1 - min_divergence):
            return False
    return True


def generate_candidate_routes(
    graph: nx.Graph,
    origin_node: Any,
    destination_node: Any,
    origin: dict | None = None,
    destination: dict | None = None,
    max_candidates: int = 24,
) -> tuple[list[CandidateRoute], int]:
    if origin and destination:
        straight_line_km = _haversine_km(
            (float(origin["lat"]), float(origin["lng"])),
            (float(destination["lat"]), float(destination["lng"])),
        )
        origin_snap_km = _nearest_node_distance_km(graph, origin_node, float(origin["lat"]), float(origin["lng"]))
        destination_snap_km = _nearest_node_distance_km(
            graph,
            destination_node,
            float(destination["lat"]),
            float(destination["lng"]),
        )
        if straight_line_km > 25 or origin_snap_km > 10 or destination_snap_km > 10:
            osrm = _osrm_routes(origin, destination)
            if osrm:
                return osrm, len(osrm)
            return [], 0

    try:
        paths_iter = nx.shortest_simple_paths(graph, origin_node, destination_node, weight="travel_time")
        raw_paths = []
        for path in paths_iter:
            raw_paths.append(list(path))
            if len(raw_paths) >= max_candidates:
                break
    except Exception:
        try:
            raw_paths = [nx.shortest_path(graph, origin_node, destination_node, weight="travel_time")]
        except Exception:
            return [], 0

    fastest_duration = max(1.0, min(_path_cost(graph, p, "travel_time") for p in raw_paths))
    viable: list[CandidateRoute] = []

    for index, path in enumerate(raw_paths):
        polyline, segment_ids = _route_polyline(graph, path)
        duration = max(8.0, _path_cost(graph, path, "travel_time") or len(segment_ids) * 3)
        distance = max(1.0, _path_cost(graph, path, "length") or len(segment_ids) * 0.42)
        edge_classes = [_edge_data(graph, a, b).get("highway", "mixed") for a, b in zip(path[:-1], path[1:])]
        primary = str(max(set(edge_classes), key=edge_classes.count)) if edge_classes else "mixed"
        route_type = ["fastest", "cleanest_air", "lowest_carbon"][index] if index < 3 else f"alternative_{index + 1}"
        label = ["Fastest", "Cleanest Air", "Lowest Carbon"][index] if index < 3 else f"Adaptive Route {index + 1}"
        route = CandidateRoute(
            route_id=_route_id(segment_ids),
            type=route_type,
            label=label,
            path=path,
            polyline=polyline,
            segment_ids=segment_ids,
            duration_min=duration,
            distance_km=round(distance, 2),
            primary_road_class=primary,
        )
        if is_viable(route, graph, fastest_duration):
            viable.append(route)

    diverse: list[CandidateRoute] = []
    for route in viable:
        if len(diverse) < 3 or is_sufficiently_different(route, diverse):
            diverse.append(route)
        if len(diverse) >= 8:
            break

    while viable and len(diverse) < min(3, len(viable)):
        route = viable[len(diverse)]
        if route not in diverse:
            diverse.append(route)

    return diverse, len(viable)
