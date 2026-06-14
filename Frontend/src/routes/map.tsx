import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  User,
  AlertTriangle,
  X,
  Layers,
  Crosshair,
  ScanLine,
  Leaf,
  ArrowLeft,
  Navigation,
  MapPin,
  Compass,
  Play,
  RotateCcw,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  Award,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { Map, MapRoute, MapMarker, MarkerContent, useMap, type MapRef } from "@/components/ui/map";
import { generateRoutes, type RouteOption } from "@/lib/api/routes";
import { isDemo, apiFetch } from "@/lib/api/client";

const LIGHT_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DARK_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Helper for dynamic turn-by-turn directions based on progress
function getDirectionsInstruction(progress: number, pathLength: number) {
  if (pathLength === 0) return { text: "Proceed to destination", type: "straight" };
  
  const remainingSteps = pathLength - progress;
  if (remainingSteps <= 1) {
    return { text: "Arrived at your destination", type: "arrive" };
  }

  if (progress < 3) {
    const meters = Math.max(50, 250 - progress * 50);
    return { text: `In ${meters} meters, take a right onto Cubbon Rd`, type: "right" };
  } else if (progress < 7) {
    const meters = Math.max(50, 400 - (progress - 3) * 50);
    return { text: `In ${meters} meters, turn left toward Residency Rd`, type: "left" };
  } else {
    const meters = Math.max(50, 150 - (progress - 7) * 50);
    return { text: `In ${meters} meters, proceed straight to destination`, type: "straight" };
  }
}

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Live Map Â· EcoLens" }] }),
  component: MapPage,
});

interface LocationSuggestion {
  name: string;
  coords: [number, number];
}

function readSavedNavigationState() {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem("ecolens:navigation_state");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function MapPage() {
  const navigate = useNavigate();
  const mapRef = useRef<MapRef>(null);
  const [mapReady, setMapReady] = useState(false);

  // Map settings
  const lightStyle = LIGHT_STYLE;
  const darkStyle = DARK_STYLE;

  // Load saved navigation state on client only (SSR-safe)
  const [savedState] = useState(readSavedNavigationState);

  useEffect(() => {
    setMapReady(true);
  }, []);

  // Location/Directions state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [originText, setOriginText] = useState<string>(savedState?.originText || "My Location");
  const [destText, setDestText] = useState<string>(savedState?.destText || "");
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(savedState?.originCoords || null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(savedState?.destCoords || null);

  // Suggestion boxes
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [isRoutingMode, setIsRoutingMode] = useState<boolean>(savedState?.isRoutingMode || false);
  const [isDirectionsExpanded, setIsDirectionsExpanded] = useState<boolean>(savedState?.isDirectionsExpanded || savedState?.isRoutingMode || false);

  // Dynamic suggestions states
  const [originSuggestions, setOriginSuggestions] = useState<LocationSuggestion[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<LocationSuggestion[]>([]);
  const [loadingOrigin, setLoadingOrigin] = useState(false);
  const [loadingDest, setLoadingDest] = useState(false);

  // Debounced search for Origin suggestions using Nominatim API
  useEffect(() => {
    if (!originText || originText === "My Location" || originText.trim().length < 2) {
      setOriginSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingOrigin(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            originText
          )}&limit=5&countrycodes=in`
        );
        const data = await res.json();
        const mapped = data.map((item: any) => ({
          name: item.display_name.split(",").slice(0, 3).join(","),
          coords: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
        }));
        setOriginSuggestions(mapped);
      } catch (err) {
        console.error("Nominatim origin query failed:", err);
      } finally {
        setLoadingOrigin(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [originText]);

  // Debounced search for Destination suggestions using Nominatim API
  useEffect(() => {
    if (!destText || destText.trim().length < 2) {
      setDestSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingDest(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            destText
          )}&limit=5&countrycodes=in`
        );
        const data = await res.json();
        const mapped = data.map((item: any) => ({
          name: item.display_name.split(",").slice(0, 3).join(","),
          coords: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
        }));
        setDestSuggestions(mapped);
      } catch (err) {
        console.error("Nominatim destination query failed:", err);
      } finally {
        setLoadingDest(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [destText]);

  // Selected Route Type
  const [routeType, setRouteType] = useState<"fastest" | "cleanest_air" | "lowest_carbon">(savedState?.routeType || "cleanest_air");

  // Navigation Simulation States
  const [isNavigating, setIsNavigating] = useState<boolean>(savedState?.isNavigating || false);
  const [navProgress, setNavProgress] = useState<number>(savedState?.navProgress || 0);
  const [navPath, setNavPath] = useState<[number, number][]>(savedState?.navPath || []);
  const [currentNavCoords, setCurrentNavCoords] = useState<[number, number] | null>(savedState?.currentNavCoords || null);
  const [tripCompleted, setTripCompleted] = useState<boolean>(savedState?.tripCompleted || false);

  // Dynamic layers state
  const [layerOpen, setLayerOpen] = useState(false);
  const [activeLayers, setActiveLayers] = useState({
    air: false,
    carbon: false,
    heat: false,
    green: false,
    noise: false,
  });

  // Backend-fetched routes (null = not yet fetched)
  const [apiRoutes, setApiRoutes] = useState<RouteOption[] | null>(null);
  const [fetchingRoutes, setFetchingRoutes] = useState(false);

  // Keep a stable ref to the selected API route so the nav interval doesn't
  // restart every render when apiRoutes/routeType changes.
  const selectedApiRouteRef = useRef<RouteOption | undefined>(undefined);

  // Live EcoScore for current user position
  const [liveEcoScore, setLiveEcoScore] = useState<number | null>(null);

  // Trip completion result from the calculate API
  const [tripResult, setTripResult] = useState<{
    ecoscore: number;
    pm25_avoided: number;
    co2_grams: number;
  } | null>(null);

  // Serialize state changes to localStorage.
  // NOTE: navPath is intentionally excluded — it's a large coordinate array
  // that would block the main thread if serialized every 2-second nav tick.
  // It is only saved when startNav() fires (below).
  useEffect(() => {
    if (destCoords) {
      const state = {
        originText,
        originCoords,
        destText,
        destCoords,
        isRoutingMode,
        isDirectionsExpanded,
        routeType,
        isNavigating,
        navProgress,
        currentNavCoords,
        tripCompleted,
      };
      localStorage.setItem("ecolens:navigation_state", JSON.stringify(state));
    } else {
      localStorage.removeItem("ecolens:navigation_state");
    }
  }, [
    originText,
    originCoords,
    destText,
    destCoords,
    isRoutingMode,
    isDirectionsExpanded,
    routeType,
    isNavigating,
    navProgress,
    currentNavCoords,
    tripCompleted,
  ]);

  // Fetch real routes from the backend whenever origin + destination are set
  useEffect(() => {
    if (!destCoords || !originCoords) return;
    const origin = { lat: originCoords[1], lng: originCoords[0] };
    const destination = { lat: destCoords[1], lng: destCoords[0] };
    setFetchingRoutes(true);
    setApiRoutes(null);
    generateRoutes(origin, destination)
      .then((routes) => {
        if (routes.length > 0) setApiRoutes(routes);
      })
      .catch((err) => {
        console.warn("Route generation API error:", err);
        setApiRoutes([]);
      })
      .finally(() => setFetchingRoutes(false));
  }, [destCoords, originCoords]);

  // Request location on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          setUserLocation(coords);
          if (!savedState) {
            setOriginCoords(coords);
            // Fly map to user location
            mapRef.current?.flyTo({ center: coords, zoom: 14, duration: 1500 });
          }
        },
        (err) => {
          console.warn("Geolocation permission denied/failed. Using Bengaluru as map center.", err);
          const defaultCenter: [number, number] = [77.5946, 12.9716];
          setUserLocation(defaultCenter);
          if (!savedState) {
            setOriginCoords(defaultCenter);
          }
        }
      );
    } else {
      const defaultCenter: [number, number] = [77.5946, 12.9716];
      setUserLocation(defaultCenter);
      if (!savedState) {
        setOriginCoords(defaultCenter);
      }
    }
  }, []);

  // Fetch live EcoScore for user's current location
  useEffect(() => {
    if (!userLocation || isDemo()) return;
    const [lng, lat] = userLocation;
    const token = localStorage.getItem("ecolens:auth_token");
    if (!token) return;
    fetch(`/api/env/composite?lat=${lat}&lon=${lng}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.air_quality) return;
        const pm25 = data.air_quality.pm25 ?? 0;
        // Simple ecoscore from PM2.5: 100 at 0Âµg, 0 at 200Âµg
        setLiveEcoScore(Math.max(0, Math.min(100, Math.round(100 - pm25 / 2))));
      })
      .catch(() => { /* silent â€” EcoScore stays null */ });
  }, [userLocation]);

  // Fly to active navigation or routing coordinates if saved state exists
  useEffect(() => {
    if (savedState) {
      const flyCenter = savedState.currentNavCoords || savedState.destCoords || savedState.originCoords;
      if (flyCenter) {
        const timer = setTimeout(() => {
          mapRef.current?.flyTo({
            center: flyCenter,
            zoom: savedState.isNavigating ? 16.5 : 13,
            pitch: savedState.isNavigating ? 50 : 45,
            duration: 1500,
          });
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, []);



  // Handle Locating Button click
  const handleLocateMe = () => {
    if (userLocation) {
      mapRef.current?.flyTo({ center: userLocation, zoom: 15, duration: 1200 });
      setOriginCoords(userLocation);
      setOriginText("My Location");
    } else {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(coords);
        setOriginCoords(coords);
        setOriginText("My Location");
        mapRef.current?.flyTo({ center: coords, zoom: 15, duration: 1200 });
      });
    }
  };

  const startPt = originCoords || userLocation || [77.5946, 12.9716];
  const endPt = destCoords;

  const selectedApiRoute = apiRoutes?.find((r) => r.type === routeType);
  // Keep the ref in sync so the nav interval can access it without being in deps
  selectedApiRouteRef.current = selectedApiRoute;
  const selectedPath = selectedApiRoute?.polyline?.length
    ? validCoords(selectedApiRoute.polyline)
    : [];
  const selectedDistanceKm = selectedApiRoute?.distance_km ?? 0;

  // Select a suggestion
  const selectSuggestion = (type: "origin" | "dest", item: LocationSuggestion) => {
    if (type === "origin") {
      setOriginText(item.name);
      setOriginCoords(item.coords);
      setShowOriginSuggestions(false);
      mapRef.current?.flyTo({ center: item.coords, zoom: 14, duration: 1000 });
    } else {
      setDestText(item.name);
      setDestCoords(item.coords);
      setShowDestSuggestions(false);
      setIsRoutingMode(true);
      setIsDirectionsExpanded(false);
      mapRef.current?.flyTo({ center: item.coords, zoom: 13, duration: 1200 });
    }
  };

  // Save trip to database after navigation finishes; avoid blocking PPO route start.
  const saveTripToBackend = async (
    start: [number, number],
    end: [number, number],
    selectedRouteType: string,
    route: RouteOption | undefined,
  ) => {
    const token = localStorage.getItem("ecolens:auth_token");
    const isDemoMode = localStorage.getItem("ecolens:auth") === "demo";
    if (!token || isDemoMode) {
      console.log("Trip save skipped without an authenticated backend session.");
      return;
    }

    try {
      const response = await fetch("/api/exposure/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          trip: {
            origin: { lat: start[1], lng: start[0] },
            destination: { lat: end[1], lng: end[0] },
            route_type: selectedRouteType,
            segment_ids: route?.segment_ids ?? [],
            segment_durations_sec: route?.segment_ids?.map(() =>
              Math.max(30, Math.round((route.duration_min * 60) / Math.max(1, route.segment_ids.length))),
            ) ?? [],
            started_at: new Date().toISOString(),
            ended_at: new Date(Date.now() + Math.max(1, route?.duration_min ?? 1) * 60000).toISOString(),
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Trip successfully saved to backend database!");
        setTripResult({
          ecoscore: result.ecoscore ?? 0,
          pm25_avoided: result.pm25_avoided ?? 0,
          co2_grams: result.co2_grams ?? 0,
        });
      } else {
        const err = await response.json();
        console.error("Failed to save trip to backend:", err);
      }
    } catch (err) {
      console.warn("Backend offline, could not save trip to backend:", err);
    }
  };

  // Start navigation simulation
  const startNav = () => {
    if (selectedPath.length === 0) return;

    setNavPath(selectedPath);
    setNavProgress(0);
    setCurrentNavCoords(selectedPath[0]);
    setIsNavigating(true);
    setTripCompleted(false);

    // Share navigation state instantly with the AR page
    const state = {
      originText,
      originCoords,
      destText,
      destCoords,
      isRoutingMode,
      isDirectionsExpanded,
      routeType,
      isNavigating: true,
      navProgress: 0,
      navPath: selectedPath,
      currentNavCoords: selectedPath[0],
      tripCompleted: false,
    };
    localStorage.setItem("ecolens:navigation_state", JSON.stringify(state));

    mapRef.current?.flyTo({
      center: selectedPath[0],
      zoom: 16.5,
      pitch: 60,
      duration: 1000,
    });
  };

  // Stable refs so the interval callback never becomes stale while also
  // not triggering interval restarts on every render.
  const navPathRef = useRef<[number, number][]>(navPath);
  useEffect(() => { navPathRef.current = navPath; }, [navPath]);
  const routeTypeRef = useRef(routeType);
  useEffect(() => { routeTypeRef.current = routeType; }, [routeType]);
  const originCoordsRef = useRef(originCoords);
  useEffect(() => { originCoordsRef.current = originCoords; }, [originCoords]);
  const destCoordsRef = useRef(destCoords);
  useEffect(() => { destCoordsRef.current = destCoords; }, [destCoords]);
  const apiRoutesRef = useRef(apiRoutes);
  useEffect(() => { apiRoutesRef.current = apiRoutes; }, [apiRoutes]);

  // Simulated movement hook
  // Only depends on isNavigating / tripCompleted to avoid restarting the
  // interval every render when apiRoutes or routeType changes (which caused
  // the UI freeze when routing results first arrived).
  useEffect(() => {
    if (!isNavigating || tripCompleted) return;

    const interval = window.setInterval(() => {
      setNavProgress((prevProgress) => {
        const currentNavPath = navPathRef.current;
        if (currentNavPath.length === 0) return prevProgress;

        const nextProgress = prevProgress + 1;
        if (nextProgress >= currentNavPath.length) {
          clearInterval(interval);
          setTripCompleted(true);

          // Immediately show values from route data so the modal is never empty.
          // The async backend call will overwrite this with real saved data if it succeeds.
          const route = selectedApiRouteRef.current;
          if (route) {
            const fastestRoute = apiRoutesRef.current?.find((r) => r.type === "fastest");
            const fastestPm25 = fastestRoute?.pm25_exposure ?? route.pm25_exposure * 1.6;
            setTripResult({
              ecoscore: route.ecoscore,
              pm25_avoided: Math.max(0, Math.round(fastestPm25 - route.pm25_exposure)),
              co2_grams: Math.round(route.co2_grams),
            });
          }

          if (originCoordsRef.current && destCoordsRef.current) {
            void saveTripToBackend(
              originCoordsRef.current,
              destCoordsRef.current,
              routeTypeRef.current,
              selectedApiRouteRef.current,
            );
          }
          return prevProgress;
        }

        const nextCoords = currentNavPath[nextProgress];
        setCurrentNavCoords(nextCoords);
        mapRef.current?.easeTo({
          center: nextCoords,
          zoom: 16.5,
          duration: 1000,
        });

        return nextProgress;
      });
    }, 2000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigating, tripCompleted]);


  // Exit navigation
  const exitNavigation = () => {
    setIsNavigating(false);
    setTripCompleted(false);
    localStorage.removeItem("ecolens:navigation_state");
    mapRef.current?.easeTo({ pitch: 60, zoom: 14, duration: 1000 });
  };
  const routeOptions = (apiRoutes ?? []).map((route, index) => ({
    id: route.type,
    label: route.label,
    duration: route.duration_min ?? 0,
    distance: route.distance_km ?? 0,
    pm25: Math.round(route.pm25_exposure ?? 0),
    co2: Math.round(route.co2_grams ?? 0),
    ecoscore: route.ecoscore ?? 0,
    lineColor: routeColor(route, index),
    recommended: route.recommended || route.ppo_recommended || false,
    forecastNote: route.forecast_note,
    warning: route.degradation_warning,
  }));

  return (
    <MobileShell>
      <div className="relative h-dvh min-h-[480px] overflow-hidden bg-background">
        {/* Real Map Component â€” mount client-side after layout is known */}
        {mapReady && (
        <Map
          ref={mapRef}
          theme="dark"
          center={userLocation || [77.5946, 12.9716]}
          zoom={15}
          pitch={60}
          className="absolute inset-0 h-full w-full min-h-[300px]"
          styles={{
            light: lightStyle,
            dark: darkStyle,
          }}
          attributionControl={false}
        >
          {/* User live location marker */}
          {userLocation && !isNavigating && (
            <MapMarker longitude={userLocation[0]} latitude={userLocation[1]}>
              <MarkerContent>
                <span className="relative flex h-6 w-6 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-eco-blue/20" />
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-eco-cream bg-eco-blue shadow-md shadow-eco-blue/50" />
                </span>
              </MarkerContent>
            </MapMarker>
          )}

          {/* Start and Destination Markers */}
          {isRoutingMode && startPt && (
            <MapMarker longitude={startPt[0]} latitude={startPt[1]}>
              <MarkerContent>
                <div className="flex flex-col items-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-eco-cream bg-eco-green text-background shadow-lg">
                    <Navigation className="h-4 w-4 rotate-45" />
                  </span>
                  <span className="mt-1 rounded bg-card/90 px-1 py-0.5 text-[9px] border border-border shadow font-mono">Start</span>
                </div>
              </MarkerContent>
            </MapMarker>
          )}

          {isRoutingMode && endPt && (
            <MapMarker longitude={endPt[0]} latitude={endPt[1]}>
              <MarkerContent>
                <div className="flex flex-col items-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-eco-cream bg-eco-red text-eco-cream shadow-lg">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span className="mt-1 rounded bg-card/90 px-1 py-0.5 text-[9px] border border-border shadow font-mono">End</span>
                </div>
              </MarkerContent>
            </MapMarker>
          )}

          {/* Navigation marker */}
          {isNavigating && currentNavCoords && (
            <MapMarker longitude={currentNavCoords[0]} latitude={currentNavCoords[1]}>
              <MarkerContent>
                <span className="relative flex h-8 w-8 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-eco-orange/30" />
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-eco-orange text-background shadow-md">
                    <Navigation className="h-3 w-3 fill-current" />
                  </span>
                </span>
              </MarkerContent>
            </MapMarker>
          )}

          {/* Display backend route paths */}
          {isRoutingMode && endPt && !isNavigating && (() => {
            const types: Array<"fastest" | "cleanest_air" | "lowest_carbon"> = [
              "cleanest_air",
              "lowest_carbon",
              "fastest",
            ];
            return (
              <>
                {types.map((type) => {
                  const apiRoute = apiRoutes?.find((r) => r.type === type);
                  const active = routeType === type;
                  if (apiRoute) {
                    return (
                      <EnvironmentalRouteLine
                        key={`api-${type}`}
                        route={apiRoute}
                        active={active}
                        onClick={() => setRouteType(type)}
                      />
                    );
                  }
                  return null;
                })}
              </>
            );
          })()}

          {/* Display Navigating Active Path */}
          {isNavigating && validCoords(navPath).length > 0 && (
            selectedApiRoute?.risk_segments?.length ? (
              <EnvironmentalRouteLine
                route={selectedApiRoute}
                active
                idPrefix="active-nav"
              />
            ) : (
              null
            )
          )}

          {/* Environmental Overlay Layers */}
          <EnvironmentalOverlays activeLayers={activeLayers} />
        </Map>
        )}

        {/* ==================== NORMAL MAP MODE HUD ==================== */}
        {!isNavigating && (
          <>
            {/* Top search & directions panel */}
            <div className="absolute inset-x-0 top-0 z-20 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
              {!isDirectionsExpanded ? (
                /* SINGLE SEARCH BAR MODE */
                <div className="flex items-center gap-3 rounded-full border border-border bg-card/85 px-4 py-3 shadow-lg backdrop-blur-md">
                  <Search className="h-4 w-4 text-eco-orange ml-1" />
                  <input
                    type="text"
                    value={destText}
                    onChange={(e) => setDestText(e.target.value)}
                    onFocus={() => {
                      setIsDirectionsExpanded(true);
                      setShowDestSuggestions(true);
                      if (!originCoords && userLocation) {
                        setOriginCoords(userLocation);
                        setOriginText("My Location");
                      }
                    }}
                    placeholder="Where are you going?"
                    className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    suppressHydrationWarning
                  />
                  {destText && (
                    <button
                      onClick={() => {
                        setDestText("");
                        setDestCoords(null);
                        setIsRoutingMode(false);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      suppressHydrationWarning
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <div className="h-5 w-[1px] bg-border/80" />
                  <button
                    onClick={() => {
                      setIsDirectionsExpanded(true);
                    }}
                    className="p-1 text-eco-orange hover:text-eco-orange/80 transition-colors"
                    suppressHydrationWarning
                  >
                    <Navigation className="h-4 w-4 fill-current rotate-45" />
                  </button>
                </div>
              ) : (
                /* EXPANDED DIRECTIONS MODE (TWO INPUTS) */
                <div className="rounded-3xl border border-border bg-card/85 p-4 shadow-xl backdrop-blur-md flex flex-col gap-3">
                  <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                    <button
                      onClick={() => {
                        setIsDirectionsExpanded(false);
                        setIsRoutingMode(false);
                        setDestCoords(null);
                        setDestText("");
                      }}
                      className="p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                      suppressHydrationWarning
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="font-semibold text-xs text-foreground font-mono">Plan EcoRoute</span>
                    {fetchingRoutes && (
                      <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-eco-orange">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-eco-orange" />
                        Fetching routesâ€¦
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    {/* Origin input */}
                    <div className="relative flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-eco-green/10 text-eco-green">
                        <Compass className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        value={originText}
                        onFocus={() => {
                          setShowOriginSuggestions(true);
                          setShowDestSuggestions(false);
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowOriginSuggestions(false), 250);
                        }}
                        onChange={(e) => {
                          setOriginText(e.target.value);
                          setShowOriginSuggestions(true);
                        }}
                        placeholder="Enter start location..."
                        className="flex-1 bg-transparent text-sm text-foreground outline-none border-b border-border py-1"
                        suppressHydrationWarning
                      />
                      <X
                        className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setOriginText("");
                          setOriginCoords(null);
                        }}
                      />
                    </div>

                    {/* Destination input */}
                    <div className="relative flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-eco-red/10 text-eco-red">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        value={destText}
                        onFocus={() => {
                          setShowDestSuggestions(true);
                          setShowOriginSuggestions(false);
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowDestSuggestions(false), 250);
                        }}
                        onChange={(e) => {
                          setDestText(e.target.value);
                          setShowDestSuggestions(true);
                        }}
                        placeholder="Search destination..."
                        className="flex-1 bg-transparent text-sm text-foreground outline-none border-b border-border py-1"
                        suppressHydrationWarning
                      />
                      <X
                        className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setDestText("");
                          setDestCoords(null);
                          setIsRoutingMode(false);
                        }}
                      />
                    </div>
                  </div>

                  {/* Swap button helper */}
                  {isRoutingMode && (
                    <div className="mt-1 flex justify-end">
                      <button
                        onClick={() => {
                          const tempText = originText;
                          const tempCoords = originCoords;
                          setOriginText(destText);
                          setOriginCoords(destCoords);
                          setDestText(tempText);
                          setDestCoords(tempCoords as [number, number]);
                        }}
                        className="flex items-center gap-1 font-mono text-[10px] text-eco-orange hover:underline"
                        suppressHydrationWarning
                      >
                        <RefreshCw className="h-3 w-3" /> Swap Locations
                      </button>
                    </div>
                  )}

                  {/* Suggestion Dropdown: Start / Origin */}
                  {showOriginSuggestions && originText.trim().length >= 2 && originText !== "My Location" && (
                    <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-background/95 p-2 shadow-inner pointer-events-auto">
                      {loadingOrigin && <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>}
                      {!loadingOrigin && originSuggestions.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground font-mono">No matching locations found</div>}
                      {originSuggestions.map((item, idx) => (
                        <button
                          key={"origin-" + idx}
                          onClick={() => selectSuggestion("origin", item)}
                          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-card text-foreground"
                        >
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Suggestion Dropdown: Destination */}
                  {showDestSuggestions && destText.trim().length >= 2 && (
                    <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-background/95 p-2 shadow-inner pointer-events-auto">
                      {loadingDest && <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>}
                      {!loadingDest && destSuggestions.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground font-mono">No matching locations found</div>}
                      {destSuggestions.map((item, idx) => (
                        <button
                          key={"dest-" + idx}
                          onClick={() => selectSuggestion("dest", item)}
                          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-card text-foreground"
                        >
                          <MapPin className="h-3.5 w-3.5 text-eco-red" />
                          <span className="truncate">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Left side panel: EcoScore and Map layers */}
            <div className="absolute left-4 top-24 z-10 flex flex-col gap-3 pointer-events-auto">
              {/* EcoScore Indicator */}
              <div
                className="flex h-16 w-20 flex-col items-center justify-center rounded-2xl border border-border bg-card/90 text-foreground shadow-lg backdrop-blur-md"
                title={liveEcoScore != null ? `Current Location EcoScore: ${liveEcoScore}` : "Loading EcoScoreâ€¦"}
              >
                <span className="text-[18px] font-bold text-eco-green leading-none">
                  {liveEcoScore != null ? liveEcoScore : "â€“"}
                </span>
                <span className="text-[8px] font-mono font-semibold uppercase text-muted-foreground leading-none mt-1.5">EcoScore</span>
              </div>

              {/* Environment Overlay Sub-Panel */}
              <div className="w-44 rounded-2xl border border-border bg-card/90 p-3.5 shadow-lg backdrop-blur-md">
                <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-eco-orange" />
                  <span>Map Overlays</span>
                </div>
                <div className="flex flex-col gap-2 font-sans">
                  {Object.entries({
                    air: { label: "Air Quality (PM2.5)", color: "text-eco-green" },
                    carbon: { label: "Carbon Load", color: "text-eco-blue" },
                    heat: { label: "Urban Heat", color: "text-eco-orange" },
                    green: { label: "Green Cover", color: "text-green-500" },
                    noise: { label: "Noise Level", color: "text-purple-400" },
                  }).map(([key, info]) => (
                    <label key={key} className="flex cursor-pointer items-center justify-between text-[11px] font-medium leading-none">
                      <span className={info.color}>{info.label.split(" ")[0]}</span>
                      <input
                        type="checkbox"
                        checked={activeLayers[key as keyof typeof activeLayers]}
                        onChange={(e) =>
                          setActiveLayers((prev) => {
                            const next = {
                              air: false,
                              carbon: false,
                              heat: false,
                              green: false,
                              noise: false,
                            };
                            next[key as keyof typeof activeLayers] = e.target.checked;
                            return next;
                          })
                        }
                        className="accent-eco-orange cursor-pointer h-3 w-3 shrink-0 ml-1"
                        suppressHydrationWarning
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Floating Map Utilities (Right side) */}
            <div className="absolute right-4 top-24 z-10 flex flex-col gap-3">
              {/* Geolocation FAB */}
              <button
                onClick={handleLocateMe}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card/85 text-foreground shadow-lg backdrop-blur-md transition-transform active:scale-95 hover:bg-card"
                title="Geolocate Live Position"
                suppressHydrationWarning
              >
                <Crosshair className="h-5 w-5 text-eco-blue" />
              </button>
            </div>

            {/* BOTTOM SHEET: Routes list overlay if destination selected */}
            {isRoutingMode && endPt && (
              <div className="absolute inset-x-4 bottom-3 z-10 rounded-3xl border border-border bg-card/90 shadow-2xl backdrop-blur-md flex flex-col" style={{ maxHeight: "52%" }}>
                {/* Fixed header */}
                <div className="flex items-center justify-between border-b border-border/50 px-4 pt-4 pb-3 shrink-0">
                  <h3 className="text-sm font-bold">Recommended Routes</h3>
                  {fetchingRoutes && (
                    <span className="flex items-center gap-1 font-mono text-[10px] text-eco-orange">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-eco-orange" />
                      Fetching routes…
                    </span>
                  )}
                </div>

                {/* Scrollable route cards */}
                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
                  {!fetchingRoutes && routeOptions.length === 0 && (
                    <div className="rounded-2xl border border-eco-red/30 bg-eco-red/10 p-4 text-center text-xs text-eco-red">
                      Could not load routes from the backend.
                    </div>
                  )}
                  {routeOptions.map((opt) => {
                    const active = routeType === opt.id;
                    // Colour strip per route type
                    const stripColor = opt.id === "cleanest_air" ? "bg-eco-green" : opt.id === "lowest_carbon" ? "bg-eco-blue" : "bg-eco-orange";
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setRouteType(opt.id as "fastest" | "cleanest_air" | "lowest_carbon")}
                        className={`flex flex-col gap-2 rounded-2xl border p-3 text-left transition-all ${
                          active ? "border-eco-green bg-background/80 shadow-md" : "border-border/60 bg-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {/* Traffic-style colour dot */}
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${stripColor}`} />
                          <span className="text-xs font-semibold flex-1">{opt.label}</span>
                          {opt.recommended && (
                            <span className="rounded-full bg-eco-green/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-eco-green">
                              PPO Pick
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                              opt.ecoscore >= 70 ? "bg-eco-green/10 text-eco-green" : opt.ecoscore >= 45 ? "bg-eco-orange/10 text-eco-orange" : "bg-eco-red/10 text-eco-red"
                            }`}
                          >
                            {opt.ecoscore}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground ml-4">
                          <div>{formatDuration(opt.duration)} · {opt.distance.toFixed(opt.distance >= 100 ? 0 : 1)} km</div>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-0.5"><Leaf className="h-3 w-3 text-eco-green" /> {opt.pm25}µg</span>
                            <span className="flex items-center gap-0.5"><Award className="h-3 w-3 text-eco-blue" /> {opt.co2}g</span>
                          </div>
                        </div>
                        {opt.warning && (
                          <div className="ml-4 rounded-full bg-eco-orange/10 px-2 py-0.5 font-mono text-[9px] uppercase text-eco-orange">
                            {opt.warning}
                          </div>
                        )}
                        {opt.forecastNote && (
                          <p className="ml-4 text-[10px] leading-snug text-muted-foreground">
                            {opt.forecastNote}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Fixed Start Navigation button — always visible */}
                <div className="shrink-0 px-4 pb-4 pt-2 border-t border-border/40">
                  <button
                    onClick={startNav}
                    disabled={selectedPath.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-eco-orange py-3.5 text-sm font-semibold text-background transition-transform active:scale-[0.98] shadow-lg shadow-eco-orange/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Navigation className="h-4 w-4 fill-current" />
                    {selectedPath.length === 0 ? "Loading route…" : "Start Navigation"}
                  </button>
                </div>
              </div>
            )}

            {/* Static default legend if not routing */}
            {!isRoutingMode && (
              <>
              </>
            )}
          </>
        )}

        {/* ==================== ACTIVE NAVIGATION HUD OVERLAYS ==================== */}
        {isNavigating && (
          <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            
            {/* Top directions instruction card */}
            {(() => {
              const direction = getDirectionsInstruction(navProgress, navPath.length);
              return (
                <div className="w-full rounded-2xl border border-border bg-card/90 p-4 shadow-xl backdrop-blur-md pointer-events-auto flex items-center gap-3 animate-in slide-in-from-top duration-300">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-eco-orange text-background transition-all duration-300">
                    {direction.type === "right" ? (
                      <Navigation className="h-5 w-5 fill-current rotate-90" />
                    ) : direction.type === "left" ? (
                      <Navigation className="h-5 w-5 fill-current -rotate-90" />
                    ) : direction.type === "arrive" ? (
                      <MapPin className="h-5 w-5" />
                    ) : (
                      <Navigation className="h-5 w-5 fill-current" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Upcoming turn</span>
                    <div className="text-xs font-semibold leading-tight text-foreground truncate">
                      {direction.text}
                    </div>
                  </div>
                  <button
                    onClick={exitNavigation}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background hover:bg-card text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <Link
                    to="/ar"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-eco-orange/40 bg-eco-orange/15 text-eco-orange hover:bg-eco-orange/25"
                    title="Switch to AR navigation"
                  >
                    <ScanLine className="h-3.5 w-3.5" />
                  </Link>
                </div>
              );
            })()}


            {/* Bottom active HUD sheet */}
            <div className="w-full rounded-2xl border border-border bg-card/90 p-4 shadow-xl backdrop-blur-md pointer-events-auto flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-eco-orange animate-pulse">● Navigating</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{routeType.replace("_", " ").toUpperCase()}</span>
                </div>
                <Link
                  to="/ar"
                  className="flex h-8 items-center gap-1 rounded-full border border-border bg-background px-2.5 text-[10px] font-semibold text-foreground hover:bg-card"
                >
                  <ScanLine className="h-3.5 w-3.5 text-eco-orange" />
                  AR
                </Link>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-foreground">
                    {selectedApiRoute
                      ? `${Math.max(1, Math.round(selectedApiRoute.duration_min * (1 - navProgress / Math.max(1, navPath.length))))} min remaining`
                      : "— min remaining"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground uppercase">
                    {selectedApiRoute
                      ? `${(selectedApiRoute.distance_km * (1 - navProgress / Math.max(1, navPath.length))).toFixed(1)} km left`
                      : "— km left"}
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">PM2.5 Exposure</div>
                  <div className="flex items-center gap-1 text-xs font-bold text-eco-green">
                    <Leaf className="h-4 w-4" />
                    {selectedApiRoute ? `${Math.round(selectedApiRoute.pm25_exposure)} µg` : "—"}
                  </div>
                </div>
              </div>

              {/* Progress bar of trip */}
              <div className="relative h-1.5 w-full rounded-full bg-border overflow-hidden">
                <div
                  className="h-full bg-eco-orange transition-all duration-1000"
                  style={{ width: `${(navProgress / navPath.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* TRIP SUMMARY COMPLETION MODAL */}
        {tripCompleted && (
          <div className="absolute inset-0 z-40 bg-background/80 flex items-center justify-center p-6 backdrop-blur-md">
            <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl text-center flex flex-col gap-4 animate-in zoom-in-95 duration-300">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-eco-green/10 text-eco-green">
                <CheckCircle className="h-10 w-10" />
              </span>
              <div>
                <h3 className="text-xl font-bold text-foreground">Trip Completed!</h3>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">EcoLens Carbon Summary</p>
              </div>

              <div className="grid grid-cols-3 gap-2 border-y border-border py-4 my-2">
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-eco-green">
                    {tripResult != null ? tripResult.ecoscore : "—"}
                  </span>
                  <span className="font-mono text-[9px] uppercase text-muted-foreground">EcoScore</span>
                </div>
                <div className="flex flex-col items-center border-x border-border">
                  <span className="text-lg font-bold text-eco-green">
                    {tripResult != null ? `${tripResult.pm25_avoided.toFixed(0)} µg` : "—"}
                  </span>
                  <span className="font-mono text-[9px] uppercase text-muted-foreground">PM2.5 Saved</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-eco-blue">
                    {tripResult != null ? `${tripResult.co2_grams.toFixed(0)} g` : "—"}
                  </span>
                  <span className="font-mono text-[9px] uppercase text-muted-foreground">CO₂ Saved</span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                {tripResult != null
                  ? `Great work! Your ${routeType.replace("_", " ")} route earned you an EcoScore of ${tripResult.ecoscore}.`
                  : "Trip data is being processed. Check your dashboard for updated stats."}
              </p>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => {
                    setTripCompleted(false);
                    setIsNavigating(false);
                    setTripResult(null);
                  }}
                  className="flex-1 rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-foreground hover:bg-card"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setTripCompleted(false);
                    setIsNavigating(false);
                    navigate({ to: "/dashboard" });
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-eco-orange py-3 text-sm font-semibold text-background shadow-lg shadow-eco-orange/25 hover:brightness-105"
                >
                  <Award className="h-4 w-4" /> Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}

const ENV_NUMERIC_DEFAULTS: Record<string, number> = {
  pm25: 50,
  no2: 20,
  co2_per_min: 1.5,
  ndvi: 0.5,
  noise_db: 55,
  heat_anomaly: 1.0,
};

function isValidCoordPair(coord: unknown): coord is [number, number] {
  return (
    Array.isArray(coord) &&
    coord.length >= 2 &&
    typeof coord[0] === "number" &&
    typeof coord[1] === "number" &&
    Number.isFinite(coord[0]) &&
    Number.isFinite(coord[1])
  );
}

function validCoords(coords: [number, number][]): [number, number][] {
  return coords.filter(isValidCoordPair);
}

/**
 * Returns a hex colour for a route card/polyline based on route type and index.
 * Green = cleanest air, Blue = lowest carbon, Orange = fastest.
 */
function routeColor(route: { type?: string }, index: number): string {
  if (route?.type === "cleanest_air") return "#22c55e"; // eco-green
  if (route?.type === "lowest_carbon") return "#3b82f6"; // eco-blue
  if (route?.type === "fastest") return "#f97316";        // eco-orange
  const palette = ["#22c55e", "#3b82f6", "#f97316"];
  return palette[index % palette.length];
}

function nearestRoutePointIndex(route: [number, number][], point: [number, number]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  route.forEach(([lng, lat], index) => {
    const distance = (lng - point[0]) ** 2 + (lat - point[1]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/** Format decimal minutes → "X h Y min" or "Y min" */
function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

/**
 * Renders a MapRoute polyline per backend route.
 * Colours each segment green/orange/red based on environmental risk data (like Google Maps traffic).
 */
function EnvironmentalRouteLine({
  route,
  active,
  idPrefix,
  onClick,
}: {
  route: import("@/lib/api/routes").RouteOption;
  active: boolean;
  idPrefix?: string;
  onClick?: () => void;
}) {
  const prefix = idPrefix ?? `route-${route.type}`;

  // If the route has risk_segments, render each segment with its own environmental colour.
  if (route.risk_segments && route.risk_segments.length > 0) {
    return (
      <>
        {route.risk_segments.map((seg: any, i: number) => {
          const coords: [number, number][] = validCoords(seg.coordinates ?? []);
          if (coords.length < 2) return null;
          // Determine colour from segment risk level (mirrors Google Maps green/orange/red traffic)
          // risk_segments use: "safe" | "moderate" | "worst" — see routes.ts
          let color = "#22c55e"; // green = safe
          if (seg.risk === "moderate" || seg.score < 60) color = "#f97316"; // orange
          if (seg.risk === "worst" || seg.score < 30) color = "#ef4444";   // red
          return (
            <MapRoute
              key={`${prefix}-seg-${i}`}
              id={`${prefix}-seg-${i}`}
              coordinates={coords}
              color={color}
              width={active ? 6 : 4}
              opacity={active ? 0.95 : 0.65}
              onClick={onClick}
            />
          );
        })}
      </>
    );
  }

  return null;
}

function sanitizeEnvironmentFeatures(data: any) {
  if (!data?.features) {
    return { type: "FeatureCollection" as const, features: [] };
  }

  const features = data.features
    .map((feature: any) => {
      const coords = (feature.geometry?.coordinates ?? []).filter(isValidCoordPair);
      if (coords.length < 2) return null;

      const props = { ...(feature.properties ?? {}) };
      for (const [key, defaultValue] of Object.entries(ENV_NUMERIC_DEFAULTS)) {
        const value = props[key];
        if (value == null || typeof value !== "number" || !Number.isFinite(value)) {
          props[key] = defaultValue;
        }
      }

      return {
        ...feature,
        geometry: { ...feature.geometry, coordinates: coords },
        properties: props,
      };
    })
    .filter(Boolean);

  return {
    type: "FeatureCollection" as const,
    features,
    ...(data.updated_at ? { updated_at: data.updated_at } : {}),
  };
}

function isMapStyleReady(map: { getStyle: () => unknown } | null) {
  if (!map) return false;
  try {
    return !!map.getStyle();
  } catch {
    return false;
  }
}

function envNumericExpr(property: string, defaultValue: number) {
  // Use the 3-arg form: ["to-number", expr, fallback] which MapLibre supports.
  // This correctly coerces null property values to the fallback number at
  // the expression evaluation level, preventing the "Expected number, found null" error.
  return ["coalesce", ["to-number", ["get", property], defaultValue], defaultValue];
}

interface EnvironmentalOverlaysProps {
  activeLayers: {
    air: boolean;
    carbon: boolean;
    heat: boolean;
    green: boolean;
    noise: boolean;
  };
}

function EnvironmentalOverlays({ activeLayers }: EnvironmentalOverlaysProps) {
  const { map, isLoaded } = useMap();
  const [features, setFeatures] = useState<any>(null);

  // Get active layer key
  const activeKey = Object.keys(activeLayers).find(
    (key) => activeLayers[key as keyof typeof activeLayers]
  ) as "air" | "carbon" | "heat" | "green" | "noise" | undefined;

  useEffect(() => {
    if (!isLoaded || !map || !activeKey) {
      setFeatures(null);
      return;
    }

    const fetchFeatures = async () => {
      const bounds = map.getBounds();
      const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
      
      const layerMap = {
        air: "pm25,no2",
        carbon: "co2_per_min,carbon_intensity",
        heat: "heat_anomaly",
        green: "ndvi",
        noise: "noise_db",
      };

      try {
        const url = `/api/tiles/environment?bbox=${bbox}&layers=${layerMap[activeKey]}`;
        const data = await apiFetch<any>(url);
        setFeatures(sanitizeEnvironmentFeatures(data));
      } catch (err) {
        console.warn("Failed to fetch environmental overlay features:", err);
      }
    };

    fetchFeatures();

    const handleMove = () => {
      fetchFeatures();
    };

    map.on("moveend", handleMove);
    return () => {
      map.off("moveend", handleMove);
    };
  }, [isLoaded, map, activeKey]);

  if (!features || !features.features || features.features.length === 0 || !activeKey) {
    return null;
  }

  return (
    <MapEnvironmentalLayer
      id={`env-layer-${activeKey}`}
      data={features}
      activeKey={activeKey}
    />
  );
}

interface MapEnvironmentalLayerProps {
  id: string;
  data: any;
  activeKey: "air" | "carbon" | "heat" | "green" | "noise";
}

function MapEnvironmentalLayer({ id, data, activeKey }: MapEnvironmentalLayerProps) {
  const { map, isLoaded } = useMap();
  const sourceId = `${id}-source`;
  const lineLayerId = `${id}-line`;
  const glowLayerId = `${id}-glow`;

  useEffect(() => {
    if (!isLoaded || !isMapStyleReady(map) || !data) return;

    const sanitized = sanitizeEnvironmentFeatures(data);
    if (sanitized.features.length === 0) return;

    if (!map!.getSource(sourceId)) {
      map!.addSource(sourceId, {
        type: "geojson",
        data: sanitized,
      });
    } else {
      const source = map!.getSource(sourceId) as { setData?: (data: unknown) => void };
      source.setData?.(sanitized);
    }

    let lineColorExpr: unknown;
    if (activeKey === "air") {
      lineColorExpr = [
        "interpolate",
        ["linear"],
        envNumericExpr("pm25", 50),
        30, "#22c55e",
        75, "#eab308",
        150, "#ef4444",
        300, "#a855f7",
      ];
    } else if (activeKey === "heat") {
      lineColorExpr = [
        "interpolate",
        ["linear"],
        envNumericExpr("heat_anomaly", 1.0),
        0.5, "#fde047",
        1.5, "#f97316",
        3.0, "#ef4444",
      ];
    } else if (activeKey === "carbon") {
      lineColorExpr = [
        "interpolate",
        ["linear"],
        envNumericExpr("co2_per_min", 1.5),
        1.0, "#3b82f6",
        3.0, "#f97316",
        5.0, "#ef4444",
      ];
    } else if (activeKey === "green") {
      lineColorExpr = [
        "interpolate",
        ["linear"],
        envNumericExpr("ndvi", 0.5),
        0.1, "#78350f",
        0.4, "#86efac",
        0.8, "#15803d",
      ];
    } else if (activeKey === "noise") {
      lineColorExpr = [
        "interpolate",
        ["linear"],
        envNumericExpr("noise_db", 55),
        45, "#22c55e",
        60, "#eab308",
        75, "#ef4444",
      ];
    } else {
      lineColorExpr = "#22c55e";
    }

    if (!map!.getLayer(glowLayerId)) {
      map!.addLayer({
        id: glowLayerId,
        type: "line",
        source: sourceId,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "line-color": lineColorExpr as any,
          "line-width": 8,
          "line-opacity": 0.25,
        },
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map!.setPaintProperty(glowLayerId, "line-color", lineColorExpr as any);
    }

    if (!map!.getLayer(lineLayerId)) {
      map!.addLayer({
        id: lineLayerId,
        type: "line",
        source: sourceId,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "line-color": lineColorExpr as any,
          "line-width": 4,
          "line-opacity": 0.85,
        },
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map!.setPaintProperty(lineLayerId, "line-color", lineColorExpr as any);
    }

    return () => {
      if (!isMapStyleReady(map)) return;
      try {
        if (map!.getLayer(lineLayerId)) map!.removeLayer(lineLayerId);
        if (map!.getLayer(glowLayerId)) map!.removeLayer(glowLayerId);
        if (map!.getSource(sourceId)) map!.removeSource(sourceId);
      } catch {
        // Map may already be destroyed during route changes.
      }
    };
  }, [isLoaded, map, data, sourceId, lineLayerId, glowLayerId, activeKey]);

  return null;
}

