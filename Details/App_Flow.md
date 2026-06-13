# EcoLens — App_Flow.md
**Platform:** Mobile (PWA via Google Stitch)
**Theme:** Light (full white bg) / Dark (full black bg) — default Dark
**Accent Colours:** Orange `#F97316` · Green `#22C55E`

---

## Top-Level Flow

```
LAUNCH
  │
  ├── First Time User
  │     └── Splash → Onboarding (3 slides) → Sign Up → Permission Gates → Home
  │
  └── Returning User
        └── Splash → Auto Auth Check
                        ├── Token Valid → Home
                        └── Token Expired → Sign In → Home
```

---

## Core Navigation Structure

Bottom navigation bar (mobile sticky) — 4 tabs:

```
[ 🗺 Map ]   [ 📷 AR ]   [ 📊 Dashboard ]   [ 👤 Profile ]
```

- **Map** — default landing after auth. Full-screen Leaflet environmental map.
- **AR** — camera mode. WebXR overlay on live camera feed.
- **Dashboard** — personal exposure analytics and LSTM forecast.
- **Profile** — account, settings, notifications, about.

The bottom nav persists across all four core tabs. It disappears only during active AR navigation and active turn-by-turn guidance (full immersive mode).

---

## Detailed Flow Per Screen

### AUTH FLOW

```
Splash Screen (1.5s)
  └── Check JWT token in localStorage
        ├── Valid → Home (Map Tab)
        └── Invalid/None → Onboarding (first launch) or Sign In (returning)

Onboarding Screen 1 → Onboarding Screen 2 → Onboarding Screen 3
  └── Get Started CTA → Sign Up Screen

Sign Up Screen
  └── Success → Permission Gates → Home

Sign In Screen
  └── Success → Home
  └── Forgot Password → OTP Screen → Reset Password → Sign In
```

---

### HOME / MAP FLOW

```
Home (Map Tab)
  └── Search Bar tap → Search Screen (full screen)
        └── Destination selected → Route Options Screen
              └── Route selected → Active Navigation Screen
                    ├── Arrival → Trip Summary Screen → Home
                    └── Cancel → Home

Home (Map Tab)
  └── Layer Toggle FAB → Layer Control Sheet (bottom sheet)
  └── Alert Badge tap → Alert Detail Screen
  └── EcoScore badge tap → EcoScore Breakdown Sheet (bottom sheet)
```

---

### AR FLOW

```
AR Tab tap
  └── Camera Permission check
        ├── Granted → AR Camera Screen
        │     └── Destination set → AR Navigation Screen (immersive)
        │           ├── Arrival → Trip Summary → Home
        │           └── Exit AR → Map Tab
        └── Denied → Permission Prompt Screen → Settings deeplink
```

---

### DASHBOARD FLOW

```
Dashboard Tab
  └── Today's Exposure Card tap → Exposure Detail Screen
  └── LSTM Forecast Card tap → Forecast Detail Screen
  └── Trip History Card tap → Trip History Screen
        └── Individual trip tap → Trip Detail Screen
  └── EcoScore Progress tap → EcoScore History Screen
```

---

### PROFILE FLOW

```
Profile Tab
  └── Edit Profile → Edit Profile Screen
  └── Notifications → Notification Settings Screen
  └── App Settings → App Settings Screen
        └── Theme toggle (Light/Dark)
        └── Layer preferences
        └── Route preference (fastest / cleanest / lowest carbon)
  └── About EcoLens → About Screen
  └── Sign Out → Sign In Screen
```

---

## Key Interaction Patterns (Mobile-Specific)

| Pattern | Usage |
|---|---|
| Bottom Sheet | Layer controls, EcoScore breakdown, route options |
| Full-screen takeover | AR camera, active navigation |
| Sticky FAB | Layer toggle on map, AR trigger |
| Swipe up | Expand route comparison panel |
| Long press on map | Drop custom pin, get environmental reading |
| Pull to refresh | Dashboard exposure data |
| Toast notifications | Pollution spike alerts, reroute suggestions |

---

## Colour Application Rules

| Element | Light Mode | Dark Mode |
|---|---|---|
| Background | `#FFFFFF` | `#000000` |
| Surface / Cards | `#F5F5F5` | `#111111` |
| Primary text | `#0A0A0A` | `#F5F5F5` |
| Secondary text | `#6B7280` | `#9CA3AF` |
| Orange accent | `#F97316` | `#F97316` |
| Green accent | `#22C55E` | `#22C55E` |
| Danger / Red zones | `#EF4444` | `#EF4444` |
| Border / Divider | `#E5E7EB` | `#1F1F1F` |

**Orange is used for:** CTAs, alerts, pollution hotspot badges, active route indicator, onboarding highlights.
**Green is used for:** Clean air zones, EcoScore positive indicators, route 2 (Cleanest Air), success states, NDVI overlay.