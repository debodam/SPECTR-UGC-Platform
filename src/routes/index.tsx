import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";
import { LogOut, ChevronsUpDown, Bell, ArrowUpRight, ArrowUp, ChartNoAxesColumn, Plus, File, House, Sparkles, Mic, Calendar, Settings as SettingsIcon } from "lucide-react";
import { MicHalo } from "@/components/spectr/MicHalo";

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

/* ─────────────────── Nav definitions ─────────────────── */
const NAV_ITEMS = [
  { to: "/", label: "Home", icon: House },
  { to: "/transform", label: "Transform", icon: Sparkles },
  { to: "/record", label: "Record", icon: Mic },
  { to: "/track", label: "Track", icon: ChartNoAxesColumn },
  { to: "/distribute", label: "Distribute", icon: Calendar },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
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

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");


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
    boxSizing: "border-box", minWidth: 0, padding: "20px 20px 18px",
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
    <div className="sx-shell">

        {/* ── Left rail ── */}
        <aside className="sx-rail">
          <Link to="/welcome" className="sx-rail-logo" aria-label="SPECTR home" title="SPECTR home">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24">
              <polygon points="12,3 21,21 12,21" fill="#0a66c2" />
              <polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55" />
            </svg></Link>
          <nav className="sx-rail-nav">
            {NAV_ITEMS.map((n) => {
              const isActive = n.to === "/";
              return (
                <button key={n.label} type="button" aria-label={n.label} title={n.label}
                  onClick={() => navigate({ to: n.to })}
                  style={{ width: 44, height: 44, borderRadius: "50%", border: 0, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", ...(isActive ? { background: "#0a66c2", color: "#ffffff", boxShadow: "0 8px 20px rgba(6,42,92,0.35)" } : { background: "transparent", color: "rgba(255,255,255,0.9)" }) }}>
                  <n.icon size={22} strokeWidth={1.8} aria-hidden="true" />
                </button>
              );
            })}
          </nav>
          <button type="button" className="sx-rail-out" aria-label="Log out" title="Log out" onClick={logout}
            style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "inherit" }}>
            <LogOut size={20} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </aside>

        {/* ── Header ── */}
        <header className="sx-header">
          <div className="sx-header-title"><div style={{ fontSize: 26, fontWeight: 300, letterSpacing: "-0.01em" }}>Hi, {firstName}</div></div>
          <div className="sx-header-actions">
            <button type="button" onClick={() => navigate({ to: "/companies" })}
              style={{ height: 44, padding: "0 14px 0 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)", color: "#ffffff", fontFamily: "inherit", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#ffffff", color: "#0a66c2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{initials(compName)}</span>
              <span className="sx-hide-sm" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{compName || "Select company"}</span>
              <ChevronsUpDown size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 5px 0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)" }}>
              <Bell size={20} strokeWidth={1.8} color="#ffffff" aria-hidden="true" />
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(145deg,#ffffff,#b9d6f8)", color: "#0a4a94", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, marginLeft: 6 }}>{initials(state.user?.name)}</div>
            </div>
          </div>
        </header>

        <main className="sx-main sx-fit sx-fit-db"><div className="sx-page"><div className="db-layout">
        <div className="db-left">
        <div style={{ width: "100%" }}>
          <MicHalo state={isRec ? "recording" : "idle"} onClick={handleMic} />
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }} aria-live="polite">
              {isRec && <span className="mo-status-dot" aria-hidden="true" />}
              {isRec ? "Recording" : "Tap to record"}
              {isRec && <span style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,0.9)" }}>{mm}:{ss}</span>}
            </div>
            <div style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.88)" }}>
              {isRec ? "Tap the mic to stop" : "Turn a conversation into LinkedIn content"}
            </div>
          </div>
        </div>

        {/* ── AI headline ── */}
        <div className="db-headline">
          <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.88)" }}>AI suggested</div>
          <div style={{ marginTop: 10, fontSize: "clamp(22px, 2.4vw, 32px)", lineHeight: 1.2, fontWeight: 300, letterSpacing: "-0.015em" }}>
            {hasGoal
              ? "Record your first take. SPECTR turns it into LinkedIn content."
              : "Record your first take. SPECTR turns it into LinkedIn content."}
          </div>
        </div>

        </div>

        <div className="db-right">
        {/* ── 2×2 Cards ── */}
        <div className="db-cards">

          {/* LinkedIn impressions */}
          <div className="db-card" role="link" tabIndex={0} onClick={() => navigate({ to: "/track" })} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>LinkedIn impressions</div>
              <div style={arrowBtn}><ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" /></div>
            </div>
            {hasImpressions ? (
              <>
                <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontSize: 46, fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1 }}>{ws.baseline.weeklyImpressions}</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 24, padding: "0 9px", borderRadius: 999, background: "rgba(255,255,255,0.92)", color: "#067647", fontSize: 12, fontWeight: 700 }}>
                    <ArrowUp size={12} strokeWidth={3} aria-hidden="true" />
                    &mdash;
                  </div>
                </div>
                <div style={{ marginTop: 2, fontSize: 13, color: "rgba(255,255,255,0.88)" }}>This week vs last week</div>
                <svg aria-hidden="true" className="db-spark" width="100%" height="72" viewBox="0 0 240 72" preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
                  <defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity="0.38" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></linearGradient></defs>
                  <path d={sparkArea} fill="url(#spk)" />
                  <path d={sparkLine} fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={sparkLast[0]} cy={sparkLast[1]} r="4.5" fill="#ffffff" />
                </svg>
              </>
            ) : (
              <>
                <div style={{ marginTop: 18, fontSize: 46, fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1, color: "rgba(255,255,255,0.55)" }}>0</div>
                <svg aria-hidden="true" className="db-spark" width="100%" height="72" viewBox="0 0 240 72" preserveAspectRatio="none" style={{ display: "block" }}>
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
              <div style={arrowBtn}><ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" /></div>
            </div>
            {hasGoal ? (
              <>
                <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
                  <div className="db-ring" style={{ position: "relative" }}>
                    <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 132 132" style={{ transform: "rotate(-90deg)", display: "block" }}>
                      <circle cx="66" cy="66" r="56" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="10" />
                      <circle cx="66" cy="66" r="56" fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" strokeDasharray={goalDash} style={{ transition: "stroke-dasharray .8s ease", opacity: goalPct > 0 ? 1 : 0.3 }} />
                    </svg>
                    <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ fontSize: 34, fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1 }}>{Math.round(goalPct * 100)}%</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.9)" }}>Week 1 of 12</div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 14 }}>Goal: {ws.goalDescription.split(" ").slice(0, 5).join(" ")}…</div>
                  <div style={{ height: 22, padding: "0 9px", borderRadius: 999, display: "inline-flex", alignItems: "center", flexShrink: 0, whiteSpace: "nowrap", fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.9)", color: "#475569" }}>Just started</div>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 40, textAlign: "center" }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", border: "1.5px dashed rgba(255,255,255,0.5)", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChartNoAxesColumn size={28} strokeWidth={1.6} color="#ffffff" aria-hidden="true" />
                </div>
                <div style={{ marginTop: 16, fontSize: 14, lineHeight: 1.45, color: "rgba(255,255,255,0.92)" }}>Set a goal in your workspace to track 12-week progress.</div>
              </div>
            )}
          </div>

          {/* Distribute */}
          <div className="db-card" role="link" tabIndex={0} onClick={() => navigate({ to: "/distribute" })} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Distribute</div>
              <div style={arrowBtn}><ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" /></div>
            </div>
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#ffffff", color: "#0a66c2", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 30px rgba(6,42,92,0.28)", flexShrink: 0 }}>
                <Plus size={30} strokeWidth={2.2} aria-hidden="true" />
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
              <div style={arrowBtn}><ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" /></div>
            </div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, border: "1.5px dashed rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <File size={24} strokeWidth={1.8} color="#ffffff" aria-hidden="true" />
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.45, color: "rgba(255,255,255,0.92)" }}>No drafts yet. Record a take or paste a transcript to make your first one.</div>
            </div>
          </div>
        </div>

        {/* ── Helper text + CTA ── */}
        <div className="db-cta">
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
        </div></div></main>

    </div>
  );
}
