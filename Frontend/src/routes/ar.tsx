import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Map, AlertTriangle, Leaf, Camera, Navigation, MapPin, CheckCircle, Award, X } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { useState, useEffect, useRef } from "react";

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

export const Route = createFileRoute("/ar")({
  head: () => ({ meta: [{ title: "AR Mode · EcoLens" }] }),
  component: ARPage,
});

interface Detection {
  id: string;
  type: string;
  emission: string;
  color: string;
  x: number;
  y: number;
  timestamp: number;
}

function ARPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 12.9716, lng: 77.5946 });

  // Synchronously load saved navigation state on initialization (client-only)
  const [navState, setNavState] = useState<any>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ecolens:navigation_state");
      if (saved) setNavState(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  // Dynamic HUD stats
  const [hudStats, setHudStats] = useState({
    aqi: 55,
    pm25: 36,
    co2: "Normal",
    co2Tone: "text-eco-green",
  });

  // Dynamic vehicle detections
  const [detections, setDetections] = useState<Detection[]>([]);

  // Geolocation lookup
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => console.log("Geolocation error in AR:", err)
      );
    }
  }, []);

  // Simulated movement hook inside AR view
  useEffect(() => {
    if (!navState || !navState.isNavigating || navState.tripCompleted || !navState.navPath || navState.navPath.length === 0) return;

    const interval = setInterval(() => {
      setNavState((prev: any) => {
        if (!prev) return null;
        const nextProgress = (prev.navProgress ?? 0) + 1;
        if (nextProgress >= prev.navPath.length) {
          clearInterval(interval);
          const updated = {
            ...prev,
            tripCompleted: true,
          };
          localStorage.setItem("ecolens:navigation_state", JSON.stringify(updated));
          return updated;
        }

        const nextCoords = prev.navPath[nextProgress];

        // AQI values updates
        let baseAqi = 40 + Math.floor(Math.random() * 20);
        if (prev.routeType === "fastest") {
          baseAqi += 65; // higher pollution on highways/fastest route
        } else if (prev.routeType === "lowest_carbon") {
          baseAqi += 15;
        }

        const updated = {
          ...prev,
          navProgress: nextProgress,
          currentNavCoords: nextCoords,
          simulatedAqi: baseAqi,
        };
        localStorage.setItem("ecolens:navigation_state", JSON.stringify(updated));
        return updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [navState?.isNavigating, navState?.tripCompleted, navState?.navPath?.length]);

  // Sync HUD stats with the active navigation segment simulated AQI
  useEffect(() => {
    if (navState && navState.isNavigating && !navState.tripCompleted) {
      const pm25Val = Math.round(navState.simulatedAqi / 1.5);
      const co2Level = navState.simulatedAqi > 100 ? "High" : navState.simulatedAqi > 60 ? "Medium" : "Normal";
      const co2Color = co2Level === "High" ? "text-eco-orange" : co2Level === "Medium" ? "text-eco-blue" : "text-eco-green";

      setHudStats({
        aqi: navState.simulatedAqi,
        pm25: pm25Val,
        co2: co2Level,
        co2Tone: co2Color,
      });
    }
  }, [navState?.simulatedAqi, navState?.isNavigating, navState?.tripCompleted]);

  const endRoute = () => {
    localStorage.removeItem("ecolens:navigation_state");
    setNavState(null);
  };

  const startNav = () => {
    if (!navState || !Array.isArray(navState.navPath)) return;
    const selectedPath = navState.navPath;

    if (selectedPath.length === 0) return;

    const updated = {
      ...navState,
      navPath: selectedPath,
      navProgress: 0,
      currentNavCoords: selectedPath[0],
      isNavigating: true,
      tripCompleted: false,
      simulatedAqi: 48,
    };
    localStorage.setItem("ecolens:navigation_state", JSON.stringify(updated));
    setNavState(updated);
  };

  // Request camera and setup video stream
  const startCamera = async () => {
    try {
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      
      setVideoStream(stream);
      setPermissionState("granted");
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setPermissionState("denied");
    }
  };

  useEffect(() => {
    startCamera();
    
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Ensure video element plays when stream is assigned
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  // Capture frame as base64 JPEG
  const captureFrame = (): string | null => {
    if (!videoRef.current || !videoStream) return null;
    const video = videoRef.current;
    
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  };

  // Periodic frame scanning hook
  useEffect(() => {
    if (permissionState !== "granted" || !videoStream) return;

    const interval = setInterval(async () => {
      const frameData = captureFrame();
      if (!frameData) return;

      setIsScanning(true);
      
      try {
        const response = await fetch("/api/vision/detect", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("ecolens:auth") || "demo"}`,
          },
          body: JSON.stringify({
            image_base64: frameData,
            user_lat: coords.lat,
            user_lng: coords.lng,
          }),
        });

        if (!response.ok) throw new Error("API scan failed");
        
        const data = await response.json();
        
        const adjustment = data.local_pm25_adjustment || 0;
        const pm25Val = Math.round(36 + adjustment);
        const aqiVal = Math.round(pm25Val * 1.5);
        const dominant = data.dominant_emission || "low";
        const co2Level = dominant === "high" ? "High" : dominant === "medium" ? "Medium" : "Normal";
        const co2Color = co2Level === "High" ? "text-eco-orange" : co2Level === "Medium" ? "text-eco-blue" : "text-eco-green";

        setHudStats({
          aqi: aqiVal,
          pm25: pm25Val,
          co2: co2Level,
          co2Tone: co2Color,
        });

        const newDetections = (data.detections || []).map((det: any, idx: number) => {
          const emission = det.emission_level || "low";
          const colors = { high: "#EF4444", medium: "#F97316", low: "#22C55E" };
          return {
            id: `${Date.now()}-${idx}`,
            type: det.vehicle_type ? det.vehicle_type.replace("_", " ") : "Vehicle",
            emission: emission,
            color: det.colour || colors[emission as keyof typeof colors],
            x: 20 + Math.random() * 60,
            y: 35 + Math.random() * 30,
            timestamp: Date.now(),
          };
        });

        setDetections((prev) => {
          const now = Date.now();
          const active = prev.filter((d) => now - d.timestamp < 3000);
          return [...active, ...newDetections];
        });
      } catch (err) {
        console.warn("AR scan failed:", err);
      } finally {
        setIsScanning(false);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [permissionState, videoStream, coords]);

  // Cleanup loop to fade out detections after 3 seconds
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setDetections((prev) => {
        const active = prev.filter((d) => now - d.timestamp < 3000);
        if (active.length !== prev.length) {
          return active;
        }
        return prev;
      });
    }, 250);

    return () => clearInterval(cleanup);
  }, []);

  return (
    <MobileShell>
      <div className="relative h-dvh min-h-[480px] overflow-hidden bg-background">
        {/* Live Camera Feed */}
        {permissionState === "granted" && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover z-0"
          />
        )}

        {/* Camera unavailable background */}
        {permissionState !== "granted" && (
          <div className="absolute inset-0 bg-gradient-to-b from-background to-eco-green/10 z-0" />
        )}

        {/* Scanning Sweep Line */}
        {permissionState === "granted" && isScanning && (
          <div className="pointer-events-none absolute inset-x-0 h-1 bg-eco-orange/50 shadow-[0_0_15px_var(--eco-orange)] animate-[sweep_2s_infinite_ease-in-out] z-10" />
        )}

        {/* Permission Error overlay */}
        {permissionState === "denied" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-background/90 backdrop-blur-sm">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-2xl max-w-xs flex flex-col gap-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-eco-red/10 text-eco-red">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Camera Access Required</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  EcoLens AR Mode overlays environmental intelligence onto your physical environment. Please allow camera access to scan your street segment.
                </p>
              </div>
              <button
                onClick={startCamera}
                className="rounded-2xl bg-eco-orange py-3 text-sm font-semibold text-background hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Camera className="h-4 w-4" /> Enable Camera
              </button>
            </div>
          </div>
        )}

        {/* Top HUD */}
        <div className="absolute inset-x-0 top-0 z-10 px-4 pt-[max(1rem,env(safe-area-inset-top))] pointer-events-none">
          <div className="flex items-center justify-between pointer-events-auto">
            <Link to="/map" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/70 backdrop-blur">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card/70 p-3 backdrop-blur pointer-events-auto relative">
            {isScanning && (
              <div className="absolute top-1 right-2.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-eco-orange animate-pulse" />
                <span className="font-mono text-[7px] text-eco-orange uppercase tracking-widest">Scanning</span>
              </div>
            )}
            <HudStat label="AQI" value={`${hudStats.aqi}`} tone={hudStats.aqi > 100 ? "text-eco-orange" : "text-eco-green"} />
            <HudStat label="PM2.5" value={`${hudStats.pm25} µg`} />
            <HudStat label="CO₂" value={hudStats.co2} tone={hudStats.co2Tone} />
          </div>
        </div>

        {/* Dynamic environmental context overlay badges */}
        {hudStats.pm25 > 50 ? (
          <div className="absolute left-6 top-1/4 rounded-xl border border-border bg-card/85 p-3.5 backdrop-blur z-10 animate-in fade-in slide-in-from-left duration-500 max-w-[140px] pointer-events-none">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-eco-orange shrink-0 animate-pulse" />
              <div>
                <div className="font-mono text-[11px] font-bold">Carbon: High</div>
                <div className="font-mono text-[9px] text-muted-foreground leading-tight mt-0.5">Heavy Traffic Corridor</div>
              </div>
            </div>
            <div className="absolute left-1/2 top-full h-12 w-px bg-eco-orange/50" />
            <div className="absolute left-1/2 top-[calc(100%+3rem)] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-eco-orange shadow-[0_0_12px_var(--eco-orange)] animate-ping" />
          </div>
        ) : (
          <div className="absolute left-6 top-1/4 rounded-xl border border-border bg-card/85 p-3.5 backdrop-blur z-10 animate-in fade-in slide-in-from-left duration-500 max-w-[140px] pointer-events-none">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-eco-green shrink-0" />
              <div>
                <div className="font-mono text-[11px] font-bold text-eco-green">AQI: Safe</div>
                <div className="font-mono text-[9px] text-muted-foreground leading-tight mt-0.5">Green Canopy corridor</div>
              </div>
            </div>
            <div className="absolute left-1/2 top-full h-12 w-px bg-eco-green/50" />
            <div className="absolute left-1/2 top-[calc(100%+3rem)] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-eco-green shadow-[0_0_12px_var(--eco-green)]" />
          </div>
        )}

        {hudStats.co2 === "High" ? (
          <div className="absolute right-6 top-[40%] rounded-xl border border-border bg-card/85 p-3.5 backdrop-blur z-10 animate-in fade-in slide-in-from-right duration-500 max-w-[140px] pointer-events-none">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-eco-red shrink-0" />
              <div>
                <div className="font-mono text-[11px] font-bold text-eco-red">Alert: Hotspot</div>
                <div className="font-mono text-[9px] text-muted-foreground leading-tight mt-0.5">High particulate density</div>
              </div>
            </div>
            <div className="absolute left-1/2 top-full h-16 w-px bg-eco-red/50" />
            <div className="absolute left-1/2 top-[calc(100%+4rem)] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-eco-red shadow-[0_0_12px_var(--eco-red)]" />
          </div>
        ) : (
          <div className="absolute right-6 top-[40%] rounded-xl border border-border bg-card/85 p-3.5 backdrop-blur z-10 animate-in fade-in slide-in-from-right duration-500 max-w-[140px] pointer-events-none">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-eco-blue shrink-0" />
              <div>
                <div className="font-mono text-[11px] font-bold">CO₂: Low</div>
                <div className="font-mono text-[9px] text-muted-foreground leading-tight mt-0.5">Suburban residential sector</div>
              </div>
            </div>
            <div className="absolute left-1/2 top-full h-16 w-px bg-eco-blue/50" />
            <div className="absolute left-1/2 top-[calc(100%+4rem)] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-eco-blue shadow-[0_0_12px_var(--eco-blue)]" />
          </div>
        )}

        {/* Dynamic vehicle detection bubbles */}
        {permissionState === "granted" &&
          detections.map((det) => (
            <div
              key={det.id}
              style={{
                left: `${det.x}%`,
                top: `${det.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              className="absolute z-10 rounded-2xl border border-border bg-card/85 p-3 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center pointer-events-none min-w-[110px]"
            >
              <div
                style={{ boxShadow: `0 0 15px 3px ${det.color}33` }}
                className="absolute inset-0 rounded-2xl pointer-events-none border border-white/5"
              />
              <div className="flex items-center gap-2">
                <span
                  style={{ backgroundColor: det.color }}
                  className="h-2 w-2 rounded-full animate-ping shrink-0"
                />
                <div className="text-center flex-1">
                  <div className="font-mono text-[10px] font-bold text-eco-cream uppercase tracking-wide leading-tight">
                    {det.type}
                  </div>
                  <div className="font-mono text-[8px] text-muted-foreground mt-0.5 leading-none">
                    Emission: <span style={{ color: det.color }} className="font-bold">{det.emission.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

        {/* Glowing path — Google Maps-style traffic: green=safe, orange=moderate, red=hazardous */}
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
          {navState && navState.isNavigating && (
            <span className="mb-2 font-mono text-[8px] uppercase tracking-wider text-muted-foreground animate-pulse">
              AR Path Guidance
            </span>
          )}
          {(() => {
            // Determine traffic colour from live AQI (mirrors Google Maps traffic logic)
            const aqi = navState?.isNavigating ? (navState.simulatedAqi ?? hudStats.aqi) : hudStats.aqi;
            let pathColor = "eco-cream/40";
            let glowColor = "none";
            if (navState?.isNavigating) {
              if (aqi <= 50) {
                pathColor = "eco-green";
                glowColor = "0 0 15px 3px rgba(34, 197, 94, 0.55)";
              } else if (aqi <= 100) {
                pathColor = "eco-orange";
                glowColor = "0 0 15px 3px rgba(249, 115, 22, 0.55)";
              } else {
                pathColor = "eco-red";
                glowColor = "0 0 15px 3px rgba(239, 68, 68, 0.55)";
              }
            }
            return (
              <div
                style={{ boxShadow: glowColor }}
                className={`h-36 w-1.5 rounded-full bg-gradient-to-t from-${pathColor} to-transparent transition-all duration-700`}
              />
            );
          })()}
        </div>

        {/* Navigation bottom card or routing card */}
        {navState && navState.destCoords && (
          <div className="absolute inset-x-4 bottom-3 z-10 flex flex-col gap-3">
            {!navState.isNavigating ? (
              /* ROUTE PREVIEW MODE CARD */
              <div className="rounded-3xl border border-border bg-card/90 p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <h3 className="text-xs font-bold text-foreground">Active Route Shared</h3>
                  <span className="font-mono text-[9px] text-muted-foreground uppercase">
                    {navState.routeType.replace("_", " ").toUpperCase()}
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold truncate max-w-[180px] text-foreground">
                      To: {navState.destText || "Selected Destination"}
                    </span>
                    <span className="rounded-full bg-eco-green/10 px-2 py-0.5 font-mono text-[9px] font-bold text-eco-green">
                      EcoRoute Preview
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                    <div>⏱️ 17 mins · 🗺️ 3.5 km</div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5">
                        <Leaf className="h-3 w-3 text-eco-green" /> 110µg
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Award className="h-3 w-3 text-eco-blue" /> 180g
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-1">
                  <button
                    onClick={endRoute}
                    className="flex-1 rounded-2xl border border-border bg-background/50 py-3 text-xs font-semibold text-muted-foreground hover:bg-card active:scale-[0.98] transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startNav}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-eco-orange py-3 text-xs font-semibold text-background hover:brightness-105 active:scale-[0.98] transition-transform shadow-lg shadow-eco-orange/20"
                  >
                    <Navigation className="h-3.5 w-3.5 fill-current" /> Start Navigation
                  </button>
                </div>
              </div>
            ) : (
              /* ACTIVE NAVIGATION HUD */
              <div className="rounded-3xl border border-border bg-card/90 p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3 pointer-events-auto">
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-eco-orange animate-pulse">
                      ● AR Navigation
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {navState.routeType.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${
                    hudStats.aqi <= 50 ? "bg-eco-green/10 text-eco-green" : hudStats.aqi <= 100 ? "bg-eco-orange/10 text-eco-orange" : "bg-eco-red/10 text-eco-red"
                  }`}>
                    Live AQI: {hudStats.aqi}
                  </span>
                </div>

                {/* Turn instruction */}
                {(() => {
                  const direction = getDirectionsInstruction(navState.navProgress, navState.navPath.length);
                  return (
                    <div className="flex items-center gap-3 py-1">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-eco-orange text-background">
                        {direction.type === "right" ? (
                          <Navigation className="h-4.5 w-4.5 fill-current rotate-90" />
                        ) : direction.type === "left" ? (
                          <Navigation className="h-4.5 w-4.5 fill-current -rotate-90" />
                        ) : direction.type === "arrive" ? (
                          <MapPin className="h-4.5 w-4.5" />
                        ) : (
                          <Navigation className="h-4.5 w-4.5 fill-current" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
                          Upcoming guidance
                        </span>
                        <div className="text-xs font-semibold leading-tight text-foreground truncate">
                          {direction.text}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between mt-1.5">
                  <div>
                    <div className="text-base font-bold text-foreground">
                      {Math.max(1, Math.ceil((12 * (navState.navPath.length - navState.navProgress)) / navState.navPath.length))} mins left
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground uppercase">
                      {(3.5 * (1 - navState.navProgress / navState.navPath.length)).toFixed(1)} km remaining
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <div className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
                      PM2.5 Avoided
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-eco-green">
                      <Leaf className="h-3.5 w-3.5" /> {navState.routeType === "cleanest_air" ? "430 µg" : "120 µg"}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="relative h-1.5 w-full rounded-full bg-border/50 overflow-hidden mt-1">
                  <div
                    className="h-full bg-eco-orange transition-all duration-1000"
                    style={{ width: `${(navState.navProgress / navState.navPath.length) * 100}%` }}
                  />
                </div>

                <button
                  onClick={endRoute}
                  className="w-full rounded-2xl bg-eco-red/20 border border-eco-red/30 py-3.5 text-xs font-bold text-eco-red hover:bg-eco-red/30 active:scale-[0.98] transition-all mt-1"
                >
                  End Route
                </button>
              </div>
            )}
          </div>
        )}

        {/* TRIP SUMMARY COMPLETION MODAL */}
        {navState && navState.tripCompleted && (
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
                Fantastic job! By taking the {navState.routeType.replace("_", " ")} route, you successfully avoided inhaling harmful micro-pollutants and reduced your carbon output.
              </p>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => {
                    localStorage.removeItem("ecolens:navigation_state");
                    setNavState(null);
                    localStorage.setItem("ecolens:lastTripAvoided", "430");
                  }}
                  className="flex-1 rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-foreground hover:bg-card"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem("ecolens:navigation_state");
                    setNavState(null);
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

        <style suppressHydrationWarning>{`
          @keyframes sweep {
            0% { top: 0%; opacity: 0; }
            15% { opacity: 1; }
            85% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
        `}</style>
      </div>
    </MobileShell>
  );
}

function HudStat({ label, value, tone = "text-eco-cream" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-3 text-center">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}
