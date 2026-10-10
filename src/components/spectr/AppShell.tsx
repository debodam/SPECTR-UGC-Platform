import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Sparkles, BarChart3, CalendarDays, Settings as SettingsIcon, LogOut, Building2, ChevronsUpDown, Mic } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useApp } from "@/lib/spectr-store";
import { SpectrLogo } from "./Logo";
import supabase from "@/lib/supabase";

const NAV = [
  { to: "/record", label: "Record", icon: Mic },
  { to: "/transform", label: "Transform", icon: Sparkles },
  { to: "/track", label: "Track", icon: BarChart3 },
  { to: "/distribute", label: "Distribute", icon: CalendarDays },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

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

  if (state.authLoading) {
    return <div className="min-h-screen" />;
  }

  if (!state.isAuthenticated || !state.setupComplete) return null;

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("spectr-access-verified");
    navigate({ to: "/access" });
  };

  return (
    <div className="min-h-screen w-full" style={{ paddingBottom: 104 }}>

      {/* ── Minimal top bar: logo + company switcher + logout ── */}
      <header className="flex items-center justify-between px-5 sm:px-7 py-4">
        <div className="flex items-center gap-3">
          <SpectrLogo size={24} />

          <div className="relative">
            <button
              onClick={() => setSwitcherOpen((v) => !v)}
              className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "var(--color-card-2)", color: "var(--color-foreground)", border: "1px solid var(--color-border)" }}
            >
              {state.workspace.companyLogoUrl ? (
                <span className="shrink-0 rounded flex items-center justify-center overflow-hidden" style={{ width: 16, height: 16, background: "white" }}>
                  <img src={state.workspace.companyLogoUrl} alt="" className="object-contain" style={{ width: 12, height: 12 }} />
                </span>
              ) : (
                <Building2 size={12} style={{ color: "var(--color-text-secondary)" }} />
              )}
              <span className="truncate max-w-[120px]">{state.workspace.companyName || "My Company"}</span>
              <ChevronsUpDown size={11} style={{ color: "var(--color-primary)" }} />
            </button>

            {switcherOpen && (
              <div
                className="absolute left-0 top-full mt-2 rounded-xl overflow-hidden z-50"
                style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
              >
                <Link
                  to="/companies"
                  className="flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap hover:bg-[var(--color-card-2)]"
                  style={{ color: "var(--color-foreground)" }}
                >
                  <Building2 size={13} /> Switch company
                </Link>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ color: "var(--color-text-secondary)" }}
          title="Log out"
        >
          <LogOut size={14} /> <span className="hidden sm:inline">Log out</span>
        </button>
      </header>

      <main>{children}</main>

      {/* ── Bottom nav ── */}
      <nav className="spectr-bottomnav" aria-label="Primary">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <Link key={to} to={to} className={`spectr-bottomnav-item${active ? " active" : ""}`}>
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
