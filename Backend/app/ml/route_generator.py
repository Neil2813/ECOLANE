from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any

import networkx as nx


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
        coords.append([float(node.get("y", 0)), float(node.get("x", 0))])
        edge = _edge_data(graph, a, b)
        segment_ids.append(str(edge.get("segment_id") or f"{a}_{b}"))
    last = graph.nodes[path[-1]]
    coords.append([float(last.get("y", 0)), float(last.get("x", 0))])
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
    max_candidates: int = 24,
) -> tuple[list[CandidateRoute], int]:
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
            nodes = list(graph.nodes())
            raw_paths = [nodes[: min(4, len(nodes))]]

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
