import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";
import { LogOut, ChevronsUpDown, Bell, ChartNoAxesColumn, House, Sparkles, Mic, Calendar, Settings as SettingsIcon, RefreshCw, Target, FlaskConical, Lightbulb, CircleAlert } from "lucide-react";
import { MicHalo } from "@/components/spectr/MicHalo";
import { PlayCard, InsightRow, ExperimentSummary, nextStep } from "@/components/spectr/GrowthCards";
import { useGrowth } from "@/lib/use-growth";
import { advancePlay, createExperiment, isLocalMode, type RepoCtx } from "@/lib/growth-repo";
import { applyInsight, createGrowthPlan } from "@/lib/growth-service";
import { ExperimentDialog } from "@/components/spectr/ExperimentDialog";
import type { Insight } from "@/lib/growth-types";
import { computeForecast, formatMetric } from "@/lib/growth-forecast";
import type { Play } from "@/lib/growth-types";

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

  return <GrowthHome />;
}

/* ─────────────────── Nav definitions ─────────────────── */
const NAV_ITEMS = [
  { to: "/", label: "Growth", icon: House },
  { to: "/transform", label: "Transform", icon: Sparkles },
  { to: "/record", label: "Record", icon: Mic },
  { to: "/results", label: "Results", icon: ChartNoAxesColumn },
  { to: "/distribute", label: "Distribute", icon: Calendar },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

const weekLabel = (iso?: string) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

/* ─────────────────── Growth home ─────────────────── */
function GrowthHome() {
  const { state } = useApp();
  const navigate = useNavigate();
  const ws = state.workspace;
  const firstName = state.user?.name?.split(" ")[0] || "there";
  const compName = ws.companyName || "";
  const ctx: RepoCtx | null = useMemo(
    () => (ws.companyId && state.user?.id ? { companyId: ws.companyId, userId: state.user.id } : null),
    [ws.companyId, state.user?.id],
  );
  const g = useGrowth(ctx);
  const [building, setBuilding] = useState(false);
  const [expPlay, setExpPlay] = useState<Play | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  const startExperiment = async (e: Parameters<React.ComponentProps<typeof ExperimentDialog>["onCreate"]>[0]) => {
    if (!ctx || !expPlay) return;
    await createExperiment(ctx, { playId: expPlay.id, ...e });
    setExpPlay(null);
    toast.success("Experiment started", { description: "Publish both hooks, then log each one's numbers in Results." });
    await g.reload();
  };

  const apply = async (i: Insight) => {
    if (!ctx || !g.plan) return;
    setApplying(i.id);
    try { toast.success("Plan updated", { description: await applyInsight(ctx, g.plan, i) }); await g.reload(); }
    catch (e: any) { toast.error("Could not apply", { description: e?.message }); }
    finally { setApplying(null); }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("spectr-access-verified");
    navigate({ to: "/access" });
  };

  const buildPlan = async (regenerate: boolean) => {
    if (!ctx) return;
    setBuilding(true);
    try {
      const r = await createGrowthPlan(ctx, ws, { regenerate });
      toast.success(regenerate ? "Plan regenerated" : "Your growth plan is ready", {
        description: r.source === "fallback" ? "Built from your workspace inputs. AI was unavailable." : undefined,
      });
      await g.reload();
    } catch (e: any) {
      toast.error("Could not build your plan", { description: e?.message });
    } finally {
      setBuilding(false);
    }
  };

  const goStep = async (p: Play) => {
    const step = nextStep(p);
    if (ctx && p.status === "suggested") await advancePlay(ctx, p.id, "in progress").catch(() => {});
    navigate({ to: step.to, search: { play: p.id } as any });
  };

  const forecast = useMemo(() => g.plan ? computeForecast({
    key: g.plan.northStarKey, label: g.plan.northStarMetric, ws, entries: g.entries, planCreatedAt: g.plan.createdAt,
  }) : null, [g.plan, ws, g.entries]);

  const expByPlay = useMemo(() => new Map(g.experiments.map((e) => [e.playId, e])), [g.experiments]);
  const latestExp = g.experiments[0];
  const latestInsight = g.insights.find((i) => !i.applied) ?? g.insights[0];
  const done = g.plays.filter((p) => p.status !== "suggested").length;

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
          <div className="sx-header-title">
            <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: "-0.01em", lineHeight: 1.1 }}>Growth</div>
            <div className="sx-hide-sm" style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.9)" }}>Hi {firstName}. Here is your plan and this week's plays.</div>
          </div>
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

        <main className="sx-main"><div className="sx-page gh-page">
          {g.status === "loading" && <GrowthSkeleton />}

          {g.status === "error" && (
            <div className="sx-glass gh-state" role="alert">
              <CircleAlert size={28} aria-hidden="true" />
              <div className="gh-state-title">We could not load your growth plan</div>
              <div className="gh-state-sub">{g.error}</div>
              <button type="button" className="gh-btn gh-btn--primary" onClick={() => g.reload()}>Try again</button>
            </div>
          )}

          {g.status === "ready" && !g.plan && (
            <div className="sx-glass gh-state">
              <Target size={30} aria-hidden="true" />
              <div className="gh-state-title">Let's build your growth plan</div>
              <div className="gh-state-sub">SPECTR turns your goal, audience and targets into a north star, content pillars and this week's plays. It takes a few seconds.</div>
              <button type="button" className="gh-btn gh-btn--primary" disabled={building} onClick={() => buildPlan(false)}>
                {building ? "Building your plan" : "Build my growth plan"}
              </button>
            </div>
          )}

          {g.status === "ready" && g.plan && forecast && (
            <>
              <div className="gh-top">
                {/* Goal and forecast */}
                <section className="sx-glass gh-goal" aria-labelledby="gh-goal-h">
                  <div className="gh-section-head">
                    <div>
                      <div className="gh-eyebrow">North star</div>
                      <h2 id="gh-goal-h" className="gh-h2">{g.plan.northStarMetric}</h2>
                    </div>
                    <button type="button" className="gh-btn gh-btn--ghost" disabled={building} onClick={() => buildPlan(true)}>
                      <RefreshCw size={15} className={building ? "animate-spin" : ""} aria-hidden="true" />{building ? "Regenerating" : "Regenerate plan"}
                    </button>
                  </div>
                  <p className="gh-goal-summary">{g.plan.goalSummary}</p>
                  {forecast.state === "no-target" ? (
                    <div className="gh-forecast-note">{forecast.sentence} <Link to="/settings" className="gh-link">Open Settings</Link></div>
                  ) : (
                    <>
                      <div className="gh-goal-numbers">
                        <span className="gh-big">{formatMetric(forecast.current, forecast.unit)}</span>
                        <span className="gh-of">of {formatMetric(forecast.target, forecast.unit)} target</span>
                      </div>
                      <div className="gh-progress" role="progressbar" aria-valuenow={Math.round(forecast.progressPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to target">
                        <div style={{ width: `${forecast.progressPct}%` }} />
                        {forecast.state === "ok" && <i style={{ left: `${Math.min(100, forecast.projectedPct)}%` }} title="Projected" />}
                      </div>
                      <div className="gh-forecast">
                        <div className="gh-forecast-main">{forecast.sentence}{forecast.gapSentence ? ` ${forecast.gapSentence}` : ""}</div>
                        {forecast.state === "ok" && <div className="gh-forecast-note">{forecast.assumption}</div>}
                        {forecast.state === "starter" && <Link to="/results" className="gh-link">Log a result</Link>}
                      </div>
                    </>
                  )}
                  <div className="gh-pillars">
                    {g.plan.pillars.map((p) => (
                      <span key={p.name} className="gh-pillar-chip" title={p.description}>{p.name}<b>{p.share}%</b></span>
                    ))}
                    <span className="gh-pillar-chip gh-pillar-chip--muted">{g.plan.cadencePerWeek} pieces a week</span>
                  </div>
                </section>

                {/* Record entry */}
                <section className="sx-glass gh-record" aria-label="Record">
                  <div className="gh-record-orb"><MicHalo state="idle" onClick={() => navigate({ to: "/record" })} /></div>
                  <div className="gh-record-title">Tap to record</div>
                  <div className="gh-record-sub">Talk through an idea. SPECTR turns it into content.</div>
                </section>
              </div>

              {/* This week's plays */}
              <section aria-labelledby="gh-plays-h">
                <div className="gh-section-head gh-section-head--bare">
                  <div>
                    <h2 id="gh-plays-h" className="gh-h2">This week's plays</h2>
                    <div className="gh-sub">Week of {weekLabel(g.plays[0]?.weekStart)} · {done} of {g.plays.length} started · aim for {g.plan.cadencePerWeek} pieces this week</div>
                  </div>
                </div>
                {g.plays.length ? (
                  <div className="gh-plays">
                    {g.plays.map((p) => <PlayCard key={p.id} play={p} experiment={expByPlay.get(p.id)} onStep={goStep} onExperiment={setExpPlay} />)}
                  </div>
                ) : (
                  <div className="sx-glass gh-state gh-state--inline">
                    <div className="gh-state-title">No plays for this week yet</div>
                    <div className="gh-state-sub">Generate fresh plays from your plan and latest results.</div>
                    <button type="button" className="gh-btn gh-btn--primary" disabled={building} onClick={() => buildPlan(true)}>{building ? "Generating" : "Generate this week's plays"}</button>
                  </div>
                )}
              </section>

              <div className="gh-bottom">
                <section className="sx-glass gh-card" aria-labelledby="gh-exp-h">
                  <div className="gh-card-head"><FlaskConical size={18} aria-hidden="true" /><h2 id="gh-exp-h" className="gh-h3">Latest experiment</h2></div>
                  {latestExp
                    ? <ExperimentSummary experiment={latestExp} play={g.allPlays.find((p) => p.id === latestExp.playId)} />
                    : <div className="gh-empty">Pick a play and choose Run as experiment to test two hooks against each other.</div>}
                </section>
                <section className="sx-glass gh-card" aria-labelledby="gh-ins-h">
                  <div className="gh-card-head"><Lightbulb size={18} aria-hidden="true" /><h2 id="gh-ins-h" className="gh-h3">Latest insight</h2></div>
                  {latestInsight
                    ? <InsightRow insight={latestInsight} onApply={apply} applying={applying === latestInsight.id} />
                    : <div className="gh-empty">Insights appear after you log results. They compare formats and pillars using your real numbers.</div>}
                  {g.insights.length > 1 && <Link to="/results" className="gh-link" style={{ marginTop: 12, display: "inline-block" }}>See all insights</Link>}
                </section>
              </div>
              {isLocalMode() && <div className="gh-local-note">Growth data is saved on this device until the growth database migration is applied.</div>}
            </>
          )}
        </div></main>
        {expPlay && <ExperimentDialog play={expPlay} onCancel={() => setExpPlay(null)} onCreate={startExperiment} />}
    </div>
  );
}

function GrowthSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your growth plan" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="gh-top">
        <div className="sx-glass gh-goal"><div className="tf-sk gh-sk" style={{ width: "40%", height: 26 }} /><div className="tf-sk gh-sk" style={{ width: "80%", height: 14, marginTop: 18 }} /><div className="tf-sk gh-sk" style={{ width: "100%", height: 10, marginTop: 26 }} /><div className="tf-sk gh-sk" style={{ width: "70%", height: 14, marginTop: 18 }} /></div>
        <div className="sx-glass gh-record"><div className="tf-sk gh-sk" style={{ width: 160, height: 160, borderRadius: "50%" }} /></div>
      </div>
      <div className="gh-plays">
        {[0, 1, 2].map((i) => <div key={i} className="sx-glass gh-play"><div className="tf-sk gh-sk" style={{ width: "50%", height: 12 }} /><div className="tf-sk gh-sk" style={{ width: "85%", height: 20, marginTop: 14 }} /><div className="tf-sk gh-sk" style={{ width: "100%", height: 54, marginTop: 14 }} /></div>)}
      </div>
    </div>
  );
}
