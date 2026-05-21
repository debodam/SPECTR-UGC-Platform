import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Sparkles, BarChart3, CalendarDays, Settings as SettingsIcon, LogOut } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { useApp } from "@/lib/spectr-store";
import { SpectrLogo } from "./Logo";
import supabase from "@/lib/supabase";

const NAV = [
  { to: "/transform", label: "Transform", icon: Sparkles },
  { to: "/track", label: "Track", icon: BarChart3 },
  { to: "/distribute", label: "Distribute", icon: CalendarDays },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (state.authLoading) return;
    if (!state.isAuthenticated) navigate({ to: "/login" });
    else if (!state.workspace?.companyId) navigate({ to: "/companies" });
    else if (!state.setupComplete) navigate({ to: "/setup" });
  }, [state.authLoading, state.isAuthenticated, state.setupComplete, navigate]);

  if (state.authLoading) {
    return <div className="min-h-screen" style={{ background: "var(--color-surface)" }} />;
  }

  if (!state.isAuthenticated || !state.setupComplete) return null;

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen w-full" style={{ background: "var(--color-surface)" }}>
      <aside
        className="hidden md:flex flex-col w-60 shrink-0 border-r"
        style={{ background: "white", borderColor: "var(--color-border)" }}
      >
        <div className="p-5 border-b" style={{ borderColor: "var(--color-border)" }}>
          <SpectrLogo size={28} showTag />
          {state.workspace.companyName && (
            <Link
              to="/companies"
              className="mt-4 px-3 py-2 rounded-md text-sm font-semibold flex items-center justify-between group"
              style={{ background: "var(--color-surface)", color: "var(--color-foreground)" }}
            >
              <span className="truncate">{state.workspace.companyName}</span>
              <span className="text-xs ml-2 opacity-0 group-hover:opacity-60 transition-opacity">switch</span>
            </Link>
          )}
        </div>
        <nav className="flex-1 py-3">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: active ? "var(--color-primary)" : "var(--color-foreground)",
                  borderLeft: `4px solid ${active ? "var(--color-primary)" : "transparent"}`,
                  background: active ? "rgba(10,102,194,0.06)" : "transparent",
                }}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-5 py-3 text-sm border-t hover:bg-[var(--color-surface)]"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
        >
          <LogOut size={16} /> Log out
        </button>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
