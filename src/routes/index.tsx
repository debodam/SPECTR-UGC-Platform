import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";

export const Route = createFileRoute("/")({ component: RootPage });

/* ─────────────────── Root router ─────────────────── */
function RootPage() {
  const { state } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.authLoading) return;
    if (!state.isAuthenticated) navigate({ to: "/login" });
    else if (!state.workspace?.companyId || !state.setupComplete) navigate({ to: "/companies" });
  }, [state.authLoading, state.isAuthenticated, state.setupComplete, navigate]);

  if (state.authLoading) return <div style={{ minHeight: "100vh" }} />;
  if (!state.isAuthenticated || !state.setupComplete) return null;

  return <Dashboard />;
}

/* ─────────────────── Color ramp for orb layers ─────────────────── */
const ORB_STOPS: [number, string][] = [
  [0, "#ffffff"], [0.05, "#e3f1ff"], [0.14, "#8cc4fa"], [0.3, "#3b86dc"],
  [0.45, "#0a5ab4"], [0.56, "#0a4a94"], [0.68, "#3b86dc"],
  [0.8, "#8fc0f7"], [0.92, "#cfe4fc"], [1, "#eaf3fe"],
];

function hexToRgb(h: string) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function orbColor(t: number): string {
  for (let i = 1; i < ORB_STOPS.length; i++) {
    const [a0, ac] = ORB_STOPS[i - 1];
    const [b0, bc] = ORB_STOPS[i];
    if (t <= b0) {
      const k = (t - a0) / (b0 - a0);
      const ca = hexToRgb(ac), cb = hexToRgb(bc);
      return "rgb(" + ca.map((c, j) => Math.round(c + (cb[j] - c) * k)).join(",") + ")";
    }
  }
  return "#e6f1fe";
}

function buildOrbLayers(isRec: boolean) {
  const N = 18, CX = 200, CY = 196, OUT = 352;
  const coreW = isRec ? 112 : 70, coreH = isRec ? 112 : 124, coreR = isRec ? 56 : 30;
  const layers: { key: string; x: number; y: number; w: number; h: number; rx: number; fill: string; opacity: number; dur: number; delay: number; amp: number; amp2: number; dx: number; dy: number }[] = [];
  for (let i = N; i >= 1; i--) {
    const t = i / N;
    const e = Math.pow(t, 0.85);
    const w = coreW + (OUT - coreW) * e;
    const h = coreH + (OUT - coreH) * e;
    const rx = Math.min(w, h) / 2;
    const fade = t > 0.7 ? 1 - ((t - 0.7) / 0.3) * 0.7 : 1;
    const dur = isRec ? 5.2 : 11;
    const amp = 1 + (isRec ? 0.012 : 0.006) + t * (isRec ? 0.05 : 0.026);
    const amp2 = 1 - t * (isRec ? 0.03 : 0.014);
    layers.push({
      key: `l${i}`,
      x: CX - w / 2, y: CY - h / 2, w, h, rx,
      fill: orbColor(t), opacity: fade, dur, delay: i * 0.42,
      amp, amp2,
      dx: Math.sin(i * 1.7) * (0.8 + t * 2.4),
      dy: Math.cos(i * 1.3) * (0.8 + t * 2.4),
    });
  }
  return { layers, coreW, coreH, coreR, CX, CY };
}

/* ─────────────────── Nav definitions ─────────────────── */
const NAV_ITEMS = [
  { to: "/", label: "Home", d1: "M4 11l8-7 8 7", d2: "M6 10v10h12V10" },
  { to: "/transform", label: "Transform", d1: "M12 4l1.8 4.6L18.5 10l-4.7 1.4L12 16l-1.8-4.6L5.5 10l4.7-1.4z", d2: "M18 16v4M16 18h4" },
  { to: "/record", label: "Record", d1: "M9 4h6v8a3 3 0 0 1-6 0z", d2: "M6 11a6 6 0 0 0 12 0M12 17v3" },
  { to: "/track", label: "Track", d1: "M5 20V11M11 20V5M17 20v-7", d2: "M3 20h18" },
  { to: "/distribute", label: "Distribute", d1: "M5 6h14v14H5z", d2: "M5 10h14M9 3v4M15 3v4" },
  { to: "/settings", label: "Settings", d1: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", d2: "M19 12l2-1-1-3-2.3.5-1.4-1.4.5-2.3-3-1-1 2h-2l-1-2-3 1 .5 2.3-1.4 1.4L3 8l-1 3 2 1v2l-2 1 1 3 2.3-.5 1.4 1.4-.5 2.3 3 1 1-2h2l1 2 3-1-.5-2.3 1.4-1.4L21 16l1-3-2-1z" },
] as const;

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/* ─────────────────── Week calendar helper ─────────────────── */
function buildWeek() {
  const today = new Date().getDay(); // 0=Sun
  return ["S", "M", "T", "W", "T", "F", "S"].map((name, i) => ({ name, isToday: i === today, hasPost: false }));
}

/* ─────────────────── Sparkline helper ─────────────────── */
function sparklinePath(data: number[], W = 240, H = 72) {
  const mn = Math.min(...data) - 1, mx = Math.max(...data) + 1;
  const pts: [number, number][] = data.map((v, i) => [i * (W / (data.length - 1)), H - 8 - ((v - mn) / (mx - mn)) * (H - 16)]);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return { line: d, area: d + ` L${W} ${H} L0 ${H} Z`, last: pts[pts.length - 1] };
}

/* ─────────────────── Dashboard ─────────────────── */
function Dashboard() {
  const { state } = useApp();
  const navigate = useNavigate();
  const [isRec, setIsRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (ivRef.current) clearInterval(ivRef.current); }, []);

  const ws = state.workspace;
  const firstName = state.user?.name?.split(" ")[0] || "there";
  const compName = ws.companyName || "";

  const handleMic = () => {
    if (isRec) {
      clearInterval(ivRef.current!);
      setIsRec(false);
      navigate({ to: "/record" });
    } else {
      setIsRec(true);
      setSecs(0);
      ivRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
    }
  };

  const { layers, coreW, coreH, coreR, CX, CY } = useMemo(() => buildOrbLayers(isRec), [isRec]);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  const geo = {
    x: CX - coreW / 2, y: CY - coreH / 2, width: coreW, height: coreH, rx: coreR,
    style: { transition: "x .8s ease,y .8s ease,width .8s ease,height .8s ease,rx .8s ease" },
  };

  /* Analytics data */
  const hasImpressions = !!ws.baseline?.weeklyImpressions && String(ws.baseline.weeklyImpressions).trim() !== "" && String(ws.baseline.weeklyImpressions) !== "0";
  const hasGoal = !!ws.goalDescription;
  const sparkData = [9.2, 10.1, 8.7, 11.4, 12.9, 12.2, 14.8];
  const { line: sparkLine, area: sparkArea, last: sparkLast } = sparklinePath(sparkData);
  const week = buildWeek();

  const goalPct = 0;
  const goalDash = (() => { const C = 2 * Math.PI * 56; return `${(C * goalPct).toFixed(1)} ${C.toFixed(1)}`; })();

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("spectr-access-verified");
    navigate({ to: "/access" });
  };

  /* card shared style */
  const cardStyle: React.CSSProperties = {
    boxSizing: "border-box", height: 290, padding: "20px 20px 18px",
    borderRadius: 26, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.4)",
    backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
    boxShadow: "0 10px 30px rgba(6,42,92,0.14)", cursor: "pointer",
    color: "#ffffff", overflow: "hidden",
  };
  const arrowBtn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.2)",
    border: "1px solid rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", flexShrink: 0,
  };

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        position: "relative", width: 1360, height: 880, borderRadius: 44, overflow: "hidden", color: "#ffffff",
        background: "radial-gradient(700px 520px at 30% 45%,rgba(160,205,255,0.45),rgba(160,205,255,0) 70%),linear-gradient(150deg,#5b9be4 0%,#3a82dc 42%,#1a56a8 100%)",
        boxShadow: "0 0 0 6px rgba(255,255,255,0.92),0 50px 120px rgba(3,30,70,0.38)",
        fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',Inter,'Segoe UI',sans-serif",
      }}>

        {/* ── Left rail ── */}
        <aside style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 88, boxSizing: "border-box", borderRight: "1px solid rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", alignItems: "center", padding: "26px 0" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24">
              <polygon points="12,3 21,21 12,21" fill="#0a66c2" />
              <polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55" />
            </svg>
          </div>
          <nav style={{ marginTop: "auto", marginBottom: "auto", padding: 8, borderRadius: 32, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.3)", display: "flex", flexDirection: "column", gap: 6 }}>
            {NAV_ITEMS.map((n) => {
              const isActive = n.to === "/";
              return (
                <button key={n.label} type="button" aria-label={n.label} title={n.label}
                  onClick={() => navigate({ to: n.to })}
                  style={{ width: 44, height: 44, borderRadius: "50%", border: 0, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", ...(isActive ? { background: "#0a66c2", color: "#ffffff", boxShadow: "0 8px 20px rgba(6,42,92,0.35)" } : { background: "transparent", color: "rgba(255,255,255,0.9)" }) }}>
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={n.d1} /><path d={n.d2} />
                  </svg>
                </button>
              );
            })}
          </nav>
          <button type="button" aria-label="Log out" title="Log out" onClick={logout}
            style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "inherit" }}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" /><path d="M16 8l4 4-4 4" /><path d="M20 12H9" />
            </svg>
          </button>
        </aside>

        {/* ── Header ── */}
        <header style={{ position: "absolute", left: 88, right: 0, top: 0, height: 88, boxSizing: "border-box", padding: "0 40px", borderBottom: "1px solid rgba(255,255,255,0.28)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: "-0.01em" }}>Hi, {firstName}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" onClick={() => navigate({ to: "/companies" })}
              style={{ height: 44, padding: "0 14px 0 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)", color: "#ffffff", fontFamily: "inherit", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#ffffff", color: "#0a66c2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{initials(compName)}</span>
              <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{compName || "Select company"}</span>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 9l5-5 5 5" /><path d="M7 15l5 5 5-5" /></svg>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 5px 0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)" }}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 17h12l-1.5-2V11a4.5 4.5 0 0 0-9 0v4z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(145deg,#ffffff,#b9d6f8)", color: "#0a4a94", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, marginLeft: 6 }}>{initials(state.user?.name)}</div>
            </div>
          </div>
        </header>

        {/* ── Concentric circles ── */}
        <svg aria-hidden="true" width="1360" height="880" viewBox="0 0 1360 880" style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
          <circle cx="408" cy="392" r="235" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.2" />
          <circle cx="408" cy="392" r="262" fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1" />
        </svg>

        {/* ── Orbit labels ── */}
        <button type="button" onClick={() => navigate({ to: "/transform" })}
          style={{ position: "absolute", left: 408, top: 134, transform: "translate(-50%,-50%)", border: 0, background: "transparent", color: "rgba(255,255,255,0.92)", fontFamily: "inherit", fontSize: 14, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer", padding: "6px 10px" }}>
          Transform
        </button>
        <button type="button" onClick={() => navigate({ to: "/track" })}
          style={{ position: "absolute", left: 668, top: 392, transform: "translate(-50%,-50%) rotate(90deg)", border: 0, background: "transparent", color: "rgba(255,255,255,0.92)", fontFamily: "inherit", fontSize: 14, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer", padding: "6px 10px" }}>
          Track
        </button>
        <button type="button" onClick={() => navigate({ to: "/distribute" })}
          style={{ position: "absolute", left: 408, top: 650, transform: "translate(-50%,-50%) rotate(180deg)", border: 0, background: "transparent", color: "rgba(255,255,255,0.92)", fontFamily: "inherit", fontSize: 14, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer", padding: "6px 10px" }}>
          Distribute
        </button>

        {/* ── Orb ── */}
        <div style={{ position: "absolute", left: 208, top: 134, width: 400, height: 400 }}>
          <button type="button" aria-label={isRec ? "Stop recording" : "Start recording"} onClick={handleMic}
            className="db-mic"
            style={{ position: "absolute", left: 0, top: 0, width: 400, height: 400, border: 0, padding: 0, background: "transparent", cursor: "pointer", borderRadius: "50%" }}>
            <svg aria-hidden="true" width="400" height="400" viewBox="0 0 400 400" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
              <defs>
                <filter id="db-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.7" /></filter>
                <filter id="db-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9" /></filter>
                <radialGradient id="db-aura" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ffffff" stopOpacity="0.55" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></radialGradient>
              </defs>
              <circle cx="200" cy="196" r="200" fill="url(#db-aura)" opacity="0.5" />
              {isRec && (
                <>
                  <circle className="db-hr" cx="200" cy="196" r="168" fill="none" stroke="#ffffff" strokeWidth="1.6" />
                  <circle className="db-hr" cx="200" cy="196" r="168" fill="none" stroke="#ffffff" strokeWidth="1.6" style={{ animationDelay: "-2.1s" }} />
                </>
              )}
              <g filter="url(#db-soft)">
                {layers.map((l) => (
                  <rect key={l.key} className="db-hl"
                    x={l.x} y={l.y} width={l.w} height={l.h} rx={l.rx}
                    fill={l.fill} opacity={l.opacity}
                    stroke="rgba(255,255,255,0.3)" strokeWidth="1"
                    style={{
                      "--amp": l.amp, "--amp2": l.amp2,
                      "--dx": `${l.dx}px`, "--dy": `${l.dy}px`,
                      animationDuration: `${l.dur}s`,
                      animationDelay: `-${l.delay}s`,
                      transition: "x .8s ease,y .8s ease,width .8s ease,height .8s ease,rx .8s ease",
                    } as React.CSSProperties}
                  />
                ))}
              </g>
              <rect {...geo} fill="#ffffff" opacity="0.7" filter="url(#db-glow)" />
              <rect {...geo} fill="#ffffff" />
              <g style={{ transition: "opacity .5s ease", opacity: isRec ? 0 : 1 }}>
                <path d="M146 214 V232 C146 270 254 270 254 232 V214" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="200" cy="296" r="7" fill="#ffffff" />
              </g>
              <rect x="182" y="178" width="36" height="36" rx="9" fill="#0a66c2" style={{ transition: "opacity .5s ease", opacity: isRec ? 1 : 0 }} />
            </svg>
          </button>
        </div>

        {/* ── Caption ── */}
        <div style={{ position: "absolute", left: 208, width: 400, top: 566, textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>{isRec ? "Recording" : "Tap to record"}</div>
          <div style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.88)" }}>
            {isRec ? `${mm}:${ss} · tap to stop` : "Turn a conversation into LinkedIn content"}
          </div>
        </div>

        {/* ── AI headline ── */}
        <div style={{ position: "absolute", left: 128, top: 704, width: 600 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.88)" }}>AI suggested</div>
          <div style={{ marginTop: 10, fontSize: 32, lineHeight: 1.2, fontWeight: 300, letterSpacing: "-0.015em" }}>
            {hasGoal
              ? "Record your first take. SPECTR turns it into LinkedIn content."
              : "Record your first take. SPECTR turns it into LinkedIn content."}
          </div>
        </div>

        {/* ── 2×2 Cards ── */}
        <div style={{ position: "absolute", left: 740, top: 110, width: 580, display: "grid", gridTemplateColumns: "280px 280px", gap: 20 }}>

          {/* LinkedIn impressions */}
          <div className="db-card" role="link" tabIndex={0} onClick={() => navigate({ to: "/track" })} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>LinkedIn impressions</div>
              <div style={arrowBtn}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7" /><path d="M8 7h9v9" /></svg></div>
            </div>
            {hasImpressions ? (
              <>
                <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontSize: 46, fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1 }}>{ws.baseline.weeklyImpressions}</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 24, padding: "0 9px", borderRadius: 999, background: "rgba(255,255,255,0.92)", color: "#067647", fontSize: 12, fontWeight: 700 }}>
                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></svg>
                    &mdash;
                  </div>
                </div>
                <div style={{ marginTop: 2, fontSize: 13, color: "rgba(255,255,255,0.88)" }}>This week vs last week</div>
                <svg aria-hidden="true" width="240" height="72" viewBox="0 0 240 72" style={{ display: "block", marginTop: 12, overflow: "visible" }}>
                  <defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity="0.38" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></linearGradient></defs>
                  <path d={sparkArea} fill="url(#spk)" />
                  <path d={sparkLine} fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={sparkLast[0]} cy={sparkLast[1]} r="4.5" fill="#ffffff" />
                </svg>
              </>
            ) : (
              <>
                <div style={{ marginTop: 18, fontSize: 46, fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1, color: "rgba(255,255,255,0.55)" }}>0</div>
                <svg aria-hidden="true" width="240" height="72" viewBox="0 0 240 72" style={{ display: "block", marginTop: 22 }}>
                  <path d="M0 56 H240" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round" />
                </svg>
                <div style={{ marginTop: 16, fontSize: 14, lineHeight: 1.45, color: "rgba(255,255,255,0.92)" }}>Stats show up after your first LinkedIn posts go live.</div>
              </>
            )}
          </div>

          {/* 12-week goal */}
          <div className="db-card" role="link" tabIndex={0} onClick={() => navigate({ to: "/track" })} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>12-week goal</div>
              <div style={arrowBtn}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7" /><path d="M8 7h9v9" /></svg></div>
            </div>
            {hasGoal ? (
              <>
                <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
                  <div style={{ position: "relative", width: 132, height: 132 }}>
                    <svg aria-hidden="true" width="132" height="132" viewBox="0 0 132 132" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="66" cy="66" r="56" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="10" />
                      <circle cx="66" cy="66" r="56" fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" strokeDasharray={goalDash} style={{ transition: "stroke-dasharray .8s ease", opacity: goalPct > 0 ? 1 : 0.3 }} />
                    </svg>
                    <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ fontSize: 34, fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1 }}>{Math.round(goalPct * 100)}%</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.9)" }}>Week 1 of 12</div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 14 }}>Goal: {ws.goalDescription.split(" ").slice(0, 5).join(" ")}…</div>
                  <div style={{ height: 22, padding: "0 9px", borderRadius: 999, display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.9)", color: "#475569" }}>Just started</div>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 40, textAlign: "center" }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", border: "1.5px dashed rgba(255,255,255,0.5)", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 20V11M11 20V5M17 20v-7" /><path d="M3 20h18" /></svg>
                </div>
                <div style={{ marginTop: 16, fontSize: 14, lineHeight: 1.45, color: "rgba(255,255,255,0.92)" }}>Set a goal in your workspace to track 12-week progress.</div>
              </div>
            )}
          </div>

          {/* Distribute */}
          <div className="db-card" role="link" tabIndex={0} onClick={() => navigate({ to: "/distribute" })} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Distribute</div>
              <div style={arrowBtn}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7" /><path d="M8 7h9v9" /></svg></div>
            </div>
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#ffffff", color: "#0a66c2", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 30px rgba(6,42,92,0.28)", flexShrink: 0 }}>
                <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>Create a post</div>
                <div style={{ marginTop: 3, fontSize: 14, color: "rgba(255,255,255,0.9)" }}>Nothing scheduled yet</div>
              </div>
            </div>
            <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between" }}>
              {week.map((d, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>{d.name}</div>
                  <div style={{
                    width: 28, height: 44, borderRadius: 14, boxSizing: "border-box",
                    display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 6,
                    fontSize: 12, fontWeight: 700,
                    background: d.hasPost ? "#ffffff" : "rgba(255,255,255,0.14)",
                    color: d.hasPost ? "#0a66c2" : "transparent",
                    ...(d.isToday ? { boxShadow: "0 0 0 2px rgba(255,255,255,0.95),0 0 0 4px rgba(255,255,255,0.3)" } : {}),
                  }} />
                </div>
              ))}
            </div>
          </div>

          {/* Ready to publish */}
          <div className="db-card" role="link" tabIndex={0} onClick={() => navigate({ to: "/transform" })} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Ready to publish</div>
              <div style={arrowBtn}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7" /><path d="M8 7h9v9" /></svg></div>
            </div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, border: "1.5px dashed rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></svg>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.45, color: "rgba(255,255,255,0.92)" }}>No drafts yet. Record a take or paste a transcript to make your first one.</div>
            </div>
          </div>
        </div>

        {/* ── Helper text + CTA ── */}
        <div style={{ position: "absolute", left: 740, width: 580, top: 742, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.9)", maxWidth: 380 }}>
            {hasGoal
              ? "Two more posts this week keeps you on pace for your 12-week goal."
              : "Ideas come from your goals and what your audience reacts to. Record once to unlock them."}
          </div>
          <button type="button" onClick={() => navigate({ to: "/transform" })}
            style={{ height: 52, padding: "0 28px", borderRadius: 999, border: 0, background: "#ffffff", color: "#0a4a94", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 14px 30px rgba(6,42,92,0.25)", whiteSpace: "nowrap" }}>
            See ideas
          </button>
        </div>

      </div>
    </div>
  );
}
