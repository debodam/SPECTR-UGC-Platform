import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Calendar,
  ChartNoAxesColumn,
  ChevronsUpDown,
  Compass,
  House,
  LogOut,
  Mic,
  Settings as SettingsIcon,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";

export type RailPath =
  "/" | "/growth" | "/transform" | "/record" | "/results" | "/distribute" | "/settings";

const NAV: { to: RailPath; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Dashboard", icon: House },
  { to: "/growth", label: "Growth plan", icon: Compass },
  { to: "/transform", label: "Transform", icon: Sparkles },
  { to: "/record", label: "Record", icon: Mic },
  { to: "/results", label: "Results", icon: ChartNoAxesColumn },
  { to: "/distribute", label: "Distribute", icon: Calendar },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const initials = (name?: string | null) =>
  (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

/** Left rail shared by every app page. Active item is always SPECTR blue. */
export function AppRail({ active }: { active: RailPath }) {
  const navigate = useNavigate();
  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("spectr-access-verified");
    navigate({ to: "/access" });
  };
  return (
    <aside className="sx-rail">
      <Link to="/welcome" className="sx-rail-logo" aria-label="SPECTR home" title="SPECTR home">
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24">
          <polygon points="12,3 21,21 12,21" fill="#0a66c2" />
          <polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55" />
        </svg>
      </Link>
      <nav className="sx-rail-nav" aria-label="Main">
        {NAV.map((n) => {
          const on = n.to === active;
          return (
            <Link
              key={n.to}
              to={n.to}
              aria-label={n.label}
              title={n.label}
              aria-current={on ? "page" : undefined}
              className={`sx-rail-btn${on ? " is-active" : ""}`}
              data-tour={`nav-${n.to === "/" ? "dashboard" : n.to.slice(1)}`}
            >
              <n.icon size={22} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        className="sx-rail-out sx-rail-btn sx-rail-btn--outline"
        aria-label="Log out"
        title="Log out"
        onClick={logout}
      >
        <LogOut size={20} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </aside>
  );
}

/** Page header: title, subtitle, optional actions, then the company switcher and account chip. */
export function AppHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  const { state } = useApp();
  const navigate = useNavigate();
  const company = state.workspace.companyName;
  return (
    <header className="sx-header">
      <div className="sx-header-title">
        <h1 className="sx-title">{title}</h1>
        {subtitle && <div className="sx-hide-sm sx-subtitle">{subtitle}</div>}
      </div>
      <div className="sx-header-actions">
        {actions}
        <button
          type="button"
          className="sx-pill"
          onClick={() => navigate({ to: "/companies" })}
          aria-label={`Switch workspace, current: ${company || "none"}`}
        >
          <span className="sx-pill-mark">{(company || "C")[0].toUpperCase()}</span>
          <span className="sx-hide-sm sx-pill-name">{company || "Workspace"}</span>
          <ChevronsUpDown size={16} strokeWidth={2} aria-hidden="true" />
        </button>
        <div className="sx-pill sx-pill--account">
          <Bell size={20} strokeWidth={1.8} aria-hidden="true" />
          <span className="sx-avatar" aria-label={state.user?.name || "Account"}>
            {initials(state.user?.name)}
          </span>
        </div>
      </div>
    </header>
  );
}

/**
 * Guards an app page: signed-out users (including an expired session) go to login, and users without a finished
 * workspace go to the workspace picker. Nothing renders until the check passes.
 */
export function AppGate({
  children,
  needsSetup = true,
}: {
  children: ReactNode;
  needsSetup?: boolean;
}) {
  const { state } = useApp();
  const navigate = useNavigate();
  const ok =
    state.isAuthenticated && !!state.workspace.companyId && (!needsSetup || state.setupComplete);
  useEffect(() => {
    if (state.authLoading) return;
    if (!state.isAuthenticated) navigate({ to: "/login" });
    else if (!ok) navigate({ to: "/companies" });
  }, [state.authLoading, state.isAuthenticated, ok, navigate]);
  if (state.authLoading || !ok) return <div className="sx-gate" aria-busy="true" />;
  return <>{children}</>;
}
