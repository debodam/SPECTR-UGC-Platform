import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Sparkles, BarChart3, CalendarDays, Settings as SettingsIcon, LogOut, Building2, ChevronsUpDown, Mic, Home } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useApp } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";

const NAV = [
  { to: "/",         label: "Home",       icon: Home },
  { to: "/transform",label: "Transform",  icon: Sparkles },
  { to: "/record",   label: "Record",     icon: Mic },
  { to: "/track",    label: "Track",      icon: BarChart3 },
  { to: "/distribute",label:"Distribute", icon: CalendarDays },
  { to: "/settings", label: "Settings",   icon: SettingsIcon },
] as const;

/* SVG paths from the design for each nav icon */
const NAV_PATHS: Record<string, { d1: string; d2: string }> = {
  Home:       { d1: "M4 11l8-7 8 7", d2: "M6 10v10h12V10" },
  Transform:  { d1: "M12 4l1.8 4.6L18.5 10l-4.7 1.4L12 16l-1.8-4.6L5.5 10l4.7-1.4z", d2: "M18 16v4M16 18h4" },
  Record:     { d1: "M9 4h6v8a3 3 0 0 1-6 0z", d2: "M6 11a6 6 0 0 0 12 0M12 17v3" },
  Track:      { d1: "M5 20V11M11 20V5M17 20v-7", d2: "M3 20h18" },
  Distribute: { d1: "M5 6h14v14H5z", d2: "M5 10h14M9 3v4M15 3v4" },
  Settings:   { d1: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", d2: "M19 12l2-1-1-3-2.3.5-1.4-1.4.5-2.3-3-1-1 2h-2l-1-2-3 1 .5 2.3-1.4 1.4L3 8l-1 3 2 1v2l-2 1 1 3 2.3-.5 1.4 1.4-.5 2.3 3 1 1-2h2l1 2 3-1-.5-2.3 1.4-1.4L21 16l1-3-2-1z" },
};

function NavIcon({ label }: { label: string }) {
  const paths = NAV_PATHS[label];
  if (!paths) return null;
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths.d1} />
      <path d={paths.d2} />
    </svg>
  );
}

function SpectrMark({ size = 40 }: { size?: number }) {
  const r = Math.round(size * 0.3);
  const s = size * 0.55;
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg aria-hidden="true" width={s} height={s} viewBox="0 0 24 24">
        <polygon points="12,3 21,21 12,21" fill="#0a66c2" />
        <polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55" />
      </svg>
    </div>
  );
}

function initials(name?: string) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    if (state.authLoading) return;
    if (!state.isAuthenticated) navigate({ to: "/access" });
    else if (!state.workspace?.companyId) navigate({ to: "/companies" });
    else if (!state.setupComplete) navigate({ to: "/setup" });
  }, [state.authLoading, state.isAuthenticated, state.setupComplete, navigate]);

  useEffect(() => { setSwitcherOpen(false); }, [pathname]);

  if (state.authLoading) return <div style={{ minHeight: "100vh" }} />;
  if (!state.isAuthenticated || !state.setupComplete) return null;

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("spectr-access-verified");
    navigate({ to: "/access" });
  };

  const userInitials = initials(state.user?.name);
  const companyInitials = initials(state.workspace.companyName);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#b9d6f8 0%,#4d92e0 48%,#0a4a94 100%)", padding: "40px 40px" }}>
      <div className="spectr-shell" style={{ display: "flex", flexDirection: "row" }}>

        {/* ── Left rail ── */}
        <aside className="spectr-rail">
          {/* Logo mark */}
          <SpectrMark size={40} />

          {/* Nav pills */}
          <nav className="spectr-nav-pills" aria-label="Primary">
            {NAV.map(({ to, label }) => {
              const active = label === "Home"
                ? pathname === "/"
                : pathname.startsWith(to);
              return (
                <Link key={to} to={to} aria-label={label} title={label}
                  className={`spectr-nav-btn${active ? " active" : ""}`}>
                  <NavIcon label={label} />
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <button onClick={logout} aria-label="Log out" title="Log out"
            className="spectr-nav-btn"
            style={{ border: "1px solid rgba(255,255,255,0.4)" }}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
              <path d="M16 8l4 4-4 4" />
              <path d="M20 12H9" />
            </svg>
          </button>
        </aside>

        {/* ── Right: header + content ── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

          {/* Header */}
          <header className="spectr-header">
            <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: "-0.01em" }}>
              Hi, {state.user?.name?.split(" ")[0] || "there"}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Workspace switcher */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setSwitcherOpen((v) => !v)}
                  style={{
                    height: 44, padding: "0 14px 0 8px", borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.4)",
                    background: "rgba(255,255,255,0.14)", color: "#ffffff",
                    fontFamily: "inherit", fontSize: 15, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  }}
                >
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%", background: "#ffffff",
                    color: "#0a66c2", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>
                    {state.workspace.companyLogoUrl ? (
                      <img src={state.workspace.companyLogoUrl} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                    ) : companyInitials}
                  </span>
                  <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {state.workspace.companyName || "My Company"}
                  </span>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 9l5-5 5 5" /><path d="M7 15l5 5 5-5" />
                  </svg>
                </button>

                {switcherOpen && (
                  <div style={{
                    position: "absolute", left: 0, top: "calc(100% + 8px)",
                    minWidth: 180, borderRadius: 14, overflow: "hidden", zIndex: 50,
                    background: "rgba(10,74,148,0.95)", backdropFilter: "blur(14px)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    boxShadow: "0 8px 32px rgba(3,30,70,0.4)",
                  }}>
                    <Link to="/companies"
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#ffffff", textDecoration: "none" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <Building2 size={14} /> Switch company
                    </Link>
                  </div>
                )}
              </div>

              {/* Avatar + bell */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 5px 0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)" }}>
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 17h12l-1.5-2V11a4.5 4.5 0 0 0-9 0v4z" /><path d="M10 20a2 2 0 0 0 4 0" />
                </svg>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: "linear-gradient(145deg,#ffffff,#b9d6f8)",
                  color: "#0a4a94", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, marginLeft: 6,
                }}>
                  {userInitials}
                </div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main style={{ flex: 1, overflowY: "auto" }} className="spectr-scroll">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
