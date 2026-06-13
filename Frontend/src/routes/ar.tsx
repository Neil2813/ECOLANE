import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Map, AlertTriangle, Leaf, Camera } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { useState, useEffect, useRef } from "react";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 12.9716, lng: 77.5946 });

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

  // Local simulation fallback
  const runSimulation = () => {
    const vehicleTypes = ["Bus", "Auto Rickshaw", "Motorcycle", "Car", "Bicycle"];
    const emissionLevels = ["high", "medium", "low"];
    const colors = { high: "#EF4444", medium: "#F97316", low: "#22C55E" };

    const count = 1 + Math.floor(Math.random() * 2);
    const mockDetections: Detection[] = [];
    let dominant = "low";
    let adjustment = 0;

    for (let i = 0; i < count; i++) {
      const type = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
      const emission = emissionLevels[Math.floor(Math.random() * emissionLevels.length)];
      
      if (emission === "high") {
        dominant = "high";
        adjustment += 15 + Math.random() * 10;
      } else if (emission === "medium" && dominant !== "high") {
        dominant = "medium";
        adjustment += 6 + Math.random() * 6;
      } else if (emission === "low" && dominant === "low") {
        adjustment += 1 + Math.random() * 2;
      }
      
      mockDetections.push({
        id: `${Date.now()}-${i}`,
        type: type,
        emission: emission,
        color: colors[emission as keyof typeof colors],
        x: 20 + Math.random() * 60,
        y: 35 + Math.random() * 30,
        timestamp: Date.now(),
      });
    }

    const pm25Val = Math.round(36 + adjustment);
    const aqiVal = Math.round(pm25Val * 1.5);
    const co2Level = dominant === "high" ? "High" : dominant === "medium" ? "Medium" : "Normal";
    const co2Color = co2Level === "High" ? "text-eco-orange" : co2Level === "Medium" ? "text-eco-blue" : "text-eco-green";

    setHudStats({
      aqi: aqiVal,
      pm25: pm25Val,
      co2: co2Level,
      co2Tone: co2Color,
    });

    setDetections((prev) => {
      const now = Date.now();
      const active = prev.filter((d) => now - d.timestamp < 3000);
      return [...active, ...mockDetections];
    });
  };

  // Periodic frame scanning hook
  useEffect(() => {
    if (permissionState !== "granted" || !videoStream) return;

    const interval = setInterval(async () => {
      const frameData = captureFrame();
      if (!frameData) return;

      setIsScanning(true);
      
      try {
        const response = await fetch("http://localhost:8000/api/vision/detect", {
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
        console.warn("Using simulated AR scan values:", err);
        runSimulation();
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
      <div className="relative h-[calc(100vh-6rem)] overflow-hidden bg-black">
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

        {/* Fallback Ambient Background */}
        {permissionState !== "granted" && (
          <div className="absolute inset-0 bg-gradient-to-b from-background via-black to-eco-green/10 z-0" />
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
            <Link to="/map" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/70 backdrop-blur">
              <Map className="h-4 w-4" />
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

        {/* Glowing path */}
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
          <div className="h-32 w-1 bg-gradient-to-t from-eco-cream to-transparent" />
        </div>

        {/* Bottom destination input */}
        <div className="absolute inset-x-4 bottom-3 z-10">
          <div className="flex items-center gap-3 rounded-full bg-eco-cream px-5 py-3 text-background shadow-xl">
            <span className="text-sm text-background/60">Where are you going?</span>
            <Link to="/map" className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-eco-orange text-background hover:brightness-105 active:scale-95 transition-all">
              <ArrowLeft className="h-4 w-4 -rotate-45" />
            </Link>
          </div>
        </div>

        <style>{`
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
