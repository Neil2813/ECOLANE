# EcoLens — Product Requirements Document (PRD)
**Version:** 1.0
**Team:** CDXB003 — Neil Emmanuel Mathias · Ancilla Teresa Dsouza
**Competition:** CODEX 2026 · Don Bosco College, Bengaluru
**Date:** June 2026
**Theme:** SDG 11 · SDG 13 — AI Solutions for a Sustainable Future

---

## 1. Product Overview

### 1.1 Product Vision
EcoLens is the environmental intelligence layer for urban navigation. Where existing navigation apps show you the city as roads, EcoLens shows you the city as it actually is — a living map of air quality, carbon intensity, urban heat, noise, and green cover — and finds you the path through it that does not cost you your health or the planet its future.

### 1.2 Problem Being Solved
Urban commuters in India navigate daily through streets with invisible health hazards. PM2.5 levels in Chennai and Bengaluru run 4–6× above WHO safe limits. A Harvard Chan School study found commuters inhale 3.5× more PM2.5 on congested routes versus optimised ones — same city, same destination. No navigation product accounts for this. Google Maps optimises for your clock, not your lungs.

Simultaneously, three institutional buyers have unmet data needs that no product currently fills:
- Municipalities need street-level pollution data for Supreme Court NCAP compliance
- Listed companies need Scope 3 commute emissions data under SEBI's BRSR mandate
- Health insurers need verified behavioural wellness data to power premium discount programs

### 1.3 Product Tagline
*"The city has always been talking. You just couldn't hear it."*

### 1.4 SDG Alignment
- **SDG 11 — Sustainable Cities and Communities:** Reduces urban pollution exposure through intelligent navigation and provides cities with environmental compliance data
- **SDG 13 — Climate Action:** Reduces commute carbon footprint through lowest-carbon route recommendations and corporate Scope 3 reporting

---

## 2. Target Users

### 2.1 Primary User — Urban Commuter
**Who:** Daily commuters in Indian metro cities aged 18–45. Students, working professionals, daily wage earners who travel the same or varied routes regularly.

**Pain:** No visibility into the environmental quality of their route. No tool to compare health cost of navigation choices. No personal environmental health record.

**Goal:** Get from A to B while minimising damage to their health and contributing less to urban carbon load.

**Key behaviour:** Checks navigation before leaving. Makes route decisions in under 30 seconds. Uses the phone camera constantly.

### 2.2 Secondary User — Health-Conscious Commuter
**Who:** Pregnant women, elderly, parents of young children, people with respiratory conditions (asthma, COPD).

**Pain:** Existing health risks amplified by unavoidable pollution exposure. No tool to plan low-exposure commutes.

**Goal:** Evidence-based daily route decisions that protect themselves and dependents.

### 2.3 Institutional Buyers (Non-app users — API/dashboard consumers)

| Buyer | Need | Value from EcoLens |
|---|---|---|
| Municipal Corporation (B2G) | NCAP compliance data, street-level AQI reporting | Live hyperlocal pollution surface via API |
| Listed Enterprise (B2B) | BRSR Scope 3 commute emissions report | GPS-verified aggregate commute carbon data |
| Health Insurer (B2B2C) | Verified healthy behaviour data for wellness programs | Route-level pollution avoidance evidence per opted-in user |

---

## 3. Core User Stories

### 3.1 Must-Have (P0)

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-01 | Commuter | See live pollution levels overlaid on the map around me | I know which streets are safe before I step onto them |
| US-02 | Commuter | Get three route options — Fastest, Cleanest Air, Lowest Carbon — with the exact PM2.5, CO2, and time trade-off shown | I can make an informed choice, not just the fastest one |
| US-03 | Commuter | Navigate turn-by-turn on my chosen route | I can follow the cleanest path without constantly checking the map |
| US-04 | Commuter | See a real-time AR overlay on my camera showing pollution hotspots and clean air corridors on the actual street ahead | The invisible becomes visible in the world around me |
| US-05 | Commuter | View my daily pollution intake and carbon footprint after each trip | I can track my personal environmental health over time |
| US-06 | Commuter | Receive an alert when pollution spikes near me during navigation with an alternative route offered | I am never caught in a pollution event without a way out |

### 3.2 Should-Have (P1)

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-07 | Commuter | Get a forecast of tomorrow's pollution on my usual route every morning | I can plan proactively, not reactively |
| US-08 | Commuter | See my weekly and monthly exposure trends on a dashboard | I can see whether my choices are improving my environmental health over time |
| US-09 | Commuter | Earn badges for consistent clean commuting | I feel recognised for making sustainable choices |
| US-10 | Commuter | Toggle individual environmental layers on the map (air, heat, noise, green cover) | I can focus on the metric that matters most to me |
| US-11 | Commuter | Switch between dark and light mode | I can use the app comfortably in any lighting condition |

### 3.3 Nice-to-Have (P2)

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-12 | Commuter | Share my trip EcoScore summary as an image | I can advocate for cleaner commuting among my network |
| US-13 | Enterprise HR | Access an aggregate dashboard of employee commute carbon for BRSR reporting | I can submit our Scope 3 report without manual travel diaries |
| US-14 | Municipal officer | Access a city-level pollution API with street-segment granularity | I can meet NCAP reporting obligations at a fraction of sensor infrastructure cost |

---

## 4. Features and Requirements

### 4.1 Feature 1 — Environmental Map

**Description:** Full-screen interactive map (Leaflet.js) with six live environmental overlays colour-coded by intensity. Refreshes every 30 seconds.

**Layers:**
1. Air Quality (PM2.5, NO2) — Red/Orange/Green polylines per segment
2. Carbon Intensity — Blue gradient
3. Urban Heat Island — Orange-red heat zones
4. Green Cover (NDVI) — Green density overlay
5. Noise Pollution — Purple gradient
6. Personal Exposure Path — White trace of user's historical routes

**Acceptance criteria:**
- Map loads within 1 second on 4G
- All 6 layers individually toggleable via bottom sheet
- Colour legend always visible (floating bottom-left card)
- User location shown as pulsing green dot updated every 5 seconds
- Long-press on any map point shows environmental reading popup

---

### 4.2 Feature 2 — Multi-Objective Route Engine

**Description:** Takes origin and destination. Returns exactly 3 routes with full environmental metrics. Each route scored with EcoScore (0–100).

**Three routes always returned:**
- Fastest — minimises travel time only
- Cleanest Air — minimises PM2.5 exposure (weighted: 60% PM2.5, 20% time, 10% heat, 10% noise)
- Lowest Carbon — minimises CO2 equivalent (weighted: 70% CO2, 30% time)

**Route card shows:**
- Duration (minutes)
- Distance (km)
- PM2.5 exposure (µg)
- CO2 emitted (grams)
- EcoScore badge (colour: red <50, orange 50–70, green >70)
- "Recommended" label on highest EcoScore route

**Acceptance criteria:**
- Routes returned within 3 seconds of destination selection
- All 3 routes drawn simultaneously on map (grey/green/blue polylines)
- Tapping a card selects it and highlights it with green border
- Start Navigation button activates for selected route

---

### 4.3 Feature 3 — Turn-by-Turn Navigation

**Description:** Active navigation mode following selected route. Real-time position tracking. Off-route detection. Live pollution monitoring of upcoming segments.

**Behaviour:**
- Top card shows current instruction: direction arrow + street name + distance to next turn
- Bottom strip shows: ETA, distance remaining, current PM2.5 (live, colour coded), cumulative exposure bar
- Off-route detection: user >40m from route for >10 seconds → auto reroute call
- Pollution spike detection: PM2.5 >150µg on upcoming 500m → reroute toast appears
- Arrival: auto-triggers trip summary screen

**Acceptance criteria:**
- Instructions update within 2 seconds of passing each waypoint
- Off-route detection triggers within 10 seconds
- Reroute toast shows Accept/Dismiss — Accept fetches new route within 3 seconds
- Bottom nav hidden during active navigation (immersive mode)

---

### 4.4 Feature 4 — AR Environmental Overlay

**Description:** Camera mode using WebXR + Three.js. Overlays real-time environmental data on the physical street in front of the user. Moondream2 detects vehicles and adds live emission bubbles.

**AR elements:**
- Road surface tinting: red (PM2.5 >120) / orange (60–120) / green (<60)
- Floating building badges: "Carbon: High · diesel generator running" (orange)
- Navigation path: white glowing line on road surface
- Vehicle emission bubbles: coloured halos around detected high-emission vehicles (fade after 3s)
- Top HUD: current AQI · PM2.5 · CO2 level
- Bottom HUD: next turn instruction if navigating

**Acceptance criteria:**
- AR session starts within 2 seconds of tab tap (camera permission already granted)
- Road surface overlay updates within 200ms
- Moondream2 frame sent every 2 seconds — detection results appear within 1.5 seconds
- Graceful fallback if Moondream2 API unavailable: overlay persists from cached data, no crash

---

### 4.5 Feature 5 — Personal Exposure Dashboard

**Description:** Daily, weekly, and forecast view of the user's personal environmental health metrics.

**Sections:**
- Today's Exposure: PM2.5 inhaled, PM2.5 avoided, CO2 emitted vs city average, EcoScore
- LSTM Forecast: Tomorrow's risk level, recommended departure time, reason
- Weekly Trend: 7-day bar chart (PM2.5 and EcoScore)
- EcoScore History: 30-day line chart
- Badges: earned milestone badges with dates

**Acceptance criteria:**
- Dashboard loads from single API call in <2 seconds
- Exposure numbers update immediately after each trip ends
- LSTM forecast generated nightly and available by 6am next day
- All charts render without external charting library (Recharts or Chart.js acceptable)

---

### 4.6 Feature 6 — Push Alerts

**Description:** Server-triggered Web Push notifications when pollution spikes near the user's location. Works even when app is closed.

**Trigger conditions:**
- PM2.5 >150µg on any segment within 500m of user's last known location
- High-risk forecast for tomorrow's route
- Weekly EcoScore summary (Sunday evening)

**Acceptance criteria:**
- Notification appears within 5 minutes of trigger condition being met
- Tapping notification deep-links to relevant screen (Map for spike alert, Forecast for risk alert)
- User can granularly toggle each notification type in settings

---

### 4.7 Feature 7 — Auth and Profile

**Description:** JWT-based auth. Argon2 password hashing. Full profile management including theme, route preference, city, notification settings, and account deletion.

**Acceptance criteria:**
- Registration and login complete in <2 seconds
- Forgot password OTP expires in 10 minutes
- Account deletion removes all user data from all tables within 60 seconds
- Theme toggle switches all colours instantly without page reload

---

## 5. Non-Goals (Explicitly Out of Scope for V1)

- Real-time traffic routing (not a traffic app — environmental data only)
- Public transit schedules or timetables
- Paid subscription tiers for consumers
- Multi-city support beyond Chennai and Bengaluru
- Social features (friends, leaderboards, group challenges)
- Voice input for destination search
- Offline map download

---

## 6. Success Metrics (KPIs)

| KPI | Target | Measurement Method |
|---|---|---|
| Air quality interpolation accuracy | Within 12% of ground-truth CPCB readings at held-out validation points | GPR validation on withheld sensor data |
| Route PM2.5 reduction | 35–55% lower exposure on Cleanest Air vs Fastest route | Calculated per trip in exposure engine |
| Carbon model accuracy | Within 18% of MoRTH published road segment emission inventories | Comparison against TERI reference data |
| AR overlay render latency | <200ms | Measured via browser performance API |
| LSTM forecast accuracy | Within 15% of actual exposure for 80% of predictions | Post-hoc comparison of forecast vs measured |
| Route generation time | <3 seconds | API response time logging |
| Map tile load time | <1 second on 4G | Lighthouse performance audit |
| Push notification delivery | <5 minutes from trigger | Server log timestamp vs delivery receipt |

---

## 7. Business Model

### 7.1 Revenue Streams

**B2G — Municipal Environmental Intelligence**
- Customer: Municipal corporations (BBMP, Chennai Corporation, GHMC)
- Offering: Street-level environmental intelligence API and compliance dashboard
- Pricing: ₹20–35 lakh per city per year
- Year 1 target: 2 cities → ₹40–70 lakh
- Year 2 target: 10 cities → ₹2–3.5 crore ARR

**B2B — Corporate Scope 3 Carbon Reporting**
- Customer: SEBI-listed enterprises (1,400 companies legally mandated under BRSR)
- Offering: GPS-verified aggregate commute carbon reporting dashboard for HR/ESG teams
- Pricing: ₹400–600 per employee per year
- Year 1 target: 5 enterprises → ₹80 lakh–1.2 crore
- Year 2 target: 20 enterprises → ₹4–6 crore ARR

**B2B2C — Health Insurance Wellness Integration**
- Customer: Star Health, Niva Bupa, HDFC Ergo
- Offering: Verified low-pollution commuting behaviour data for premium discount programs
- Pricing: ₹80–120 per opted-in user per month
- User benefit: 5–8% annual premium discount
- Year 1 target: 10,000 users → ₹1–1.5 crore
- Year 2 target: 50,000 users → ₹5–8 crore ARR

### 7.2 Revenue Projection

| Stream | Year 1 | Year 2 |
|---|---|---|
| B2G Municipal | ₹40–70 lakh | ₹2–3.5 crore |
| B2B Enterprise | ₹80 lakh–1.2 crore | ₹4–6 crore |
| B2B2C Insurance | ₹1–1.5 crore | ₹5–8 crore |
| **Total ARR** | **₹2–3 crore** | **₹11–17 crore** |

### 7.3 Competitive Moat
Google Maps' revenue requires maximising engagement on fastest routes. EcoLens' revenue increases every time a user takes a healthier, lower-carbon route. The business model and user health interest are perfectly aligned — this structural inversion cannot be replicated by any platform whose monetisation depends on route speed.

---

## 8. Constraints and Assumptions

**Constraints:**
- All external datasets must be free and accessible without paid API keys (for hackathon build)
- Backend must deploy on Render.com free tier
- Frontend must be a PWA (no native app store submission required for Round 1)
- Two-person team — architecture must prioritise build speed over completeness

**Assumptions:**
- Chennai/Bengaluru OSM graph can be downloaded and loaded into NetworkX within the build window
- HuggingFace free Inference API for Moondream2 is available with sufficient rate limits for demo
- CPCB portal provides at least 12 sensor readings for GPR interpolation
- Judges evaluate on working prototype, not production-scale deployment

---

## 9. Dependencies

| Dependency | Type | Risk Level |
|---|---|---|
| OpenAQ API | External free API | Low — highly reliable |
| CPCB portal | Government data portal | Medium — occasional downtime |
| HuggingFace Inference API (Moondream2) | External free API | Medium — rate limits |
| Nominatim OSM Search | External free API | Low |
| Render.com free tier | Deployment platform | Low |
| Sentinel-2 Copernicus | Satellite data | Low — free registration |
| Landsat 8 USGS | Satellite data | Low — same-day access |
| ERA5 Copernicus | Climate reanalysis | Low — free |

---

## 10. Release Plan

### Round 1 Demo Scope (CODEX 2026)
- Working map with at least 3 environmental layers (air quality, carbon, heat)
- Route generation returning 3 routes with PM2.5 and CO2 metrics
- AR camera overlay showing road surface colouring (pre-computed for demo corridor)
- Personal exposure dashboard showing at least today's summary
- Auth (register + login)

### Post-Round 1 (if qualifying)
- Live Moondream2 AR vehicle detection
- LSTM forecast fully operational
- PPO route optimisation integrated
- Push notifications live
- Full trip history and badge system

---