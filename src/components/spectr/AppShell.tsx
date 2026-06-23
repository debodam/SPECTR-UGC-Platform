import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Sparkles, BarChart3, CalendarDays, Settings as SettingsIcon, LogOut, Building2, ChevronsUpDown, Mic, Menu, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useApp } from "@/lib/spectr-store";
import { SpectrLogo } from "./Logo";
import supabase from "@/lib/supabase";

const NAV = [
  { to: "/transform", label: "Transform", icon: Sparkles },
  { to: "/record", label: "Record", icon: Mic },
  { to: "/track", label: "Track", icon: BarChart3 },
  { to: "/distribute", label: "Distribute", icon: CalendarDays },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (state.authLoading) return;
    if (!state.isAuthenticated) navigate({ to: "/login" });
    else if (!state.workspace?.companyId) navigate({ to: "/companies" });
    else if (!state.setupComplete) navigate({ to: "/setup" });
  }, [state.authLoading, state.isAuthenticated, state.setupComplete, navigate]);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (state.authLoading) {
    return <div className="min-h-screen" />;
  }

  if (!state.isAuthenticated || !state.setupComplete) return null;

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      <nav className="flex-1 py-3 px-3 space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={onNav}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{
                color: active ? "white" : "var(--color-text-secondary)",
                background: active ? "var(--color-primary)" : "transparent",
                boxShadow: active ? "var(--glow-primary-sm)" : "none",
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={() => { onNav?.(); logout(); }}
        className="flex items-center gap-2 px-5 py-3 text-sm border-t hover:bg-[var(--color-card-2)]"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
      >
        <LogOut size={16} /> Log out
      </button>
    </>
  );

  const CompanySwitcher = ({ onNav }: { onNav?: () => void }) => (
    <Link
      to="/companies"
      onClick={onNav}
      className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold group transition-colors"
      style={{ background: "var(--color-card-2)", color: "var(--color-foreground)" }}
      title="Switch company"
    >
      {state.workspace.companyLogoUrl ? (
        <img
          src={state.workspace.companyLogoUrl}
          alt=""
          className="shrink-0 object-contain"
          style={{ width: 20, height: 20 }}
        />
      ) : (
        <Building2 size={14} style={{ color: "var(--color-text-secondary)", flexShrink: 0 }} />
      )}
      <span className="truncate flex-1">{state.workspace.companyName || "My Company"}</span>
      <ChevronsUpDown size={13} className="shrink-0 transition-opacity opacity-40 group-hover:opacity-100" style={{ color: "var(--color-primary)" }} />
    </Link>
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full">

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-60 shrink-0 border-r"
        style={{ borderColor: "var(--color-border)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      >
        <div className="p-5 border-b" style={{ borderColor: "var(--color-border)" }}>
          <SpectrLogo size={28} showTag />
          <CompanySwitcher />
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header
        className="flex md:hidden items-center justify-between px-4 h-14 shrink-0 border-b sticky top-0 z-30"
        style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1 rounded-md"
          style={{ color: "var(--color-foreground)" }}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <SpectrLogo size={22} />
        <div style={{ width: 30 }} />
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="relative flex flex-col w-72 h-full shadow-xl"
            style={{ background: "var(--color-card)" }}
          >
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--color-border)" }}>
              <SpectrLogo size={24} showTag />
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-md"
                style={{ color: "var(--color-text-secondary)" }}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-4 pt-3 pb-2 border-b" style={{ borderColor: "var(--color-border)" }}>
              <CompanySwitcher onNav={() => setMobileOpen(false)} />
            </div>
            <SidebarContent onNav={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
