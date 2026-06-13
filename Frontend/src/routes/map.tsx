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
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Award,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { Map, MapRoute, MapMarker, MarkerContent, type MapRef } from "@/components/ui/map";

const OPEN_STREET_3D_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Live Map · EcoLens" }] }),
  component: MapPage,
});

interface LocationSuggestion {
  name: string;
  coords: [number, number];
}

// Generate intermediate coordinates for simulated paths
function generateRoutePoints(
  start: [number, number],
  end: [number, number],
  type: string
): [number, number][] {
  const steps = 12;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let lng = start[0] + (end[0] - start[0]) * t;
    let lat = start[1] + (end[1] - start[1]) * t;

    // Bow coordinates to differentiate paths
    if (i > 0 && i < steps) {
      const curveOffset = Math.sin(t * Math.PI);
      if (type === "cleanest_air") {
        lng += (end[1] - start[1]) * 0.18 * curveOffset;
        lat -= (end[0] - start[0]) * 0.18 * curveOffset;
      } else if (type === "lowest_carbon") {
        lng -= (end[1] - start[1]) * 0.12 * curveOffset;
        lat += (end[0] - start[0]) * 0.12 * curveOffset;
      } else {
        // Fastest has minor zig-zag offsets
        lng += Math.sin(i) * 0.0015 * curveOffset;
        lat += Math.cos(i) * 0.0015 * curveOffset;
      }
    }
    pts.push([lng, lat]);
  }
  return pts;
}

function MapPage() {
  const navigate = useNavigate();
  const mapRef = useRef<MapRef>(null);

  // Map settings
  const selectedStyle = OPEN_STREET_3D_STYLE;

  // Location/Directions state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [originText, setOriginText] = useState("My Location");
  const [destText, setDestText] = useState("");
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);

  // Suggestion boxes
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [isRoutingMode, setIsRoutingMode] = useState(false);
  const [isDirectionsExpanded, setIsDirectionsExpanded] = useState(false);

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
  const [routeType, setRouteType] = useState<"fastest" | "cleanest_air" | "lowest_carbon">("cleanest_air");

  // Navigation Simulation States
  const [isNavigating, setIsNavigating] = useState(false);
  const [navProgress, setNavProgress] = useState(0);
  const [navPath, setNavPath] = useState<[number, number][]>([]);
  const [currentNavCoords, setCurrentNavCoords] = useState<[number, number] | null>(null);
  const [simulatedAqi, setSimulatedAqi] = useState(48);
  const [showSpikeAlert, setShowSpikeAlert] = useState(false);
  const [tripCompleted, setTripCompleted] = useState(false);

  // Dynamic layers state
  const [layerOpen, setLayerOpen] = useState(false);
  const [activeLayers, setActiveLayers] = useState({
    air: true,
    carbon: false,
    heat: false,
    green: false,
    noise: false,
  });

  // Request location on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          setUserLocation(coords);
          setOriginCoords(coords);
          // Fly map to user location
          mapRef.current?.flyTo({ center: coords, zoom: 14, duration: 1500 });
        },
        (err) => {
          console.warn("Geolocation permission denied/failed. Defaulting to Bengaluru.", err);
          const fallback: [number, number] = [77.5946, 12.9716];
          setUserLocation(fallback);
          setOriginCoords(fallback);
        }
      );
    } else {
      const fallback: [number, number] = [77.5946, 12.9716];
      setUserLocation(fallback);
      setOriginCoords(fallback);
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

  // Generate paths once coordinates are resolved
  const startPt = originCoords || userLocation || [77.5946, 12.9716];
  const endPt = destCoords;

  const paths = {
    fastest: endPt ? generateRoutePoints(startPt, endPt, "fastest") : [],
    cleanest_air: endPt ? generateRoutePoints(startPt, endPt, "cleanest_air") : [],
    lowest_carbon: endPt ? generateRoutePoints(startPt, endPt, "lowest_carbon") : [],
  };

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
      setIsDirectionsExpanded(true);
      mapRef.current?.flyTo({ center: item.coords, zoom: 13, duration: 1200 });
    }
  };

  // Start navigation simulation
  const startNav = () => {
    const selectedPath = paths[routeType];
    if (selectedPath.length === 0) return;

    setNavPath(selectedPath);
    setNavProgress(0);
    setCurrentNavCoords(selectedPath[0]);
    setIsNavigating(true);
    setTripCompleted(false);
    setShowSpikeAlert(false);

    mapRef.current?.flyTo({
      center: selectedPath[0],
      zoom: 16,
      pitch: 50,
      duration: 1000,
    });
  };

  // Simulated movement hook
  useEffect(() => {
    if (!isNavigating || tripCompleted || navPath.length === 0) return;

    const interval = setInterval(() => {
      setNavProgress((prevProgress) => {
        const nextProgress = prevProgress + 1;
        if (nextProgress >= navPath.length) {
          clearInterval(interval);
          setTripCompleted(true);
          return prevProgress;
        }

        const nextCoords = navPath[nextProgress];
        setCurrentNavCoords(nextCoords);
        mapRef.current?.easeTo({
          center: nextCoords,
          zoom: 16.5,
          duration: 1000,
        });

        // AQI values updates
        let baseAqi = 40 + Math.floor(Math.random() * 20);
        if (routeType === "fastest") {
          baseAqi += 65; // higher pollution on highways/fastest route
        } else if (routeType === "lowest_carbon") {
          baseAqi += 15;
        }
        setSimulatedAqi(baseAqi);

        // Simulated Spike Alert on Fastest route at progress point 4
        if (routeType === "fastest" && nextProgress === 4) {
          setShowSpikeAlert(true);
        }

        return nextProgress;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isNavigating, tripCompleted, navPath, routeType]);

  // Reroute simulation
  const acceptReroute = () => {
    setShowSpikeAlert(false);
    setRouteType("cleanest_air");

    if (currentNavCoords && destCoords) {
      // Recalculate remaining path from current position using Cleanest Air route logic
      const remainingPoints = generateRoutePoints(currentNavCoords, destCoords, "cleanest_air");
      setNavPath(remainingPoints);
      setNavProgress(0);
    }
  };

  // Exit navigation
  const exitNavigation = () => {
    setIsNavigating(false);
    setTripCompleted(false);
    setShowSpikeAlert(false);
    mapRef.current?.easeTo({ pitch: 60, zoom: 14, duration: 1000 });
  };

  // Route metrics (mock matching routes list)
  const routeOptions = [
    {
      id: "cleanest_air",
      label: "Cleanest Air",
      duration: 17,
      pm25: 110,
      co2: 180,
      ecoscore: 87,
      color: "bg-eco-green",
      lineColor: "#22c55e",
      recommended: true,
    },
    {
      id: "lowest_carbon",
      label: "Lowest Carbon",
      duration: 16,
      pm25: 210,
      co2: 60,
      ecoscore: 71,
      color: "bg-eco-blue",
      lineColor: "#3b82f6",
      recommended: false,
    },
    {
      id: "fastest",
      label: "Fastest",
      duration: 14,
      pm25: 340,
      co2: 180,
      ecoscore: 42,
      color: "bg-muted-foreground/40",
      lineColor: "#94a3b8",
      recommended: false,
    },
  ];

  return (
    <MobileShell>
      <div className="relative h-[calc(100vh-6rem)] overflow-hidden bg-background">
        {/* Real Map Component */}
        <Map
          ref={mapRef}
          center={userLocation || [77.5946, 12.9716]}
          zoom={13}
          pitch={60}
          className="h-full w-full"
          styles={{
            light: selectedStyle,
            dark: selectedStyle,
          }}
        >
          {/* User live location marker */}
          {userLocation && !isNavigating && (
            <MapMarker longitude={userLocation[0]} latitude={userLocation[1]}>
              <MarkerContent>
                <span className="relative flex h-6 w-6 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-eco-blue/20 pulse-ring" />
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
                  <span className="absolute inset-0 rounded-full bg-eco-orange/30 pulse-ring" />
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-eco-orange text-background shadow-md">
                    <Navigation className="h-3 w-3 fill-current" />
                  </span>
                </span>
              </MarkerContent>
            </MapMarker>
          )}

          {/* Display Route Paths */}
          {isRoutingMode && endPt && !isNavigating && (
            <>
              <MapRoute
                id="fastest-path"
                coordinates={paths.fastest}
                color={routeType === "fastest" ? "#94a3b8" : "#475569"}
                width={routeType === "fastest" ? 6 : 4}
                opacity={routeType === "fastest" ? 1.0 : 0.4}
                onClick={() => setRouteType("fastest")}
              />
              <MapRoute
                id="cleanest-path"
                coordinates={paths.cleanest_air}
                color={routeType === "cleanest_air" ? "#22c55e" : "#166534"}
                width={routeType === "cleanest_air" ? 7 : 4}
                opacity={routeType === "cleanest_air" ? 1.0 : 0.4}
                onClick={() => setRouteType("cleanest_air")}
              />
              <MapRoute
                id="lowest-carbon-path"
                coordinates={paths.lowest_carbon}
                color={routeType === "lowest_carbon" ? "#3b82f6" : "#1e40af"}
                width={routeType === "lowest_carbon" ? 6 : 4}
                opacity={routeType === "lowest_carbon" ? 1.0 : 0.4}
                onClick={() => setRouteType("lowest_carbon")}
              />
            </>
          )}

          {/* Display Navigating Active Path */}
          {isNavigating && navPath.length > 0 && (
            <MapRoute
              id="active-nav-path"
              coordinates={navPath}
              color={routeType === "cleanest_air" ? "#22c55e" : routeType === "lowest_carbon" ? "#3b82f6" : "#94a3b8"}
              width={7}
              opacity={0.9}
            />
          )}
        </Map>

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
                    onFocus={() => {
                      setIsDirectionsExpanded(true);
                      setShowDestSuggestions(true);
                    }}
                    placeholder="Where are you going?"
                    className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  {destText && (
                    <button
                      onClick={() => {
                        setDestText("");
                        setDestCoords(null);
                        setIsRoutingMode(false);
                      }}
                      className="text-muted-foreground hover:text-foreground"
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
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="font-semibold text-xs text-foreground font-mono">Plan EcoRoute</span>
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

            {/* Quick Floating Map Utilities */}
            <div className="absolute right-4 top-24 z-10 flex flex-col gap-3">
              {/* Geolocation FAB */}
              <button
                onClick={handleLocateMe}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card/85 text-foreground shadow-lg backdrop-blur-md transition-transform active:scale-95 hover:bg-card"
                title="Geolocate Live Position"
              >
                <Crosshair className="h-5 w-5 text-eco-blue" />
              </button>

              {/* Layer Panel Trigger */}
              <button
                onClick={() => setLayerOpen(!layerOpen)}
                className={`flex h-12 w-12 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-transform active:scale-95 ${
                  layerOpen ? "border-eco-orange bg-eco-orange text-background glow-orange" : "border-border bg-card/85 text-foreground"
                }`}
                title="Toggle Environment Overlays"
              >
                <Layers className="h-5 w-5" />
              </button>

              {/* AR HUD Shortcut */}
              <Link
                to="/ar"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-eco-orange bg-eco-orange text-background shadow-lg glow-orange transition-transform active:scale-95"
                title="AR Environmental Overlay"
              >
                <ScanLine className="h-5 w-5" />
              </Link>
            </div>


            {/* Environment Overlay Sub-Panel */}
            {layerOpen && (
              <div className="absolute right-4 top-60 z-10 w-44 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Eco Overlays</div>
                <div className="flex flex-col gap-2">
                  {Object.entries({
                    air: { label: "Air Quality (PM2.5)", color: "text-eco-green" },
                    carbon: { label: "Carbon Load", color: "text-eco-blue" },
                    heat: { label: "Urban Heat", color: "text-eco-orange" },
                    green: { label: "Green Cover", color: "text-green-500" },
                    noise: { label: "Noise Level", color: "text-purple-400" },
                  }).map(([key, info]) => (
                    <label key={key} className="flex cursor-pointer items-center justify-between text-xs">
                      <span className={info.color}>{info.label}</span>
                      <input
                        type="checkbox"
                        checked={activeLayers[key as keyof typeof activeLayers]}
                        onChange={(e) =>
                          setActiveLayers((prev) => ({
                            ...prev,
                            [key]: e.target.checked,
                          }))
                        }
                        className="accent-eco-orange cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* BOTTOM SHEET: Routes list overlay if destination selected */}
            {isRoutingMode && endPt && (
              <div className="absolute inset-x-4 bottom-3 z-10 max-h-[45%] overflow-y-auto rounded-3xl border border-border bg-card/90 p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <h3 className="text-sm font-bold">Recommended Routes</h3>
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">SDG 11 / 13 Route Optimization</span>
                </div>

                <div className="flex flex-col gap-2">
                  {routeOptions.map((opt) => {
                    const active = routeType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setRouteType(opt.id as any)}
                        className={`flex flex-col gap-2 rounded-2xl border p-3 text-left transition-all ${
                          active ? "border-eco-green bg-background/80 shadow-md" : "border-border/60 bg-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{opt.label}</span>
                            {opt.recommended && (
                              <span className="rounded-full bg-eco-green/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-eco-green">
                                Recommended
                              </span>
                            )}
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                              opt.ecoscore >= 70 ? "bg-eco-green/10 text-eco-green" : "bg-eco-orange/10 text-eco-orange"
                            }`}
                          >
                            EcoScore: {opt.ecoscore}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                          <div>⏱️ {opt.duration} mins · 🗺️ 3.5 km</div>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-0.5"><Leaf className="h-3 w-3 text-eco-green" /> {opt.pm25}µg PM2.5</span>
                            <span className="flex items-center gap-0.5"><Award className="h-3 w-3 text-eco-blue" /> {opt.co2}g CO₂</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={startNav}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-eco-orange py-3.5 text-sm font-semibold text-background transition-transform active:scale-[0.98] shadow-lg shadow-eco-orange/20"
                >
                  <Navigation className="h-4 w-4 fill-current" /> Start Navigation
                </button>
              </div>
            )}

            {/* Static default legend if not routing */}
            {!isRoutingMode && (
              <>
                <div className="absolute bottom-32 right-4 z-10 rounded-2xl border border-border bg-card/80 px-4 py-3 backdrop-blur shadow-md flex flex-col gap-1">
                  <div className="flex items-center gap-2 py-0.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-eco-red/70" />
                    <span className="font-mono text-[9px] uppercase tracking-wider">High Risk</span>
                  </div>
                  <div className="flex items-center gap-2 py-0.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-eco-orange" />
                    <span className="font-mono text-[9px] uppercase tracking-wider">Moderate</span>
                  </div>
                  <div className="flex items-center gap-2 py-0.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-eco-green" />
                    <span className="font-mono text-[9px] uppercase tracking-wider">Clean Corridor</span>
                  </div>
                </div>

                {/* Bottom info strip */}
                <div className="absolute inset-x-4 bottom-3 z-10 flex items-center gap-3 rounded-2xl border border-border bg-card/85 px-4 py-3 backdrop-blur-md shadow-lg">
                  <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-eco-green/15">
                    <span className="absolute inset-0 rounded-full pulse-ring" />
                    <Leaf className="h-5 w-5 text-eco-green" />
                  </span>
                  <div className="flex-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      Current Location Quality
                    </div>
                    <div className="text-xs font-semibold">
                      <span className="text-eco-green">84 EcoScore</span>
                      <span className="text-muted-foreground"> · AQI: Moderate</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ==================== ACTIVE NAVIGATION HUD OVERLAYS ==================== */}
        {isNavigating && (
          <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            
            {/* Top directions instruction card */}
            <div className="w-full rounded-2xl border border-border bg-card/90 p-4 shadow-xl backdrop-blur-md pointer-events-auto flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-eco-orange text-background">
                {navProgress < 3 ? (
                  <Navigation className="h-5 w-5 fill-current rotate-45" />
                ) : navProgress < 7 ? (
                  <Navigation className="h-5 w-5 fill-current -rotate-45" />
                ) : (
                  <MapPin className="h-5 w-5" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Upcoming turn</span>
                <div className="text-xs font-semibold leading-tight text-foreground truncate">
                  {navProgress < 3
                    ? "In 300m, turn left onto Cubbon Rd"
                    : navProgress < 7
                      ? "In 500m, keep right toward Residency Rd"
                      : "Proceed to destination"}
                </div>
              </div>
              <button
                onClick={exitNavigation}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background hover:bg-card text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Simulated mid-route environmental hazard spike alert */}
            {showSpikeAlert && (
              <div className="mx-auto max-w-sm rounded-2xl bg-eco-red p-4 text-eco-cream shadow-2xl pointer-events-auto flex flex-col gap-3 animate-bounce">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                  <div>
                    <h4 className="text-xs font-bold font-mono">POLLUTION WARNING</h4>
                    <p className="mt-1 text-[11px] leading-snug">
                      High PM2.5 levels detected ahead on Fastest Route. Tap to switch to the Cleanest Air detour.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowSpikeAlert(false)}
                    className="rounded-lg border border-eco-cream/40 bg-transparent px-3 py-1.5 font-mono text-[10px] font-semibold text-eco-cream/80 hover:bg-white/10"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={acceptReroute}
                    className="rounded-lg bg-eco-cream px-3 py-1.5 font-mono text-[10px] font-bold text-eco-red shadow hover:bg-white"
                  >
                    Reroute (+3 mins)
                  </button>
                </div>
              </div>
            )}

            {/* Bottom active HUD sheet */}
            <div className="w-full rounded-2xl border border-border bg-card/90 p-4 shadow-xl backdrop-blur-md pointer-events-auto flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-eco-orange animate-pulse">● Navigating</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{routeType.replace("_", " ").toUpperCase()}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${
                  simulatedAqi <= 50 ? "bg-eco-green/10 text-eco-green" : simulatedAqi <= 100 ? "bg-eco-orange/10 text-eco-orange" : "bg-eco-red/10 text-eco-red"
                }`}>
                  Live Segment AQI: {simulatedAqi}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-foreground">
                    {Math.max(1, Math.ceil((12 * (navPath.length - navProgress)) / navPath.length))} mins remaining
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground uppercase">
                    {(3.5 * (1 - navProgress / navPath.length)).toFixed(1)} km left
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Eco Protection</div>
                  <div className="flex items-center gap-1 text-xs font-bold text-eco-green">
                    <Leaf className="h-4 w-4" /> Avoided {routeType === "cleanest_air" ? "430 µg" : "120 µg"}
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
                  <span className="text-lg font-bold text-eco-green">88</span>
                  <span className="font-mono text-[9px] uppercase text-muted-foreground">EcoScore</span>
                </div>
                <div className="flex flex-col items-center border-x border-border">
                  <span className="text-lg font-bold text-eco-green">430µg</span>
                  <span className="font-mono text-[9px] uppercase text-muted-foreground">PM2.5 Saved</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-eco-blue">120g</span>
                  <span className="font-mono text-[9px] uppercase text-muted-foreground">CO₂ Saved</span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Fantastic job! By taking the {routeType.replace("_", " ")} route, you successfully avoided inhaling harmful micro-pollutants and reduced your carbon output.
              </p>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => {
                    setTripCompleted(false);
                    setIsNavigating(false);
                    // Add trip to dashboard mock metrics
                    localStorage.setItem("ecolens:lastTripAvoided", "430");
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


