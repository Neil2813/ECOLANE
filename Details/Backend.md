# EcoLens — Backend Specification
**Framework:** FastAPI (Python 3.10+)
**Database:** PostgreSQL + PostGIS
**Auth:** JWT (python-jose) + Argon2 (argon2-cffi)
**ML:** scikit-learn · TensorFlow/Keras · NetworkX · stable-baselines3 (PPO)
**Vision:** Moondream2 via HuggingFace Inference API
**Deployment:** Render.com

---

## Project Structure

```
ecolens-backend/
├── main.py
├── requirements.txt
├── .env
├── app/
│   ├── auth/
│   │   ├── register.py
│   │   ├── login.py
│   │   ├── logout.py
│   │   ├── forgot_password.py
│   │   ├── verify_otp.py
│   │   └── reset_password.py
│   ├── routes/
│   │   ├── generate.py
│   │   └── reroute.py
│   ├── tiles/
│   │   └── environment.py
│   ├── segments/
│   │   └── pollution.py
│   ├── vision/
│   │   └── detect.py
│   ├── exposure/
│   │   └── calculate.py
│   ├── dashboard/
│   │   └── summary.py
│   ├── alerts/
│   │   └── push.py
│   ├── profile/
│   │   ├── get.py
│   │   ├── update.py
│   │   └── delete.py
│   ├── trips/
│   │   ├── history.py
│   │   └── detail.py
│   ├── notifications/
│   │   └── settings.py
│   ├── ml/
│   │   ├── gpr_interpolation.py
│   │   ├── lstm_forecast.py
│   │   ├── ppo_router.py
│   │   ├── carbon_calculator.py
│   │   ├── heat_island.py
│   │   ├── ndvi_processor.py
│   │   └── noise_model.py
│   ├── db/
│   │   ├── connection.py
│   │   └── models.py
│   └── utils/
│       ├── jwt_handler.py
│       ├── argon2_handler.py
│       ├── osm_loader.py
│       ├── geojson_builder.py
│       └── push_handler.py
```

---

## .env File (All Required Variables)

```env
DATABASE_URL=postgresql://user:password@host:5432/ecolens
JWT_SECRET=your_jwt_secret_key_here
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=72
ARGON2_TIME_COST=2
ARGON2_MEMORY_COST=65536
HUGGINGFACE_API_KEY=your_hf_key_here
MOONDREAM_MODEL_URL=https://api-inference.huggingface.co/models/vikhyatk/moondream2
OPENAQ_API_URL=https://api.openaq.org/v2
CPCB_API_URL=https://app.cpcbccr.com/aqi_dashboard/
NOMINATIM_URL=https://nominatim.openstreetmap.org
ERA5_DATA_PATH=./data/era5_latest.nc
OSM_GRAPH_PATH=./data/bengaluru_osm.graphml
WEBPUSH_VAPID_PRIVATE_KEY=your_vapid_private_key
WEBPUSH_VAPID_PUBLIC_KEY=your_vapid_public_key
WEBPUSH_VAPID_EMAIL=mailto:team@ecolens.app
ALLOWED_ORIGINS=http://localhost:3000,https://ecolens.app
```

---

## main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.auth import register, login, logout, forgot_password, verify_otp, reset_password
from app.routes import generate, reroute
from app.tiles import environment
from app.segments import pollution
from app.vision import detect
from app.exposure import calculate
from app.dashboard import summary
from app.alerts import push
from app.profile import get, update, delete
from app.trips import history, detail
from app.notifications import settings

app = FastAPI(title="EcoLens API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth
app.include_router(register.router, prefix="/api/auth", tags=["Auth"])
app.include_router(login.router, prefix="/api/auth", tags=["Auth"])
app.include_router(logout.router, prefix="/api/auth", tags=["Auth"])
app.include_router(forgot_password.router, prefix="/api/auth", tags=["Auth"])
app.include_router(verify_otp.router, prefix="/api/auth", tags=["Auth"])
app.include_router(reset_password.router, prefix="/api/auth", tags=["Auth"])

# Routes
app.include_router(generate.router, prefix="/api/routes", tags=["Routes"])
app.include_router(reroute.router, prefix="/api/routes", tags=["Routes"])

# Environmental Tiles
app.include_router(environment.router, prefix="/api/tiles", tags=["Tiles"])

# Segments
app.include_router(pollution.router, prefix="/api/segments", tags=["Segments"])

# Vision
app.include_router(detect.router, prefix="/api/vision", tags=["Vision"])

# Exposure
app.include_router(calculate.router, prefix="/api/exposure", tags=["Exposure"])

# Dashboard
app.include_router(summary.router, prefix="/api/dashboard", tags=["Dashboard"])

# Alerts
app.include_router(push.router, prefix="/api/alerts", tags=["Alerts"])

# Profile
app.include_router(get.router, prefix="/api/profile", tags=["Profile"])
app.include_router(update.router, prefix="/api/profile", tags=["Profile"])
app.include_router(delete.router, prefix="/api/profile", tags=["Profile"])

# Trips
app.include_router(history.router, prefix="/api/trips", tags=["Trips"])
app.include_router(detail.router, prefix="/api/trips", tags=["Trips"])

# Notifications
app.include_router(settings.router, prefix="/api/notifications", tags=["Notifications"])

@app.get("/")
def root():
    return {"status": "EcoLens API is running"}
```

---

## DATABASE MODELS — app/db/models.py

```python
# PostgreSQL tables (use SQLAlchemy or Alembic migrations)

# users
# - id UUID PRIMARY KEY
# - name VARCHAR(100)
# - email VARCHAR(255) UNIQUE NOT NULL
# - password_hash VARCHAR(255) NOT NULL
# - city VARCHAR(100) DEFAULT 'Chennai'
# - default_route_preference VARCHAR(20) DEFAULT 'cleanest_air'
#   -- values: fastest | cleanest_air | lowest_carbon
# - theme VARCHAR(10) DEFAULT 'dark'
# - push_subscription TEXT (JSON string of Web Push subscription object)
# - notifications_pollution BOOLEAN DEFAULT true
# - notifications_forecast BOOLEAN DEFAULT true
# - notifications_weekly BOOLEAN DEFAULT true
# - created_at TIMESTAMP DEFAULT NOW()
# - updated_at TIMESTAMP DEFAULT NOW()

# otp_tokens
# - id UUID PRIMARY KEY
# - email VARCHAR(255) NOT NULL
# - otp_code VARCHAR(6) NOT NULL
# - expires_at TIMESTAMP NOT NULL
# - used BOOLEAN DEFAULT false

# trips
# - id UUID PRIMARY KEY
# - user_id UUID REFERENCES users(id)
# - origin_lat FLOAT
# - origin_lng FLOAT
# - destination_lat FLOAT
# - destination_lng FLOAT
# - route_type VARCHAR(20)  -- fastest | cleanest_air | lowest_carbon
# - duration_min INTEGER
# - distance_km FLOAT
# - pm25_inhaled FLOAT
# - pm25_avoided FLOAT
# - co2_grams FLOAT
# - ecoscore INTEGER
# - polyline JSONB  -- array of [lat, lng] pairs
# - started_at TIMESTAMP
# - ended_at TIMESTAMP

# daily_exposure
# - id UUID PRIMARY KEY
# - user_id UUID REFERENCES users(id)
# - date DATE
# - total_pm25 FLOAT
# - avoided_pm25 FLOAT
# - total_co2 FLOAT
# - city_avg_co2 FLOAT
# - ecoscore INTEGER
# - heat_exposure FLOAT
# - noise_avg_db FLOAT

# lstm_forecasts
# - id UUID PRIMARY KEY
# - user_id UUID REFERENCES users(id)
# - forecast_date DATE
# - risk_level VARCHAR(10)  -- low | moderate | high
# - recommended_departure VARCHAR(10)
# - recommended_route TEXT
# - predicted_pm25 FLOAT
# - generated_at TIMESTAMP DEFAULT NOW()

# environmental_segments (PostGIS)
# - id UUID PRIMARY KEY
# - segment_id VARCHAR(50) UNIQUE
# - geom GEOMETRY(LINESTRING, 4326)
# - pm25 FLOAT
# - no2 FLOAT
# - carbon_intensity VARCHAR(10)  -- low | medium | high
# - co2_per_min FLOAT
# - ndvi FLOAT
# - noise_db FLOAT
# - heat_anomaly FLOAT
# - ecoscore INTEGER
# - updated_at TIMESTAMP DEFAULT NOW()
```

---

---

# AUTH ENDPOINTS

---

## POST /api/auth/register
**File:** `app/auth/register.py`

**What it does:** Creates a new user account. Hashes password with Argon2. Returns JWT token.

**Request body:**
```json
{
  "name": "Neil Mathias",
  "email": "neil@example.com",
  "password": "SecurePass123",
  "confirm_password": "SecurePass123"
}
```

**Validations:**
- Email must be valid format
- Password minimum 8 characters, at least one number
- confirm_password must match password
- Email must not already exist in users table → 409 Conflict

**Logic:**
1. Validate all fields
2. Check email uniqueness in DB
3. Hash password using Argon2
4. Insert new user row in users table
5. Generate JWT with payload `{ user_id, email, exp }`
6. Return token + user object

**Response 201:**
```json
{
  "token": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "name": "Neil Mathias",
    "email": "neil@example.com",
    "city": "Chennai",
    "theme": "dark",
    "default_route_preference": "cleanest_air"
  }
}
```

**Errors:** 400 (validation), 409 (email exists), 500 (server)

---

## POST /api/auth/login
**File:** `app/auth/login.py`

**What it does:** Authenticates existing user. Verifies Argon2 hash. Returns JWT.

**Request body:**
```json
{
  "email": "neil@example.com",
  "password": "SecurePass123"
}
```

**Logic:**
1. Look up user by email
2. If not found → 401 "Invalid credentials" (do not reveal which field is wrong)
3. Verify password against stored Argon2 hash
4. If mismatch → 401 "Invalid credentials"
5. Generate new JWT
6. Return token + user object

**Response 200:**
```json
{
  "token": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "name": "Neil Mathias",
    "email": "neil@example.com",
    "city": "Chennai",
    "theme": "dark",
    "default_route_preference": "cleanest_air"
  }
}
```

**Errors:** 401 (invalid credentials), 500 (server)

---

## POST /api/auth/logout
**File:** `app/auth/logout.py`

**What it does:** Stateless JWT — logout is handled client-side by deleting the token. This endpoint exists as a formal hook for future token blacklisting.

**Headers:** `Authorization: Bearer {token}`

**Logic:**
1. Validate JWT
2. Log the logout event (optional audit log)
3. Return success

**Response 200:**
```json
{ "message": "Logged out successfully" }
```

---

## POST /api/auth/forgot-password
**File:** `app/auth/forgot_password.py`

**What it does:** Generates a 6-digit OTP, stores it in otp_tokens table with 10-minute expiry, sends it to the user's email.

**Request body:**
```json
{ "email": "neil@example.com" }
```

**Logic:**
1. Check if email exists in users table
2. If not → return 200 anyway (do not leak email existence)
3. Generate random 6-digit OTP
4. Delete any existing unused OTPs for this email
5. Insert new row in otp_tokens: `{ email, otp_code, expires_at: now + 10min }`
6. Send OTP via email (use Python smtplib or SendGrid free tier)
7. Return success

**Response 200:**
```json
{ "message": "If this email exists, an OTP has been sent" }
```

---

## POST /api/auth/verify-otp
**File:** `app/auth/verify_otp.py`

**What it does:** Validates the 6-digit OTP. Returns a short-lived reset token if valid.

**Request body:**
```json
{
  "email": "neil@example.com",
  "otp_code": "482910"
}
```

**Logic:**
1. Look up otp_tokens where email matches AND used = false AND expires_at > NOW()
2. If not found or expired → 400 "Invalid or expired OTP"
3. Compare otp_code
4. If mismatch → 400 "Invalid or expired OTP"
5. Mark OTP as used = true
6. Generate a short-lived reset JWT (15 minute expiry, type: "password_reset")
7. Return reset token

**Response 200:**
```json
{ "reset_token": "eyJhbGci..." }
```

**Errors:** 400 (invalid/expired OTP)

---

## POST /api/auth/reset-password
**File:** `app/auth/reset_password.py`

**What it does:** Accepts the reset token and new password. Updates user's password hash.

**Request body:**
```json
{
  "reset_token": "eyJhbGci...",
  "new_password": "NewSecurePass456",
  "confirm_password": "NewSecurePass456"
}
```

**Logic:**
1. Decode reset_token — verify type is "password_reset" and not expired
2. Validate new_password (min 8 chars, one number)
3. Confirm passwords match
4. Hash new password with Argon2
5. Update users table: set password_hash = new hash, updated_at = NOW()
6. Return success

**Response 200:**
```json
{ "message": "Password updated successfully" }
```

**Errors:** 400 (validation), 401 (invalid reset token), 500

---

---

# ROUTE ENDPOINTS

---

## POST /api/routes/generate
**File:** `app/routes/generate.py`

**What it does:** Core routing engine. Takes origin + destination. Runs NetworkX multi-objective graph search on OSM road network. Returns 3 route objects with full environmental metrics.

**Headers:** `Authorization: Bearer {token}`

**Request body:**
```json
{
  "origin": { "lat": 13.0012, "lng": 80.2565 },
  "destination": { "lat": 13.0569, "lng": 80.2425 }
}
```

**Logic:**
1. Validate coordinates are within supported city bounds
2. Load OSM graph (pre-loaded in memory at startup via `osm_loader.py`)
3. Find nearest OSM nodes to origin and destination using KD-tree nearest neighbour
4. For each road segment edge in the graph, retrieve environmental weights from environmental_segments table (pm25, co2_per_min, heat_anomaly, noise_db, ndvi)
5. Run 3 separate shortest-path searches using NetworkX:
   - **Route 1 Fastest:** edge weight = travel_time only
   - **Route 2 Cleanest Air:** edge weight = (0.6 × pm25_normalised) + (0.2 × time_normalised) + (0.1 × heat_normalised) + (0.1 × noise_normalised)
   - **Route 3 Lowest Carbon:** edge weight = (0.7 × co2_normalised) + (0.3 × time_normalised)
6. For each route, sum up: total PM2.5 exposure (pm25 × time_on_segment), total CO2, total time, total distance
7. Calculate EcoScore for each route:
   - EcoScore = 100 − (0.4 × pm25_score + 0.3 × carbon_score + 0.2 × heat_score + 0.1 × noise_score)
   - Where each score is normalised 0–100 relative to city average
8. Run PPO model (ppo_router.py) to validate and optionally adjust route 2 and 3 recommendations
9. Return all 3 route objects

**Response 200:**
```json
[
  {
    "type": "fastest",
    "label": "Fastest",
    "duration_min": 14,
    "distance_km": 3.2,
    "pm25_exposure": 340,
    "co2_grams": 180,
    "heat_score": 65,
    "noise_db": 71,
    "ecoscore": 42,
    "polyline": [[13.001, 80.256], [13.003, 80.258], "..."],
    "segment_ids": ["seg_001", "seg_002", "..."],
    "recommended": false
  },
  {
    "type": "cleanest_air",
    "label": "Cleanest Air",
    "duration_min": 17,
    "distance_km": 3.8,
    "pm25_exposure": 110,
    "co2_grams": 180,
    "heat_score": 30,
    "noise_db": 48,
    "ecoscore": 87,
    "polyline": [...],
    "segment_ids": [...],
    "recommended": true
  },
  {
    "type": "lowest_carbon",
    "label": "Lowest Carbon",
    "duration_min": 16,
    "distance_km": 3.5,
    "pm25_exposure": 210,
    "co2_grams": 60,
    "heat_score": 50,
    "noise_db": 55,
    "ecoscore": 71,
    "polyline": [...],
    "segment_ids": [...],
    "recommended": false
  }
]
```

**Errors:** 400 (invalid coords), 422 (outside city bounds), 500

---

## POST /api/routes/reroute
**File:** `app/routes/reroute.py`

**What it does:** Called during active navigation when user goes off-route OR pollution spikes ahead. Returns a single new optimal route from current position to original destination.

**Headers:** `Authorization: Bearer {token}`

**Request body:**
```json
{
  "current_position": { "lat": 13.0201, "lng": 80.2488 },
  "destination": { "lat": 13.0569, "lng": 80.2425 },
  "original_route_type": "cleanest_air",
  "reason": "off_route"
}
```

**reason values:** `off_route` | `pollution_spike` | `user_requested`

**Logic:**
1. Same as /generate but returns only ONE route
2. Uses original_route_type preference to determine weighting
3. If reason is pollution_spike: temporarily penalise the next 500m of original route segments by multiplying their pm25 weight by 3
4. Return single best route

**Response 200:**
```json
{
  "type": "cleanest_air",
  "duration_min": 12,
  "distance_km": 2.1,
  "pm25_exposure": 95,
  "co2_grams": 140,
  "ecoscore": 81,
  "polyline": [...],
  "segment_ids": [...],
  "reroute_reason": "off_route"
}
```

---

---

# TILES ENDPOINT

---

## GET /api/tiles/environment
**File:** `app/tiles/environment.py`

**What it does:** Returns GeoJSON of all road segments within the requested bounding box with their live environmental values. This is what paints the map overlay.

**Headers:** `Authorization: Bearer {token}`

**Query params:**
```
?bbox=80.23,12.99,80.28,13.05
  -- format: min_lng,min_lat,max_lng,max_lat
?layers=pm25,carbon,heat,ndvi,noise
  -- comma separated, all returned if omitted
```

**Logic:**
1. Parse bbox into PostGIS geometry
2. Query environmental_segments WHERE geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
3. Filter columns based on layers param
4. Build GeoJSON FeatureCollection
5. Return

**Response 200:**
```json
{
  "type": "FeatureCollection",
  "updated_at": "2026-06-13T08:30:00Z",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[80.2565, 13.0012], [80.2570, 13.0020]]
      },
      "properties": {
        "segment_id": "seg_4821",
        "pm25": 88.4,
        "no2": 34.1,
        "carbon_intensity": "high",
        "co2_per_min": 4.2,
        "ndvi": 0.42,
        "noise_db": 67,
        "heat_anomaly": 2.3,
        "ecoscore": 54
      }
    }
  ]
}
```

**Cache:** Response cached for 30 seconds per bbox. Uses Redis or in-memory dict with TTL.

**Errors:** 400 (invalid bbox), 401 (no token)

---

---

# SEGMENTS ENDPOINT

---

## GET /api/segments/pollution
**File:** `app/segments/pollution.py`

**What it does:** Returns current pollution values for a specific list of segment IDs. Called every 60 seconds during active navigation to monitor upcoming route pollution.

**Headers:** `Authorization: Bearer {token}`

**Query params:**
```
?segment_ids=seg_001,seg_002,seg_003,seg_004,seg_005
```

**Logic:**
1. Parse segment_ids list
2. Query environmental_segments WHERE segment_id IN (list)
3. Check if any segment has pm25 > 150 → flag as spike
4. Return values + spike flag

**Response 200:**
```json
{
  "segments": [
    { "segment_id": "seg_001", "pm25": 88, "no2": 30, "carbon_intensity": "medium" },
    { "segment_id": "seg_002", "pm25": 188, "no2": 65, "carbon_intensity": "high" }
  ],
  "pollution_spike_detected": true,
  "spike_segment_id": "seg_002",
  "spike_pm25": 188
}
```

---

---

# VISION ENDPOINT

---

## POST /api/vision/detect
**File:** `app/vision/detect.py`

**What it does:** Receives a base64 JPEG frame from the AR camera. Forwards it to Moondream2 on HuggingFace. Returns vehicle types and emission categories to render AR bubbles.

**Headers:** `Authorization: Bearer {token}`

**Request body:**
```json
{
  "image_base64": "/9j/4AAQSkZJRgAB...",
  "user_lat": 13.0201,
  "user_lng": 80.2488
}
```

**Logic:**
1. Decode base64 to bytes
2. Validate image size < 200kb (reject and return empty if larger)
3. Send to HuggingFace Inference API:
```python
headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
payload = {
  "inputs": {
    "image": image_base64,
    "question": "List all vehicle types visible in this image. For each vehicle, classify its emission level as low, medium, or high. Format: vehicle_type:emission_level, one per line."
  }
}
response = requests.post(MOONDREAM_MODEL_URL, headers=headers, json=payload)
```
4. Parse response text into structured list
5. Map emission levels to colours: low → green, medium → orange, high → red
6. Return structured vehicle detections

**Response 200:**
```json
{
  "detections": [
    { "vehicle_type": "auto_rickshaw", "emission_level": "medium", "colour": "#F97316" },
    { "vehicle_type": "bus", "emission_level": "high", "colour": "#EF4444" },
    { "vehicle_type": "bicycle", "emission_level": "low", "colour": "#22C55E" }
  ],
  "dominant_emission": "high",
  "local_pm25_adjustment": +12.4
}
```

**local_pm25_adjustment:** Additional µg/m³ estimated from detected vehicles beyond baseline segment data.

**Errors:** 400 (image too large), 503 (HuggingFace unavailable → return empty detections, do not crash AR)

---

---

# EXPOSURE ENDPOINT

---

## POST /api/exposure/calculate
**File:** `app/exposure/calculate.py`

**What it does:** Called when a trip ends. Calculates actual PM2.5 inhaled, CO2 emitted, and updates the user's daily_exposure record. Also calculates how much pollution was avoided vs the fastest route.

**Headers:** `Authorization: Bearer {token}`

**Request body:**
```json
{
  "trip": {
    "origin": { "lat": 13.0012, "lng": 80.2565 },
    "destination": { "lat": 13.0569, "lng": 80.2425 },
    "route_type": "cleanest_air",
    "segment_ids": ["seg_001", "seg_002", "..."],
    "segment_durations_sec": [45, 60, "..."],
    "started_at": "2026-06-13T08:15:00Z",
    "ended_at": "2026-06-13T08:32:00Z"
  }
}
```

**Logic:**
1. For each segment_id, get pm25 value from environmental_segments
2. Calculate exposure: `pm25_inhaled += segment.pm25 × (duration_sec / 60)`
3. Calculate CO2: `co2_grams += segment.co2_per_min × (duration_sec / 60)`
4. Fetch fastest route for same origin→destination (call internal route generator)
5. Calculate fastest route pm25 the same way
6. `pm25_avoided = fastest_route_pm25 - actual_pm25_inhaled`
7. Calculate EcoScore for this trip
8. Insert row in trips table
9. Upsert row in daily_exposure table for today:
   - If row exists: add to totals
   - If new: create with today's values
10. Return trip summary

**Response 201:**
```json
{
  "trip_id": "uuid",
  "pm25_inhaled": 110,
  "pm25_avoided": 230,
  "co2_grams": 180,
  "duration_min": 17,
  "distance_km": 3.8,
  "ecoscore": 87,
  "badge_earned": "clean_commuter"
}
```

**badge_earned:** null or one of: `clean_commuter` | `pollution_avoider` | `carbon_saver` | `eco_warrior`
Badge logic: if pm25_avoided > 200 → pollution_avoider. If co2_grams < 100 → carbon_saver. If ecoscore > 85 → clean_commuter. All three → eco_warrior.

---

---

# DASHBOARD ENDPOINT

---

## GET /api/dashboard/summary
**File:** `app/dashboard/summary.py`

**What it does:** Returns everything the Dashboard tab needs in one call. Today's exposure, weekly trend, LSTM forecast, EcoScore history, badges.

**Headers:** `Authorization: Bearer {token}`

**Query params:**
```
?date=2026-06-13
```

**Logic:**
1. Get today's daily_exposure row for user
2. Get last 7 days of daily_exposure rows for trend
3. Get latest lstm_forecast row for tomorrow's date
4. Get last 7 days of ecoscore from daily_exposure
5. Get all trip rows for today (for trip count)
6. Calculate city average CO2 for today (average across all users in same city)
7. Compile badges earned all-time from trips table
8. Return combined object

**Response 200:**
```json
{
  "today": {
    "date": "2026-06-13",
    "pm25_inhaled": 340,
    "pm25_avoided": 430,
    "co2_grams": 210,
    "city_avg_co2": 350,
    "co2_vs_avg_percent": -40,
    "ecoscore": 74,
    "heat_exposure": 1.8,
    "noise_avg_db": 58,
    "trips_today": 2
  },
  "weekly_trend": [
    { "date": "2026-06-07", "pm25": 520, "ecoscore": 62 },
    { "date": "2026-06-08", "pm25": 480, "ecoscore": 65 },
    { "date": "2026-06-09", "pm25": 390, "ecoscore": 70 },
    { "date": "2026-06-10", "pm25": 410, "ecoscore": 68 },
    { "date": "2026-06-11", "pm25": 340, "ecoscore": 74 },
    { "date": "2026-06-12", "pm25": 360, "ecoscore": 71 },
    { "date": "2026-06-13", "pm25": 340, "ecoscore": 74 }
  ],
  "forecast": {
    "forecast_date": "2026-06-14",
    "risk_level": "high",
    "recommended_departure": "07:45",
    "recommended_route": "Residency Road corridor",
    "predicted_pm25": 580,
    "reason": "Forecasted northeast wind shift increases diesel particulate concentration on Anna Salai corridor"
  },
  "ecoscore_history": [62, 65, 70, 68, 74, 71, 74],
  "badges": [
    { "id": "clean_commuter", "label": "Clean Commuter", "earned_at": "2026-06-11" },
    { "id": "pollution_avoider", "label": "Pollution Avoider", "earned_at": "2026-06-13" }
  ]
}
```

---

---

# ALERTS ENDPOINT

---

## POST /api/alerts/subscribe
**File:** `app/alerts/push.py`

**What it does:** Stores the browser Web Push subscription object against the user. Used to send push notifications when pollution spikes near their saved locations.

**Headers:** `Authorization: Bearer {token}`

**Request body:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "BNcRd...",
      "auth": "tBHI..."
    }
  }
}
```

**Logic:**
1. Validate JWT
2. Serialise subscription object to JSON string
3. Update users table: set push_subscription = subscription JSON
4. Return success

**Response 200:**
```json
{ "message": "Push subscription saved" }
```

---

## POST /api/alerts/trigger (Internal — called by background scheduler)
**File:** `app/alerts/push.py`

**What it does:** Background job (runs every 5 minutes via APScheduler). Checks if any user's home/work area has pollution spike. Sends Web Push notification.

**Logic:**
1. Get all users with push_subscription not null
2. For each user, get their city
3. Check environmental_segments for segments near their last known location
4. If any segment pm25 > 150: send push notification via pywebpush:
```python
webpush(
  subscription_info=subscription,
  data=json.dumps({
    "title": "⚠ High Pollution Alert",
    "body": "PM2.5 near you is 3× safe limit. EcoLens found a cleaner route.",
    "icon": "/icons/alert-orange.png"
  }),
  vapid_private_key=VAPID_PRIVATE_KEY,
  vapid_claims={"sub": VAPID_EMAIL}
)
```

---

---

# PROFILE ENDPOINTS

---

## GET /api/profile
**File:** `app/profile/get.py`

**What it does:** Returns the authenticated user's full profile.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Neil Mathias",
  "email": "neil@example.com",
  "city": "Chennai",
  "default_route_preference": "cleanest_air",
  "theme": "dark",
  "notifications": {
    "pollution_alerts": true,
    "forecast_reminders": true,
    "weekly_summary": true
  }
}
```

---

## PATCH /api/profile
**File:** `app/profile/update.py`

**What it does:** Updates user profile fields. All fields optional — only provided fields are updated.

**Headers:** `Authorization: Bearer {token}`

**Request body (all optional):**
```json
{
  "name": "Neil Emmanuel Mathias",
  "city": "Bengaluru",
  "default_route_preference": "lowest_carbon",
  "theme": "light"
}
```

**Logic:**
1. Validate JWT
2. Build UPDATE query with only provided fields
3. Set updated_at = NOW()
4. Return updated profile

**Response 200:** Same as GET /api/profile

---

## DELETE /api/profile
**File:** `app/profile/delete.py`

**What it does:** Permanently deletes user account and all associated data (trips, exposure, forecasts). GDPR-compliant.

**Headers:** `Authorization: Bearer {token}`

**Request body:**
```json
{ "confirm_password": "SecurePass123" }
```

**Logic:**
1. Validate JWT
2. Verify password against stored hash
3. Delete in order: lstm_forecasts → daily_exposure → trips → otp_tokens → users
4. Return success

**Response 200:**
```json
{ "message": "Account permanently deleted" }
```

---

---

# TRIPS ENDPOINTS

---

## GET /api/trips/history
**File:** `app/trips/history.py`

**What it does:** Returns paginated list of user's past trips.

**Headers:** `Authorization: Bearer {token}`

**Query params:**
```
?page=1&limit=20&filter=this_week
```
filter values: `all` | `this_week` | `this_month`

**Response 200:**
```json
{
  "trips": [
    {
      "id": "uuid",
      "route_type": "cleanest_air",
      "started_at": "2026-06-13T08:15:00Z",
      "duration_min": 17,
      "distance_km": 3.8,
      "pm25_inhaled": 110,
      "pm25_avoided": 230,
      "co2_grams": 180,
      "ecoscore": 87
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

## GET /api/trips/{trip_id}
**File:** `app/trips/detail.py`

**What it does:** Returns full detail of a single trip including polyline for map replay.

**Headers:** `Authorization: Bearer {token}`

**Response 200:**
```json
{
  "id": "uuid",
  "origin": { "lat": 13.0012, "lng": 80.2565 },
  "destination": { "lat": 13.0569, "lng": 80.2425 },
  "route_type": "cleanest_air",
  "started_at": "2026-06-13T08:15:00Z",
  "ended_at": "2026-06-13T08:32:00Z",
  "duration_min": 17,
  "distance_km": 3.8,
  "pm25_inhaled": 110,
  "pm25_avoided": 230,
  "co2_grams": 180,
  "heat_exposure": 1.2,
  "noise_avg_db": 48,
  "ecoscore": 87,
  "polyline": [[13.001, 80.256], "..."],
  "vs_fastest": {
    "pm25_fastest": 340,
    "pm25_reduction_percent": 67,
    "co2_fastest": 180,
    "time_added_min": 3
  }
}
```

**Errors:** 404 (trip not found or belongs to different user)

---

---

# NOTIFICATIONS ENDPOINT

---

## PATCH /api/notifications/settings
**File:** `app/notifications/settings.py`

**What it does:** Updates the user's notification preferences.

**Headers:** `Authorization: Bearer {token}`

**Request body:**
```json
{
  "pollution_alerts": true,
  "forecast_reminders": false,
  "weekly_summary": true,
  "reroute_suggestions": true,
  "daily_report": true
}
```

**Logic:**
1. Validate JWT
2. Update users table notification columns
3. Return updated settings

**Response 200:**
```json
{
  "pollution_alerts": true,
  "forecast_reminders": false,
  "weekly_summary": true,
  "reroute_suggestions": true,
  "daily_report": true
}
```

---

---

# ML MODULES (Internal — not direct API endpoints)

---

## app/ml/gpr_interpolation.py

**What it does:** Fetches latest air quality readings from OpenAQ + CPCB. Runs Gaussian Process Regression to produce a continuous PM2.5 + NO2 surface. Updates environmental_segments table.

**Called by:** Background scheduler every 30 minutes

```python
# Key logic:
# 1. Fetch readings from OpenAQ API: GET /v2/measurements?city=Chennai&parameter=pm25&limit=100
# 2. Fetch from CPCB portal (scrape or API if available)
# 3. Compile list of (lat, lng, pm25_value) tuples — typically 12-20 points
# 4. Fit GPR:
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel
kernel = RBF(length_scale=0.05) + WhiteKernel(noise_level=1)
gpr = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=5)
gpr.fit(X_train, y_train)  # X = [[lat,lng],...], y = [pm25,...]
# 5. Predict pm25 for every road segment centroid in environmental_segments
# 6. Batch UPDATE environmental_segments SET pm25 = predicted_value WHERE segment_id = ...
```

---

## app/ml/lstm_forecast.py

**What it does:** Nightly job. For each active user, predicts tomorrow's pollution exposure on their usual route using LSTM trained on historical exposure + ERA5 weather data.

**Called by:** Background scheduler at 23:00 daily

```python
# Key logic:
# 1. Load user's last 30 days of daily_exposure + trip patterns
# 2. Load ERA5 wind/humidity forecast for tomorrow
# 3. Feed sequence to LSTM:
from tensorflow.keras.models import load_model
model = load_model('./models/lstm_exposure_forecast.h5')
# Input shape: (1, 30, features) where features = [pm25, wind_speed, wind_dir, humidity, day_of_week]
# Output: predicted_pm25 for tomorrow on user's usual route
# 4. Determine risk_level: < 150 = low, 150-300 = moderate, > 300 = high
# 5. Determine recommended_departure based on hourly forecast minimum
# 6. Upsert lstm_forecasts table
```

---

## app/ml/ppo_router.py

**What it does:** PPO-based reinforcement learning model that validates and adjusts route recommendations. Trained to optimise for minimum cumulative exposure while keeping travel time within 25% of fastest route.

**Called by:** /api/routes/generate after NetworkX produces candidates

```python
# Key logic:
# State: [current_segment_pm25, current_segment_co2, time_remaining_ratio, exposure_so_far]
# Action: continue_on_route | switch_to_alternative_segment
# Reward: -pm25_inhaled - (0.3 × co2_emitted) + (5 × if_arrived_within_time_budget)
# Model: stable_baselines3 PPO
from stable_baselines3 import PPO
model = PPO.load('./models/ppo_route_optimizer')
# For each candidate route, run model to get approval score
# If cleanest_air route score < fastest route score by PPO: swap recommendation
```

---

## app/ml/carbon_calculator.py

**What it does:** Calculates CO2 equivalent per road segment per minute from live traffic density × vehicle mix × MoRTH emission factors.

```python
# MoRTH emission factors (g CO2/km):
EMISSION_FACTORS = {
  "two_wheeler": 45,
  "auto_rickshaw": 78,
  "car_petrol": 120,
  "car_diesel": 135,
  "bus": 850,
  "truck": 1100
}
# Vehicle mix assumptions per road class (from MoRTH annual report):
VEHICLE_MIX = {
  "residential": {"two_wheeler": 0.45, "car_petrol": 0.30, "auto_rickshaw": 0.20, "bus": 0.05},
  "arterial": {"two_wheeler": 0.30, "car_petrol": 0.35, "car_diesel": 0.10, "bus": 0.15, "truck": 0.10},
  "highway": {"car_petrol": 0.25, "car_diesel": 0.20, "bus": 0.20, "truck": 0.35}
}
# co2_per_min = sum(factor × mix_ratio × traffic_density_multiplier) / avg_speed_kmh
```

---

## app/ml/heat_island.py

**What it does:** Loads Landsat 8 thermal band data. Calculates surface temperature anomaly per city block. Updates heat_anomaly values in environmental_segments.

**Called by:** Background scheduler weekly (Landsat updates every 8 days)

```python
# Uses rasterio to read Landsat 8 Band 10 (thermal infrared)
# Converts raw DN to surface temperature in Celsius
# Calculates anomaly = local_temp - city_mean_temp
# Spatially joins to road segments using PostGIS ST_Within
```

---

## app/ml/ndvi_processor.py

**What it does:** Loads Sentinel-2 Band 4 (Red) and Band 8 (NIR). Calculates NDVI per 10m pixel. Aggregates to road segment level.

**Called by:** Background scheduler every 10 days

```python
# NDVI = (NIR - Red) / (NIR + Red)
# Range: -1 to 1. > 0.3 = good vegetation. < 0.1 = bare/concrete
# Uses rasterio + numpy
# Spatial join to segments via PostGIS
```

---

## app/ml/noise_model.py

**What it does:** Models noise level per road segment using traffic density, road class, and building canyon geometry. No microphones needed.

```python
# WHO acoustic propagation formula (simplified):
# L_eq = L_base + 10*log10(traffic_flow) - 20*log10(distance) + canyon_factor
# canyon_factor: +3dB for streets with buildings both sides, 0 for open
# L_base by road class: highway=75dB, arterial=68dB, residential=58dB
```

---

---

# BACKGROUND SCHEDULER (APScheduler)

Add to main.py:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def start_scheduler():
    scheduler.add_job(gpr_interpolation.run, 'interval', minutes=30)
    scheduler.add_job(carbon_calculator.run, 'interval', minutes=30)
    scheduler.add_job(lstm_forecast.run, 'cron', hour=23, minute=0)
    scheduler.add_job(heat_island.run, 'interval', days=8)
    scheduler.add_job(ndvi_processor.run, 'interval', days=10)
    scheduler.add_job(push_handler.check_and_notify, 'interval', minutes=5)
    scheduler.start()
```

---

# REQUIREMENTS.TXT

```
fastapi==0.111.0
uvicorn==0.30.0
python-jose==3.3.0
argon2-cffi==23.1.0
sqlalchemy==2.0.30
psycopg2-binary==2.9.9
geoalchemy2==0.15.1
networkx==3.3
scikit-learn==1.5.0
tensorflow==2.16.1
stable-baselines3==2.3.2
numpy==1.26.4
pandas==2.2.2
requests==2.32.3
rasterio==1.3.10
pywebpush==2.0.0
apscheduler==3.10.4
python-multipart==0.0.9
pydantic==2.7.1
python-dotenv==1.0.1
osmnx==1.9.3
```

---

# ENDPOINT SUMMARY TABLE

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Create account |
| POST | /api/auth/login | No | Sign in |
| POST | /api/auth/logout | Yes | Sign out |
| POST | /api/auth/forgot-password | No | Request OTP |
| POST | /api/auth/verify-otp | No | Validate OTP |
| POST | /api/auth/reset-password | No | Set new password |
| POST | /api/routes/generate | Yes | Get 3 routes |
| POST | /api/routes/reroute | Yes | Get rerouted route |
| GET | /api/tiles/environment | Yes | Map overlay GeoJSON |
| GET | /api/segments/pollution | Yes | Segment pollution check |
| POST | /api/vision/detect | Yes | AR vehicle detection |
| POST | /api/exposure/calculate | Yes | End-of-trip calculation |
| GET | /api/dashboard/summary | Yes | Full dashboard data |
| POST | /api/alerts/subscribe | Yes | Save push subscription |
| GET | /api/profile | Yes | Get profile |
| PATCH | /api/profile | Yes | Update profile |
| DELETE | /api/profile | Yes | Delete account |
| GET | /api/trips/history | Yes | Trip list |
| GET | /api/trips/{id} | Yes | Trip detail |
| PATCH | /api/notifications/settings | Yes | Update notification prefs |