# EcoLens — PPO-Based Adaptive Routing System
**File:** `app/ml/ppo_router.py` + supporting modules
**Version:** 1.0 · June 2026

---

## Overview

The EcoLens routing engine is not a static shortest-path calculator. It is a **live, adaptive, multi-agent reinforcement learning system** that:

1. Generates **N possible routes** (not just 3) for any origin→destination pair
2. Scores each route on a **multi-signal aggregate EcoScore** using all available environmental APIs
3. **Predicts how each route's quality will degrade** in the next 10, 20, and 30 minutes based on forecasted signal changes
4. **Distributes users across routes** — if too many users are already on Route A, the system recommends Route B before Route A degrades, not after
5. **Rebalances continuously** so no single "best route" becomes a pollution corridor due to convergence

---

## 1. The Core Problem This Solves

### Route Convergence Without PPO
```
All 100 users → cleanest route (T=0)
Cleanest route gets congested (T+5min)
PM2.5 spikes on cleanest route (T+8min)
Users rerouted AFTER they are already exposed (T+10min)
```

### Route Convergence With PPO
```
User 1–30 → Route A (cleanest right now)
User 31–60 → Route B (2nd cleanest, but will stay clean)
User 61–100 → Route C (3rd, but Route A will degrade in 8 mins)
All users → optimal exposure across the system
No route becomes a new pollution hotspot
```

The PPO agent does not optimise for **one user's best route**. It optimises for **population-level best outcomes** while giving each individual user a route that is personally near-optimal.

---

## 2. Signal Sources and Weights

Every route is scored using signals from all available APIs. Each signal is normalised 0–100 (0 = best, 100 = worst).

### 2.1 Signal Table

| Signal | API Source | Update Frequency | Weight in EcoScore |
|---|---|---|---|
| PM2.5 concentration | OpenAQ v3, WAQI, Open-Meteo AQ | 15–30 min | 0.25 |
| NO2 concentration | OpenAQ v3, Open-Meteo AQ | 15–30 min | 0.10 |
| Carbon intensity (CO2/min) | Computed from traffic × MoRTH factors | 30 min | 0.15 |
| Urban heat anomaly | Computed from Landsat 8 thermal | 8 days | 0.10 |
| Noise pollution | Modelled from traffic density + road class | 30 min | 0.08 |
| Green cover (NDVI) | Sentinel-2 Copernicus | 10 days | 0.07 |
| Weather conditions | Open-Meteo Weather | 1 hour | 0.05 |
| Travel time | OSM graph + live congestion estimate | Real-time | 0.10 |
| Travel distance | OSM graph | Static | 0.05 |
| Route load (current users) | Internal EcoLens user tracking | Real-time | 0.05 |

**Total weight = 1.00**

### 2.2 Signal Aggregation Formula

```python
EcoScore_raw = (
    0.25 * pm25_score +
    0.10 * no2_score +
    0.15 * carbon_score +
    0.10 * heat_score +
    0.08 * noise_score +
    0.07 * ndvi_score +        # inverted: high NDVI = low score (better)
    0.05 * weather_score +
    0.10 * time_score +
    0.05 * distance_score +
    0.05 * load_score
)

# EcoScore displayed to user = 100 - EcoScore_raw
# Higher displayed EcoScore = better route
```

### 2.3 Signal Normalisation

Each raw signal is normalised against city-level thresholds:

```python
def normalise(value, min_val, max_val):
    """Returns 0 (best) to 100 (worst)"""
    return max(0, min(100, (value - min_val) / (max_val - min_val) * 100))

THRESHOLDS = {
    "pm25":     {"min": 0,    "max": 300},   # µg/m³
    "no2":      {"min": 0,    "max": 200},   # µg/m³
    "carbon":   {"min": 0,    "max": 20},    # g CO2/min
    "heat":     {"min": -2,   "max": 8},     # °C anomaly
    "noise":    {"min": 40,   "max": 85},    # dB
    "ndvi":     {"min": 0,    "max": 1},     # inverted
    "weather":  {"min": 0,    "max": 10},    # composite risk score
    "time":     {"min": 0,    "max": 90},    # minutes
    "distance": {"min": 0,    "max": 20},    # km
    "load":     {"min": 0,    "max": 50},    # concurrent users on route
}
```

### 2.4 Weather Composite Risk Score

Open-Meteo Weather API provides: wind speed, wind direction, precipitation, humidity, UV index, visibility.

```python
def compute_weather_score(weather_data):
    """
    Returns 0-10 weather risk for pedestrian/cyclist commuter.
    High wind disperses pollution (good) but increases heat stress.
    Rain reduces PM2.5 (good) but increases discomfort.
    """
    score = 0
    score += min(3, weather_data["precipitation_mm"] * 0.5)      # rain penalty
    score += min(2, max(0, weather_data["wind_speed_kmh"] - 20) * 0.1)  # strong wind penalty
    score += min(2, weather_data["uv_index"] * 0.3)              # UV penalty
    score += min(3, max(0, (100 - weather_data["visibility_km"] * 10)))  # low visibility
    return score
```

---

## 3. Route Generation — N Routes, Not 3

### 3.1 Why N Routes

For any origin→destination pair on an urban OSM graph, there are typically 8–40 distinct viable routes depending on city density. The system generates **all viable routes** and scores them all. The user sees the top N ranked by EcoScore, where N is determined by:

```python
MAX_ROUTES_TO_SHOW = min(len(all_viable_routes), 8)
# Cap at 8 to avoid UI overload
# Show minimum 3 always
MIN_ROUTES_TO_SHOW = 3
```

### 3.2 Viability Filter — Land Routes Only

Before scoring, all generated routes pass through a viability filter:

```python
def is_viable(route, graph):
    """
    Returns True only if route is:
    1. On land (no water-crossing segments without bridge tag in OSM)
    2. On pedestrian/road network (no motorway-only segments if user is walking)
    3. Under 3× the duration of the fastest route (not absurdly long)
    4. No segments tagged as 'access=private' or 'access=no'
    5. No segments with 'highway=construction'
    """
    for edge in route.edges:
        if graph[edge]["waterway"] == True and graph[edge]["bridge"] != True:
            return False
        if graph[edge]["access"] in ["private", "no"]:
            return False
        if graph[edge]["highway"] == "construction":
            return False
    if route.duration_min > fastest_route.duration_min * 3:
        return False
    return True
```

OSM edge attributes used: `highway`, `access`, `bridge`, `waterway`, `tunnel`, `surface`

### 3.3 Route Diversity Filter

To avoid returning 8 nearly identical routes:

```python
def is_sufficiently_different(new_route, existing_routes, min_divergence=0.3):
    """
    A route is included only if at least 30% of its segments
    are not shared with any already-selected route.
    This ensures routes are geographically meaningfully different.
    """
    for existing in existing_routes:
        shared_segments = set(new_route.segment_ids) & set(existing.segment_ids)
        overlap_ratio = len(shared_segments) / len(new_route.segment_ids)
        if overlap_ratio > (1 - min_divergence):
            return False
    return True
```

---

## 4. Future Prediction — The 10/20/30 Minute Forecast

This is the core innovation that prevents route convergence.

### 4.1 Prediction Architecture

For each viable route, the system forecasts what the EcoScore will be at:
- **T+10 minutes** (when a slow commuter is halfway through)
- **T+20 minutes** (when most commuters are still on the route)
- **T+30 minutes** (the full impact window)

```python
class RouteForecast:
    route_id: str
    ecoscore_now: float
    ecoscore_t10: float   # predicted EcoScore in 10 minutes
    ecoscore_t20: float
    ecoscore_t30: float
    degradation_rate: float  # how fast this route is getting worse
    peak_load_eta: int       # minutes until this route hits maximum user load
```

### 4.2 What Drives Prediction

**Signal 1 — User Load Projection**
```python
def project_load(route_id, minutes_ahead):
    """
    current_users_on_route: tracked in Redis with TTL per user
    new_users_rate: users/minute currently being routed to this route
    departure_rate: users/minute leaving this route (based on avg route duration)

    projected_load = current_load + (new_users_rate × minutes) - (departure_rate × minutes)
    """
    current = redis.get(f"route_load:{route_id}")
    inflow = redis.get(f"route_inflow_rate:{route_id}")   # users/min
    outflow = 1 / avg_duration_min                         # users/min leaving
    return current + (inflow - outflow) * minutes_ahead
```

**Signal 2 — PM2.5 Forecast from Open-Meteo AQ**
```python
# Open-Meteo Air Quality API provides hourly forecasts for:
# pm2_5, nitrogen_dioxide, carbon_monoxide, ozone, dust
# up to 5 days ahead at 1-hour resolution
# We interpolate to 10/20/30 minute intervals

response = requests.get(
    f"{OPEN_METEO_AQ_URL}",
    params={
        "latitude": segment_centroid_lat,
        "longitude": segment_centroid_lng,
        "hourly": "pm2_5,nitrogen_dioxide",
        "forecast_days": 1,
        "timezone": "Asia/Kolkata"
    }
)
# Returns hourly PM2.5 forecast
# Interpolate: pm25_t10 = pm25_now + (pm25_next_hour - pm25_now) * (10/60)
```

**Signal 3 — Traffic Density Trend**
```python
# Carbon and noise scores degrade as traffic builds
# Morning peak: 8-10am → traffic builds at ~15% per 10min
# Evening peak: 5-8pm → traffic builds at ~12% per 10min
# Off-peak: traffic stable ±5%

def project_traffic_score(carbon_score_now, noise_score_now, time_of_day):
    peak_multipliers = {
        "morning_peak": 1.15,   # per 10 minutes
        "evening_peak": 1.12,
        "off_peak": 1.02
    }
    multiplier = peak_multipliers[classify_time(time_of_day)]
    return {
        "t10": min(100, carbon_score_now * multiplier),
        "t20": min(100, carbon_score_now * multiplier**2),
        "t30": min(100, carbon_score_now * multiplier**3)
    }
```

**Signal 4 — Wind Direction (Pollution Dispersion)**
```python
# Open-Meteo Weather provides wind speed + direction hourly
# Wind from high-emission areas (industrial zones, highways) increases PM2.5
# Wind from sea/open areas decreases PM2.5

def wind_pollution_factor(segment_bearing, wind_direction, wind_speed):
    """
    If wind blows FROM a known emission source TOWARD the segment,
    apply a pollution amplification factor.
    """
    angular_diff = abs(segment_bearing - wind_direction) % 360
    if angular_diff > 180:
        angular_diff = 360 - angular_diff
    # Headwind from emission source: amplify pollution
    if angular_diff < 45 and wind_speed > 10:
        return 1.3
    # Crosswind: neutral
    elif angular_diff < 90:
        return 1.0
    # Tailwind from clean area: reduce pollution
    else:
        return 0.85
```

### 4.3 Combined Future EcoScore

```python
def predict_future_ecoscore(route, minutes_ahead):
    pm25_future = interpolate_openmeteo_forecast(route, minutes_ahead)
    load_future = project_load(route.id, minutes_ahead)
    traffic_future = project_traffic_score(route, minutes_ahead)
    wind_factor = wind_pollution_factor(route, minutes_ahead)

    future_raw = (
        0.25 * normalise(pm25_future * wind_factor, "pm25") +
        0.10 * normalise(route.no2_now, "no2") +          # NO2 changes slowly
        0.15 * traffic_future["carbon"] +
        0.10 * route.heat_score +                          # heat changes slowly
        0.08 * traffic_future["noise"] +
        0.07 * route.ndvi_score +                          # NDVI static
        0.05 * route.weather_score +
        0.10 * route.time_score +                          # time unaffected
        0.05 * route.distance_score +
        0.05 * normalise(load_future, "load")
    )
    return 100 - future_raw
```

---

## 5. The PPO Agent

### 5.1 What PPO Decides

The PPO agent does not generate routes — NetworkX does that. PPO decides **which route to recommend to which user** given:
- The current EcoScore of all N routes
- The predicted future EcoScore at T+10/20/30
- The current load distribution across routes
- The user's personal preference vector

### 5.2 State Space

```python
# State vector per routing decision (flattened to 1D array for PPO input)
state = {
    # Per route (for N routes, N ≤ 8):
    "ecoscore_now":        [87, 74, 68, 61, ...],   # N values
    "ecoscore_t10":        [82, 76, 71, 65, ...],   # N values (predicted)
    "ecoscore_t20":        [74, 77, 73, 68, ...],   # N values
    "ecoscore_t30":        [65, 76, 74, 70, ...],   # N values
    "current_load":        [12, 3, 1, 0, ...],      # N values (users on route)
    "degradation_rate":    [1.3, 0.8, 0.6, 0.4, ...], # N values

    # User context:
    "user_preference":     [0, 1, 0],               # [fastest, cleanest, lowest_carbon]
    "user_exposure_today": 0.45,                    # normalised: how much they've inhaled today
    "time_of_day":         0.33,                    # normalised: 0=midnight, 1=midnight
    "trip_urgency":        0.5,                     # inferred: 0=relaxed, 1=urgent
}
# Total state dimension: (N × 6) + 4 = 52 for N=8
```

### 5.3 Action Space

```python
# Discrete action space:
# Action = index of route to recommend (0 to N-1)
action_space = Discrete(N)  # N = number of viable routes for this trip

# The agent picks one action per routing request
# That action = the route index recommended to this user
```

### 5.4 Reward Function

This is the most important part. The reward is designed to optimise for **population-level outcomes**, not just individual optimum:

```python
def compute_reward(action, state, outcome):
    """
    Called after trip completion with actual measured outcomes.
    Used for offline training and continuous fine-tuning.

    Components:
    1. Individual exposure reward: did user inhale less PM2.5?
    2. Load balance reward: did recommendation help distribute load?
    3. Future accuracy reward: was the T+10 prediction accurate?
    4. Preference alignment reward: did route match user's stated preference?
    """

    selected_route = action
    actual_pm25 = outcome["actual_pm25_inhaled"]
    fastest_pm25 = outcome["fastest_route_pm25"]
    actual_load_after = outcome["route_load_at_t10"]
    predicted_load = state["predicted_load_t10"][selected_route]

    # 1. Exposure reward: lower exposure than fastest = positive reward
    exposure_reward = (fastest_pm25 - actual_pm25) / fastest_pm25 * 10
    # Range: -10 (worse than fastest) to +10 (much better)

    # 2. Load balance reward: penalise if recommendation caused overload
    load_penalty = 0
    if actual_load_after > 30:          # >30 users on one route = overloaded
        load_penalty = -5
    elif actual_load_after > 20:
        load_penalty = -2

    # 3. Prediction accuracy reward
    prediction_error = abs(predicted_load - actual_load_after) / max(actual_load_after, 1)
    prediction_reward = max(0, 2 - prediction_error * 2)
    # Range: 0 to +2 (accurate predictions rewarded)

    # 4. Preference alignment reward
    pref = state["user_preference"]
    if pref[1] == 1:  # user wants cleanest
        pref_reward = 3 if selected_route == argmax(state["ecoscore_now"]) else 1
    elif pref[2] == 1:  # user wants lowest carbon
        pref_reward = 3 if selected_route == argmin(state["carbon_scores"]) else 1
    else:  # fastest
        pref_reward = 3 if selected_route == argmin(state["time_scores"]) else 1

    total_reward = exposure_reward + load_penalty + prediction_reward + pref_reward
    return total_reward
    # Typical range: -7 to +25
    # Agent learns to avoid overloaded routes and inaccurate predictions
```

### 5.5 PPO Training Configuration

```python
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv

# Environment: EcoLensRoutingEnv (custom Gymnasium environment)
env = DummyVecEnv([lambda: EcoLensRoutingEnv()])

model = PPO(
    policy="MlpPolicy",
    env=env,
    learning_rate=3e-4,
    n_steps=2048,           # steps per rollout
    batch_size=64,
    n_epochs=10,
    gamma=0.95,             # discount factor: care more about immediate reward
                            # because route conditions change fast
    gae_lambda=0.95,
    clip_range=0.2,
    ent_coef=0.01,          # entropy coefficient: encourages route diversity
    vf_coef=0.5,
    max_grad_norm=0.5,
    verbose=1,
    tensorboard_log="./logs/ppo_router/"
)

# Initial training: simulate 100,000 routing decisions using historical data
model.learn(total_timesteps=100_000)
model.save("./models/ppo_route_optimizer_v1")
```

### 5.6 Custom Gymnasium Environment

```python
import gymnasium as gym
from gymnasium import spaces
import numpy as np

class EcoLensRoutingEnv(gym.Env):
    """
    Simulates the routing decision environment for PPO training.
    Each step = one routing decision for one user.
    """
    metadata = {"render_modes": []}

    def __init__(self, max_routes=8):
        super().__init__()
        self.max_routes = max_routes

        # Observation space: state vector
        obs_dim = (max_routes * 6) + 4   # 52 dimensions
        self.observation_space = spaces.Box(
            low=0.0, high=1.0,
            shape=(obs_dim,),
            dtype=np.float32
        )

        # Action space: which route to recommend
        self.action_space = spaces.Discrete(max_routes)

        self.current_state = None
        self.step_count = 0

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        # Generate a synthetic or historical routing scenario
        self.current_state = self._sample_scenario()
        self.step_count = 0
        return self._flatten_state(self.current_state), {}

    def step(self, action):
        # Simulate outcome of recommending route[action]
        outcome = self._simulate_outcome(action, self.current_state)
        reward = compute_reward(action, self.current_state, outcome)

        # Update load distribution after this recommendation
        self.current_state["current_load"][action] += 1

        self.step_count += 1
        terminated = self.step_count >= 200   # episode = 200 routing decisions
        truncated = False

        next_state = self._sample_scenario()   # next routing request arrives
        self.current_state = next_state

        return self._flatten_state(next_state), reward, terminated, truncated, {}

    def _flatten_state(self, state):
        arr = []
        n = self.max_routes
        for key in ["ecoscore_now", "ecoscore_t10", "ecoscore_t20",
                    "ecoscore_t30", "current_load", "degradation_rate"]:
            vals = state.get(key, [0] * n)
            arr.extend([v/100 for v in vals[:n]] + [0] * (n - len(vals)))
        arr.extend(state["user_preference"])
        arr.append(state["user_exposure_today"])
        return np.array(arr, dtype=np.float32)

    def _sample_scenario(self):
        """Sample from historical routing data or generate synthetic scenario."""
        # In production: pull from recent routing requests in DB
        # For training: generate synthetic scenarios with realistic distributions
        n = np.random.randint(3, self.max_routes + 1)
        return {
            "ecoscore_now": np.random.uniform(40, 95, n).tolist(),
            "ecoscore_t10": np.random.uniform(35, 90, n).tolist(),
            "ecoscore_t20": np.random.uniform(30, 88, n).tolist(),
            "ecoscore_t30": np.random.uniform(28, 85, n).tolist(),
            "current_load": np.random.randint(0, 40, n).tolist(),
            "degradation_rate": np.random.uniform(0.3, 2.0, n).tolist(),
            "user_preference": np.random.multinomial(1, [0.3, 0.5, 0.2]).tolist(),
            "user_exposure_today": np.random.uniform(0, 1),
            "time_of_day": np.random.uniform(0, 1),
            "trip_urgency": np.random.uniform(0, 1),
        }

    def _simulate_outcome(self, action, state):
        """Simulate what actually happens after recommending route[action]."""
        base_pm25 = (1 - state["ecoscore_now"][action] / 100) * 300
        load_impact = state["current_load"][action] * 2.5   # each user adds ~2.5 µg/m³
        actual_pm25 = base_pm25 + load_impact + np.random.normal(0, 10)
        return {
            "actual_pm25_inhaled": max(0, actual_pm25),
            "fastest_route_pm25": (1 - min(state["ecoscore_now"]) / 100) * 300 * 1.5,
            "route_load_at_t10": state["current_load"][action] + np.random.randint(1, 8),
        }
```

---

## 6. Load Distribution System

### 6.1 Route Load Tracking (Redis)

```python
# Every active navigation session writes its route to Redis
# Key: route_load:{route_hash}
# Value: count of active users
# TTL: set to avg route duration + 5 min buffer

def register_user_on_route(route_id, duration_min):
    ttl = int(duration_min * 60) + 300
    redis.incr(f"route_load:{route_id}")
    redis.expire(f"route_load:{route_id}", ttl)

def deregister_user_from_route(route_id):
    current = redis.get(f"route_load:{route_id}")
    if current and int(current) > 0:
        redis.decr(f"route_load:{route_id}")

def get_route_load(route_id):
    val = redis.get(f"route_load:{route_id}")
    return int(val) if val else 0

# Inflow rate tracking (users/minute being routed to this route)
def update_inflow_rate(route_id):
    key = f"route_inflow:{route_id}:{int(time.time() // 60)}"
    redis.incr(key)
    redis.expire(key, 120)  # 2-minute window

def get_inflow_rate(route_id):
    key = f"route_inflow:{route_id}:{int(time.time() // 60)}"
    return int(redis.get(key) or 0)
```

### 6.2 The Critical Decision: When to Switch Recommendation

```python
ROUTE_CAPACITY_THRESHOLDS = {
    "residential":  15,   # max users before degradation
    "arterial":     25,
    "highway":      40,
    "mixed":        20,   # default
}

def should_deprioritise_route(route):
    current_load = get_route_load(route.id)
    capacity = ROUTE_CAPACITY_THRESHOLDS.get(route.primary_road_class, 20)

    # Hard cap: route is saturated
    if current_load >= capacity:
        return True, "saturated"

    # Soft cap: route will be saturated in 10 minutes based on inflow rate
    inflow = get_inflow_rate(route.id)
    projected_t10 = current_load + inflow * 10
    if projected_t10 >= capacity * 0.85:
        return True, "approaching_saturation"

    # Prediction cap: future EcoScore drops below threshold
    if route.ecoscore_t10 < route.ecoscore_now - 15:
        return True, "predicted_degradation"

    return False, None
```

### 6.3 The Recommendation Logic in Practice

```python
def recommend_route_for_user(all_routes, user_preference, user_state):
    """
    Core recommendation logic called for every routing request.
    Returns ordered list of routes — PPO-ranked.
    """
    # Step 1: Filter viable routes
    viable = [r for r in all_routes if is_viable(r, graph)]

    # Step 2: Apply diversity filter
    diverse = apply_diversity_filter(viable, min_divergence=0.3)

    # Step 3: Compute current + future EcoScores for all routes
    for route in diverse:
        route.ecoscore_now = compute_ecoscore(route)
        route.ecoscore_t10 = predict_future_ecoscore(route, 10)
        route.ecoscore_t20 = predict_future_ecoscore(route, 20)
        route.ecoscore_t30 = predict_future_ecoscore(route, 30)
        route.current_load = get_route_load(route.id)
        route.degradation_rate = (
            route.ecoscore_now - route.ecoscore_t30
        ) / 30  # score points lost per minute

    # Step 4: Build state vector for PPO
    state = build_state_vector(diverse, user_preference, user_state)

    # Step 5: PPO agent recommends route index
    model = PPO.load("./models/ppo_route_optimizer_v1")
    action, _ = model.predict(state, deterministic=False)
    # deterministic=False allows some stochasticity → natural load distribution

    # Step 6: Register user on recommended route
    recommended = diverse[action]
    register_user_on_route(recommended.id, recommended.duration_min)
    update_inflow_rate(recommended.id)

    # Step 7: Sort remaining routes by a blend of now + future score
    def route_sort_key(r):
        # Blend: 40% current, 35% T+10, 25% T+20
        return 0.40 * r.ecoscore_now + 0.35 * r.ecoscore_t10 + 0.25 * r.ecoscore_t20

    sorted_routes = sorted(diverse, key=route_sort_key, reverse=True)

    # Step 8: Move PPO-recommended route to top
    sorted_routes.remove(recommended)
    sorted_routes.insert(0, recommended)

    return sorted_routes
```

---

## 7. What the User Sees

Each route card returned to the frontend now carries:

```json
{
  "rank": 1,
  "route_id": "route_a8f2",
  "label": "Cleanest Air Now",
  "duration_min": 17,
  "distance_km": 3.8,
  "ecoscore_now": 87,
  "ecoscore_t10": 84,
  "ecoscore_t20": 79,
  "ecoscore_t30": 71,
  "pm25_exposure": 110,
  "co2_grams": 180,
  "heat_score": 30,
  "noise_db": 48,
  "current_users_on_route": 4,
  "ppo_recommended": true,
  "degradation_warning": null,

  "forecast_note": "This route stays clean for the next 20 minutes.",
  "polyline": [...]
},
{
  "rank": 2,
  "route_id": "route_c3d9",
  "label": "Best in 10 Minutes",
  "ecoscore_now": 74,
  "ecoscore_t10": 81,
  "ecoscore_t20": 83,
  "ppo_recommended": false,
  "degradation_warning": null,
  "forecast_note": "Slightly worse now but will outperform Route 1 in ~10 minutes as traffic clears.",
  "polyline": [...]
},
{
  "rank": 3,
  "route_id": "route_e7k1",
  "label": "Fastest",
  "ecoscore_now": 42,
  "ecoscore_t10": 38,
  "degradation_warning": "Approaching high load — EcoScore dropping",
  "forecast_note": "Currently handling 18 users. Pollution expected to increase in 8 minutes.",
  "polyline": [...]
}
```

**Key UI elements from this data:**
- `forecast_note` shown as a small grey line under each route card
- `degradation_warning` shown as an orange badge on the route card
- `ecoscore_t10/t20/t30` shown as a mini sparkline under the EcoScore badge
- Routes sorted by PPO recommendation, not just current EcoScore

---

## 8. Continuous Learning

### 8.1 Feedback Loop

```python
# After each trip ends (exposure/calculate endpoint):
# 1. Compare predicted T+10 EcoScore vs actual measured EcoScore
# 2. Compare predicted load vs actual load
# 3. Write outcome to training_data table in PostgreSQL
# 4. Every 500 completed trips → fine-tune PPO model on new data

def collect_training_sample(trip, predicted_state, actual_outcome):
    db.insert("training_samples", {
        "trip_id": trip.id,
        "state_vector": json.dumps(predicted_state),
        "action": trip.route_index,
        "reward": compute_reward(trip.route_index, predicted_state, actual_outcome),
        "actual_pm25": actual_outcome["actual_pm25_inhaled"],
        "predicted_ecoscore_t10": predicted_state["ecoscore_t10"][trip.route_index],
        "actual_ecoscore_t10": actual_outcome["measured_ecoscore_t10"],
        "created_at": datetime.now()
    })
```

### 8.2 Scheduled Fine-Tuning

```python
# APScheduler job: every 6 hours
def fine_tune_ppo():
    samples = db.query(
        "SELECT * FROM training_samples WHERE used_for_training = false ORDER BY created_at DESC LIMIT 2000"
    )
    if len(samples) < 500:
        return  # not enough new data

    # Convert to training episodes and fine-tune
    model = PPO.load("./models/ppo_route_optimizer_v1")
    env = DummyVecEnv([lambda: EcoLensRoutingEnv(historical_data=samples)])
    model.set_env(env)
    model.learn(total_timesteps=10_000, reset_num_timesteps=False)
    model.save(f"./models/ppo_route_optimizer_v{get_next_version()}")

    db.execute("UPDATE training_samples SET used_for_training = true WHERE id IN (...)")
    logger.info(f"PPO fine-tuning complete. {len(samples)} new samples used.")
```

---

## 9. API Endpoint — /api/routes/generate (Updated)

```python
# POST /api/routes/generate
# Now returns N routes with full forecast data

Response schema (updated):
{
  "routes": [RouteObject × N],        # N viable routes, PPO-ranked
  "recommended_index": 0,             # index of PPO top pick
  "total_routes_found": 12,           # total viable routes found before diversity filter
  "routes_shown": 6,                  # routes returned after diversity filter
  "load_distribution_active": true,   # whether PPO load balancing is active
  "city_avg_pm25_now": 145,
  "city_avg_pm25_t10": 152,
  "generated_at": "2026-06-13T08:30:00Z"
}
```

---

## 10. File Structure for This Module

```
app/ml/
├── ppo_router.py              # Main PPO agent: predict, recommend, register load
├── ppo_environment.py         # EcoLensRoutingEnv (Gymnasium)
├── ppo_reward.py              # compute_reward function
├── route_generator.py         # NetworkX N-route generation + viability filter
├── route_scorer.py            # EcoScore aggregation across all signals
├── route_forecaster.py        # T+10/20/30 prediction logic
├── load_tracker.py            # Redis load tracking functions
├── signal_fetcher.py          # Pulls from all APIs (OpenAQ, WAQI, Open-Meteo, etc.)
├── signal_normaliser.py       # Normalises all signals to 0-100
├── training/
│   ├── fine_tune.py           # APScheduler fine-tuning job
│   └── collect_samples.py     # Post-trip feedback collection
└── models/
    ├── ppo_route_optimizer_v1.zip
    └── ppo_route_optimizer_v2.zip  # updated after fine-tuning
```

---

## 11. Dependencies to Add to requirements.txt

```
stable-baselines3==2.3.2
gymnasium==0.29.1
redis==5.0.4
torch==2.3.0          # required by stable-baselines3
tensorboard==2.17.0   # for training monitoring
osmnx==1.9.3          # OSM graph + KD-tree nearest node
```

---

## 12. Summary: What Makes This Different

| Feature | Standard Nav (Google Maps) | EcoLens V1 (NetworkX only) | EcoLens V2 (PPO) |
|---|---|---|---|
| Routes returned | 3 fixed types | 3 fixed types | N viable routes |
| Optimisation | Time only | Multi-weight static | Multi-weight + predicted future |
| User load awareness | None | None | Real-time Redis tracking |
| Future prediction | None | None | T+10/20/30 EcoScore forecast |
| Route convergence | Happens | Happens | Actively prevented |
| Learns from outcomes | Never | Never | Every 6 hours |
| Signal sources | Traffic + maps | 6 environmental layers | 10 signals across all APIs |
| Land-only routes | Yes (default) | Yes (OSM) | Yes (viability filter) |