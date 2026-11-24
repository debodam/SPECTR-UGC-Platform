import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toPlainText } from "@/lib/markdown";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUp, ArrowUpRight, ChartNoAxesColumn, File, Plus } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";
import { MicHalo } from "@/components/spectr/MicHalo";
import { AppHeader, AppRail } from "@/components/spectr/AppChrome";
import { FormatChip, StatusChip } from "@/components/spectr/GrowthCards";
import { useGrowth } from "@/lib/use-growth";
import { advancePlay, type RepoCtx } from "@/lib/growth-repo";
import { createGrowthPlan } from "@/lib/growth-service";
import { computeForecast } from "@/lib/growth-forecast";
import { weekStartOf, type Play } from "@/lib/growth-types";
import { errMessage, friendlyError } from "@/lib/utils";
import { isDue, normalizeStatus, type PostItem } from "@/lib/posting";

export const Route = createFileRoute("/dashboard")({ component: RootPage });

/* ─────────────────── Root router ─────────────────── */
function RootPage() {
  const { state } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.authLoading) return;
    if (!state.isAuthenticated) navigate({ to: "/login" });
    else if (!state.workspace?.companyId || !state.setupComplete) navigate({ to: "/companies" });
  }, [
    state.authLoading,
    state.isAuthenticated,
    state.setupComplete,
    state.workspace?.companyId,
    navigate,
  ]);

  if (state.authLoading) return <div style={{ minHeight: "100vh" }} />;
  if (!state.isAuthenticated || !state.setupComplete) return null;

  return <Dashboard />;
}

/* ─────────────────── Helpers ─────────────────── */
const DAY = 86_400_000;
const compact = (n: number) =>
  n >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : Math.round(n).toLocaleString();

/**
 * Impression totals for the last 7 rolling 7-day windows (oldest first), from logged Results entries.
 * Rolling windows avoid a misleading "0, down 100%" early in a calendar week.
 */
function weeklyImpressions(entries: { date: string; impressions: number }[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const windowStart = today - 6 * DAY;
  return Array.from({ length: 7 }, (_, i) => {
    const start = windowStart - (6 - i) * 7 * DAY;
    return entries
      .filter((e) => {
        const t = new Date(e.date + "T00:00:00").getTime();
        return t >= start && t < start + 7 * DAY;
      })
      .reduce((s, e) => s + e.impressions, 0);
  });
}

function sparklinePath(data: number[], W = 240, H = 72) {
  const mn = Math.min(...data),
    mx = Math.max(...data);
  const span = mx - mn || 1;
  const pts: [number, number][] = data.map((v, i) => [
    i * (W / (data.length - 1)),
    H - 8 - ((v - mn) / span) * (H - 16),
  ]);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[i + 2] ?? p2;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return { line: d, area: d + ` L${W} ${H} L0 ${H} Z`, last: pts[pts.length - 1] };
}

interface QueueRow {
  date: string;
  time: string;
  status: string;
}
interface DraftRow {
  id: string;
  format: string;
  content: string;
}

/* ─────────────────── Dashboard ─────────────────── */
function Dashboard() {
  const { state } = useApp();
  const navigate = useNavigate();
  const ws = state.workspace;
  const firstName = state.user?.name?.split(" ")[0] || "there";
  const ctx: RepoCtx | null = useMemo(
    () =>
      ws.companyId && state.user?.id ? { companyId: ws.companyId, userId: state.user.id } : null,
    [ws.companyId, state.user?.id],
  );
  const g = useGrowth(ctx);

  // Quick record on the hero orb; the full recorder lives on Record.
  const [isRec, setIsRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(
    () => () => {
      if (ivRef.current) clearInterval(ivRef.current);
    },
    [],
  );
  const handleMic = () => {
    if (isRec) {
      if (ivRef.current) clearInterval(ivRef.current);
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

  // A workspace that finished setup before plans existed gets its plan built here, once, with no button.
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const autoRan = useRef(false);
  const generate = async () => {
    if (!ctx) return;
    setGenerating(true);
    setGenError("");
    try {
      await createGrowthPlan(ctx, ws);
      await g.reload();
    } catch (e) {
      setGenError(friendlyError(e, "Could not build your growth plan. Try again."));
    } finally {
      setGenerating(false);
    }
  };
  useEffect(() => {
    if (g.status === "ready" && !g.plan && ctx && !autoRan.current) {
      autoRan.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.status, g.plan, ctx]);

  // Queue and drafts for the Distribute and Ready to publish cards.
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  useEffect(() => {
    if (!ctx) return;
    supabase
      .from("queue_items")
      .select("date, time, status")
      .eq("company_id", ctx.companyId)
      .then(({ data }) => setQueue((data ?? []) as QueueRow[]));
    supabase
      .from("generations")
      .select("id, format, content")
      .eq("company_id", ctx.companyId)
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(2)
      .then(({ data }) => setDrafts((data ?? []) as DraftRow[]));
  }, [ctx]);

  const entries = g.entries;
  const weeks = useMemo(() => weeklyImpressions(entries), [entries]);
  const thisWeekImp = weeks[6],
    lastWeekImp = weeks[5];
  const impChange = lastWeekImp
    ? Math.round(((thisWeekImp - lastWeekImp) / lastWeekImp) * 100)
    : null;
  const spark = sparklinePath(weeks);
  const currentFollowers =
    Number(ws.baseline.followers || 0) + entries.reduce((s, e) => s + e.followersGained, 0);
  const recent = entries.slice(0, 8);
  const avgEng = recent.length
    ? Math.round((recent.reduce((s, e) => s + e.engagementRate, 0) / recent.length) * 10) / 10
    : 0;

  const forecast = useMemo(
    () =>
      computeForecast({
        key: g.plan?.northStarKey ?? "followers",
        label: g.plan?.northStarMetric ?? "LinkedIn followers",
        ws,
        entries,
        planCreatedAt: g.plan?.createdAt,
      }),
    [g.plan, ws, entries],
  );
  const followerTarget = Number(ws.targets.followers || 0);
  const goalPct = followerTarget ? Math.min(1, currentFollowers / followerTarget) : 0;
  const goalDash = (() => {
    const C = 2 * Math.PI * 56;
    return `${(C * goalPct).toFixed(1)} ${C.toFixed(1)}`;
  })();
  const programWeek = g.plan
    ? Math.min(
        12,
        Math.max(
          1,
          Math.floor((Date.now() - new Date(g.plan.createdAt).getTime()) / (7 * DAY)) + 1,
        ),
      )
    : 1;
  const onTrack = forecast.state === "ok" && forecast.projectedPct >= 100;

  const monday = new Date(weekStartOf() + "T00:00:00");
  const todayIso = new Date().toISOString().slice(0, 10);
  const week = ["M", "T", "W", "T", "F", "S", "S"].map((name, i) => {
    const day = new Date(monday.getTime() + i * DAY).toISOString().slice(0, 10);
    return { name, count: queue.filter((q) => q.date === day).length, isToday: day === todayIso };
  });
  const plannedThisWeek = week.reduce((s, d) => s + d.count, 0);
  const dueNow = queue.filter((q) =>
    isDue({ date: q.date, time: q.time, status: normalizeStatus(q.status) } as PostItem),
  ).length;

  const startPlay = async (p: Play) => {
    if (ctx && p.status === "suggested")
      await advancePlay(ctx, p.id, "in progress").catch(() => {});
    navigate({ to: "/record", search: { play: p.id } });
  };

  const planLoading = g.status === "loading" || generating;
  const topPlays = g.plays.slice(0, 3);
  const go = (to: "/results" | "/growth" | "/distribute" | "/transform") => () => navigate({ to });
  const goKey =
    (to: "/results" | "/growth" | "/distribute" | "/transform") => (e: React.KeyboardEvent) => {
      if (e.key === "Enter") navigate({ to });
    };

  return (
    <div className="sx-shell">
      <AppRail active="/dashboard" />
      <AppHeader title={`Hi, ${firstName}`} />

      <main className="sx-main sx-fit sx-fit-db">
        <div className="sx-page">
          <div className="db-layout">
            <div className="db-left">
              <div style={{ width: "100%" }}>
                <MicHalo state={isRec ? "recording" : "idle"} onClick={handleMic} />
                <div style={{ marginTop: 14, textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                    }}
                    aria-live="polite"
                  >
                    {isRec && <span className="mo-status-dot" aria-hidden="true" />}
                    {isRec ? "Recording" : "Tap to record"}
                    {isRec && (
                      <span
                        style={{
                          fontWeight: 500,
                          fontVariantNumeric: "tabular-nums",
                          color: "rgba(255,255,255,0.9)",
                        }}
                      >
                        {mm}:{ss}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.88)" }}>
                    {isRec ? "Tap the mic to stop" : "Turn a conversation into LinkedIn content"}
                  </div>
                </div>
              </div>

              {/* ── Growth plan card ── */}
              <section className="sx-glass gp-card" aria-labelledby="gp-h" data-tour="growth-card">
                <div className="gp-head">
                  <h2 id="gp-h" className="gp-title">
                    Growth plan
                  </h2>
                  {g.plan && (
                    <span className="gp-metric" title={g.plan.northStarMetric}>
                      {g.plan.northStarMetric}
                    </span>
                  )}
                </div>
                {planLoading ? (
                  <div
                    aria-busy="true"
                    aria-label={
                      generating ? "Building your growth plan" : "Loading your growth plan"
                    }
                  >
                    <div className="gp-sub">
                      {generating
                        ? "Building your plan from your goals and audience"
                        : "Loading your plan"}
                    </div>
                    <div className="tf-sk gh-sk" style={{ height: 8, marginTop: 12 }} />
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="tf-sk gh-sk"
                        style={{ height: 22, marginTop: 10, width: `${90 - i * 12}%` }}
                      />
                    ))}
                  </div>
                ) : genError || g.status === "error" ? (
                  <div role="alert">
                    <div className="gp-sub">
                      We could not load your growth plan. {genError || g.error}
                    </div>
                    <button
                      type="button"
                      className="gh-btn gh-btn--small"
                      style={{ marginTop: 10 }}
                      onClick={() => (genError ? generate() : g.reload())}
                    >
                      Try again
                    </button>
                  </div>
                ) : g.plan ? (
                  <>
                    <div
                      className="gh-progress"
                      style={{ marginTop: 10 }}
                      role="progressbar"
                      aria-valuenow={Math.round(forecast.progressPct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Progress to target"
                    >
                      <div
                        style={{
                          transform: `scaleX(${Math.min(100, Math.max(0, forecast.progressPct)) / 100})`,
                        }}
                      />
                    </div>
                    <div className="gp-forecast">{forecast.sentence}</div>
                    <ul className="gp-plays" aria-label="This week's top plays">
                      {topPlays.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="gp-play"
                            onClick={() => startPlay(p)}
                            aria-label={`Start play: ${p.title}`}
                          >
                            <span className="gp-play-title">{p.title}</span>
                            <FormatChip format={p.format} />
                            <StatusChip status={p.status} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/growth"
                      className="gh-btn gh-btn--primary gp-cta"
                      data-tour="view-growth"
                    >
                      View full growth plan
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </>
                ) : null}
              </section>
            </div>

            <div className="db-right">
              <div className="db-cards">
                {/* LinkedIn impressions */}
                <div
                  className="db-card sx-glass db-tile"
                  role="link"
                  tabIndex={0}
                  onClick={go("/results")}
                  onKeyDown={goKey("/results")}
                >
                  <div className="db-tile-head">
                    <div className="db-tile-title">LinkedIn impressions</div>
                    <div className="db-arrow">
                      <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" />
                    </div>
                  </div>
                  {entries.length ? (
                    <>
                      <div
                        style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 10 }}
                      >
                        <div className="db-big">{compact(thisWeekImp)}</div>
                        {impChange !== null && (
                          <div className={`db-delta${impChange < 0 ? " is-down" : ""}`}>
                            <ArrowUp size={12} strokeWidth={3} aria-hidden="true" />
                            {Math.abs(impChange)}%
                          </div>
                        )}
                      </div>
                      <div className="db-note">Last 7 days vs the 7 before</div>
                      <div className="db-spark-wrap">
                        <svg
                          aria-hidden="true"
                          className="db-spark"
                          width="100%"
                          height="72"
                          viewBox="0 0 240 72"
                          preserveAspectRatio="none"
                          style={{ display: "block", overflow: "visible" }}
                        >
                          <defs>
                            <linearGradient id="spk" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0" stopColor="#ffffff" stopOpacity="0.38" />
                              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d={spark.area} fill="url(#spk)" />
                          <path
                            d={spark.line}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>
                        {/* The end point is an HTML dot, so it stays round while the chart stretches to the card. */}
                        <span
                          className="db-spark-dot"
                          style={{
                            left: `${(spark.last[0] / 240) * 100}%`,
                            top: `${(spark.last[1] / 72) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="db-chips">
                        <span>
                          Followers <b>{currentFollowers.toLocaleString()}</b>
                        </span>
                        <span>
                          Engagement <b>{avgEng}%</b>
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        className="db-big"
                        style={{ marginTop: 18, color: "rgba(255,255,255,0.55)" }}
                      >
                        0
                      </div>
                      <svg
                        aria-hidden="true"
                        className="db-spark"
                        width="100%"
                        height="72"
                        viewBox="0 0 240 72"
                        preserveAspectRatio="none"
                        style={{ display: "block" }}
                      >
                        <path
                          d="M0 56 H240"
                          stroke="#ffffff"
                          strokeOpacity="0.5"
                          strokeWidth="2"
                          strokeDasharray="3 7"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="db-empty">
                        Stats show up after you log your first results.
                      </div>
                    </>
                  )}
                </div>

                {/* 12-week goal */}
                <div
                  className="db-card sx-glass db-tile"
                  role="link"
                  tabIndex={0}
                  onClick={go("/growth")}
                  onKeyDown={goKey("/growth")}
                >
                  <div className="db-tile-head">
                    <div className="db-tile-title">12-week goal</div>
                    <div className="db-arrow">
                      <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" />
                    </div>
                  </div>
                  {followerTarget ? (
                    <>
                      <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
                        <div className="db-ring" style={{ position: "relative" }}>
                          <svg
                            aria-hidden="true"
                            width="100%"
                            height="100%"
                            viewBox="0 0 132 132"
                            style={{ transform: "rotate(-90deg)", display: "block" }}
                          >
                            <circle
                              cx="66"
                              cy="66"
                              r="56"
                              fill="none"
                              stroke="#ffffff"
                              strokeOpacity="0.22"
                              strokeWidth="10"
                            />
                            <circle
                              cx="66"
                              cy="66"
                              r="56"
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth="10"
                              strokeLinecap="round"
                              strokeDasharray={goalDash}
                              style={{
                                transition: "stroke-dasharray .8s ease",
                                opacity: goalPct > 0 ? 1 : 0.3,
                              }}
                            />
                          </svg>
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 34,
                                fontWeight: 300,
                                letterSpacing: "-0.02em",
                                lineHeight: 1,
                              }}
                            >
                              {Math.round(goalPct * 100)}%
                            </div>
                            <div
                              style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.9)" }}
                            >
                              Week {programWeek} of 12
                            </div>
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div style={{ fontSize: 14 }}>
                          {currentFollowers.toLocaleString()} of {followerTarget.toLocaleString()}{" "}
                          followers
                        </div>
                        <span
                          className={`gh-chip ${onTrack ? "gh-chip--done" : forecast.state === "ok" ? "db-chip-behind" : "gh-chip--neutral"}`}
                        >
                          {onTrack
                            ? "On track"
                            : forecast.state === "ok"
                              ? "Behind"
                              : "Just started"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ marginTop: 40, textAlign: "center" }}>
                      <div className="db-empty-icon db-empty-icon--round">
                        <ChartNoAxesColumn size={28} strokeWidth={1.6} aria-hidden="true" />
                      </div>
                      <div className="db-empty" style={{ marginTop: 16 }}>
                        Set a follower target in Settings to track 12-week progress.
                      </div>
                    </div>
                  )}
                </div>

                {/* Distribute */}
                <div
                  className="db-card sx-glass db-tile"
                  role="link"
                  tabIndex={0}
                  onClick={go("/distribute")}
                  onKeyDown={goKey("/distribute")}
                >
                  <div className="db-tile-head">
                    <div
                      className="db-tile-title"
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      Distribute
                      {dueNow > 0 && <span className="ds-badge ds-badge--due">{dueNow} due</span>}
                    </div>
                    <div className="db-arrow">
                      <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" />
                    </div>
                  </div>
                  <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 16 }}>
                    <div className="db-plus">
                      <Plus size={30} strokeWidth={2.2} aria-hidden="true" />
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>
                        Create a post
                      </div>
                      <div style={{ marginTop: 3, fontSize: 14, color: "rgba(255,255,255,0.9)" }}>
                        {plannedThisWeek
                          ? `${plannedThisWeek} planned this week`
                          : "Nothing planned yet"}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between" }}>
                    {week.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                          {d.name}
                        </div>
                        <div
                          className={`db-day${d.count ? " has-post" : ""}${d.isToday ? " is-today" : ""}`}
                        >
                          {d.count || ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ready to publish */}
                <div
                  className="db-card sx-glass db-tile"
                  role="link"
                  tabIndex={0}
                  onClick={go("/transform")}
                  onKeyDown={goKey("/transform")}
                >
                  <div className="db-tile-head">
                    <div
                      className="db-tile-title"
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      Ready to publish
                      {drafts.length > 0 && <span className="db-count">{drafts.length}</span>}
                    </div>
                    <div className="db-arrow">
                      <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" />
                    </div>
                  </div>
                  {drafts.length ? (
                    <div
                      style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}
                    >
                      {drafts.map((d) => (
                        <div key={d.id} className="db-draft">
                          <span className="db-draft-icon">
                            <File size={18} strokeWidth={1.8} aria-hidden="true" />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div className="db-draft-title">
                              {toPlainText(d.content)
                                .split("\n")
                                .find((l) => l.trim() && !/^option \d+\s*$/i.test(l.trim()))
                                ?.slice(0, 60) || "Untitled draft"}
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12.5,
                              }}
                            >
                              <span className="gh-chip gh-chip--done">Draft</span>
                              <span style={{ color: "rgba(255,255,255,0.88)" }}>
                                {d.format === "Post" ? "Posts" : d.format}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>View all in History</div>
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop: 22,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        gap: 12,
                      }}
                    >
                      <div className="db-empty-icon">
                        <File size={24} strokeWidth={1.8} aria-hidden="true" />
                      </div>
                      <div className="db-empty">
                        No drafts yet. Record a take or paste a transcript to make your first one.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Helper text + CTA ── */}
              <div className="db-cta">
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "rgba(255,255,255,0.9)",
                    maxWidth: 380,
                  }}
                >
                  {forecast.gapSentence ||
                    (g.plan
                      ? `Your plan calls for ${g.plan.cadencePerWeek} pieces a week. This week's plays are ready.`
                      : "Ideas come from your goals and what your audience reacts to.")}
                </div>
                <button type="button" className="db-ideas" onClick={go("/growth")}>
                  See ideas
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
