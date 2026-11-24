import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppGate, AppHeader, AppRail } from "@/components/spectr/AppChrome";
import { errMessage, friendlyError } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, X, Plus, SquarePen, Trash2 } from "lucide-react";
import { useApp, type PerfEntry, type Format } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";
import { ExperimentSummary, InsightRow, PlayBanner } from "@/components/spectr/GrowthCards";
import { ResultSheet, type ResultValues } from "@/components/spectr/ResultSheet";
import { loadLocalPending, removeLocalPending, type PendingResult } from "@/lib/posting";
import { perfFromRow, playSearch, useGrowth, usePlay } from "@/lib/use-growth";
import { applyInsight, declareWinner, refreshInsights } from "@/lib/growth-service";
import { variantResult } from "@/lib/growth-insights";
import { computeForecast } from "@/lib/growth-forecast";
import type { Experiment, Insight } from "@/lib/growth-types";
import { loadAllPlays, upsertWithLinks, type RepoCtx } from "@/lib/growth-repo";
import { syncPlayResults } from "@/lib/growth-service";
import { toAppFormat, type Play } from "@/lib/growth-types";

export const Route = createFileRoute("/results")({
  component: () => (
    <AppGate>
      <TrackPage />
    </AppGate>
  ),
  validateSearch: playSearch,
});

const FORMATS: Format[] = ["Article", "Post", "Video Script"];
const SOURCES = ["Transcript", "Notes", "Draft"] as const;
const COLS = "84px 1.5fr 110px 100px 92px 66px 82px 1.2fr 76px";

// --- DB conversions ---

function toRow(e: PerfEntry, companyId: string, userId: string) {
  return {
    id: e.id,
    company_id: companyId,
    user_id: userId,
    date: e.date,
    title: e.title,
    format: e.format,
    source: e.source,
    impressions: e.impressions,
    engagement_rate: e.engagementRate,
    followers_gained: e.followersGained,
    notes: e.notes,
  };
}

function blank(): Partial<PerfEntry> {
  return {
    date: new Date().toISOString().slice(0, 10),
    title: "",
    format: "Article",
    source: "Transcript",
    impressions: 0,
    engagementRate: 0,
    followersGained: 0,
    notes: "",
  };
}

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function sumByFormat(entries: PerfEntry[]) {
  const r: Record<Format, { imp: number; eng: number; count: number }> = {
    Article: { imp: 0, eng: 0, count: 0 },
    Post: { imp: 0, eng: 0, count: 0 },
    "Video Script": { imp: 0, eng: 0, count: 0 },
  };
  for (const e of entries) {
    if (e.format in r) {
      r[e.format].imp += e.impressions;
      r[e.format].eng += e.engagementRate;
      r[e.format].count += 1;
    }
  }
  return r;
}

// --- Trend chart ---

function TrendChart({ entries, baseline }: { entries: PerfEntry[]; baseline: number }) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return (
      <div style={{ flex: 1, position: "relative", marginTop: 12 }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 430 190"
          preserveAspectRatio="none"
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <g stroke="rgba(255,255,255,0.22)" strokeWidth="1">
            <line x1="0" y1="20" x2="430" y2="20" />
            <line x1="0" y1="70" x2="430" y2="70" />
            <line x1="0" y1="120" x2="430" y2="120" />
            <line x1="0" y1="170" x2="430" y2="170" />
          </g>
        </svg>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: "rgba(255,255,255,0.9)",
            textAlign: "center",
          }}
        >
          Log entries to see your follower trend.
        </div>
      </div>
    );
  }
  let acc = baseline;
  const pts = sorted.map((e) => {
    acc += e.followersGained;
    return acc;
  });
  const max = Math.max(...pts, baseline + 1);
  const min = Math.min(...pts, baseline);
  const W = 430,
    H = 190;
  const xs = pts.map((_, i) => 10 + (i / Math.max(1, pts.length - 1)) * (W - 20));
  const ys = pts.map((p) => H - 20 - ((p - min) / Math.max(1, max - min)) * (H - 40));
  const pathD = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const fillD = pathD + ` L${xs[xs.length - 1]},${H} L${xs[0]},${H}Z`;
  return (
    <div style={{ flex: 1, position: "relative", marginTop: 12 }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 430 190"
        preserveAspectRatio="none"
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <g stroke="rgba(255,255,255,0.22)" strokeWidth="1">
          <line x1="0" y1="20" x2="430" y2="20" />
          <line x1="0" y1="70" x2="430" y2="70" />
          <line x1="0" y1="120" x2="430" y2="120" />
          <line x1="0" y1="170" x2="430" y2="170" />
        </g>
        <path d={fillD} fill="rgba(255,255,255,0.14)" />
        <path d={pathD} fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// --- Main page ---

function TrackPage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const ws = state.workspace;
  const companyId = ws.companyId;
  const userId = state.user?.id;

  const [entries, setEntries] = useState<PerfEntry[]>([]);
  const [pending, setPending] = useState<PendingResult[]>([]);
  const [sheetFor, setSheetFor] = useState<PendingResult | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoadingEntries(false);
      return;
    }
    setLoadingEntries(true);
    supabase
      .from("perf_entries")
      .select("*")
      .eq("company_id", companyId)
      .order("date", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Failed to load entries");
        else {
          const rows = (data ?? []).map(perfFromRow);
          setEntries(rows.filter((e) => !e.pending));
          setPending([
            ...rows
              .filter((e) => e.pending)
              .map((e) => ({
                id: e.id,
                title: e.title,
                format: e.format,
                date: e.date,
                playId: e.playId ?? null,
                store: "db" as const,
              })),
            ...loadLocalPending(companyId),
          ]);
        }
        setLoadingEntries(false);
      });
  }, [companyId]);

  const currentFollowers =
    Number(ws.baseline.followers || 0) + entries.reduce((s, e) => s + e.followersGained, 0);

  const kpis = [
    { name: "Followers", current: currentFollowers, target: Number(ws.targets.followers || 0) },
    {
      name: "Weekly impressions",
      current: avg(entries.map((e) => e.impressions)),
      target: Number(ws.targets.weeklyImpressions || 0),
    },
    {
      name: "Avg engagement rate",
      current: avg(entries.map((e) => e.engagementRate)),
      target: Number(ws.targets.engagementRate || 0),
      suffix: "%",
    },
    {
      name: "Monthly profile visitors",
      current: Number(ws.baseline.monthlyVisitors || 0),
      target: Number(ws.targets.monthlyVisitors || 0),
    },
    {
      name: "Weekly page searches",
      current: Number(ws.baseline.weeklyPageSearches || 0),
      target: Number(ws.targets.weeklyPageSearches || 0),
    },
  ];

  const totals = useMemo(() => sumByFormat(entries), [entries]);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PerfEntry>>(blank());
  const [saving, setSaving] = useState(false);
  const { play: playId } = Route.useSearch();
  const ctx: RepoCtx | null = useMemo(
    () => (companyId && userId ? { companyId, userId } : null),
    [companyId, userId],
  );
  const { play, refresh: refreshPlay } = usePlay(ctx, playId);
  const [plays, setPlays] = useState<Play[]>([]);
  const [linkPlayId, setLinkPlayId] = useState("");
  const reloadPlays = () => {
    if (ctx)
      loadAllPlays(ctx)
        .then(setPlays)
        .catch(() => setPlays([]));
  };
  const g = useGrowth(ctx);
  const [busy, setBusy] = useState<string | null>(null);
  const runningExp = useMemo(
    () => g.experiments.find((x) => x.playId === linkPlayId && x.status === "running"),
    [g.experiments, linkPlayId],
  );
  const liveExp = (x: Experiment): Experiment =>
    x.status === "complete"
      ? x
      : { ...x, result: { a: variantResult(x, entries, "a"), b: variantResult(x, entries, "b") } };

  const apply = async (i: Insight) => {
    if (!ctx || !g.plan) return;
    setBusy(i.id);
    try {
      toast.success("Plan updated", { description: await applyInsight(ctx, g.plan, i) });
      await g.reload();
    } catch (e) {
      toast.error("Could not apply", { description: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  };

  const declare = async (x: Experiment, winner: "a" | "b") => {
    if (!ctx) return;
    setBusy(x.id);
    try {
      const title = g.allPlays.find((p) => p.id === x.playId)?.title ?? "this play";
      toast.success("Winner declared", {
        description: await declareWinner(ctx, x, winner, entries, title),
      });
      await g.reload();
    } catch (e) {
      toast.error("Could not declare a winner", { description: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  };

  useEffect(reloadPlays, [ctx]);

  const startFromPlay = (p: Play | undefined) => {
    setLinkPlayId(p?.id ?? "");
    if (p) setDraft((d) => ({ ...d, title: d.title || p.title, format: toAppFormat(p.format) }));
  };

  // Opened from a play: open the add row prefilled and linked.
  useEffect(() => {
    if (play) {
      setAdding(true);
      setEditingId(null);
      setDraft({ ...blank(), title: play.title, format: toAppFormat(play.format) });
      setLinkPlayId(play.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play?.id]);

  const save = async () => {
    if (!companyId || !userId) {
      toast.error("No active company");
      return;
    }
    setSaving(true);
    const entry: PerfEntry = {
      id: editingId ?? crypto.randomUUID(),
      date: draft.date || new Date().toISOString().slice(0, 10),
      title: draft.title || "Untitled",
      format: (draft.format as Format) || "Article",
      source: (draft.source as PerfEntry["source"]) || "Transcript",
      impressions: Number(draft.impressions ?? 0),
      engagementRate: Number(draft.engagementRate ?? 0),
      followersGained: Number(draft.followersGained ?? 0),
      notes: draft.notes || "",
      playId: linkPlayId || null,
      variant: (draft.variant as PerfEntry["variant"]) ?? null,
    };
    const { error } = await upsertWithLinks("perf_entries", toRow(entry, companyId, userId), {
      play_id: entry.playId,
      variant: entry.variant,
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to save entry");
      return;
    }
    const next = [entry, ...entries.filter((e) => e.id !== entry.id)].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    setEntries(next);
    setAdding(false);
    setEditingId(null);
    setDraft(blank());
    setLinkPlayId("");
    toast.success("Entry saved");
    await afterSave(entry, next);
  };

  /** Play numbers and insights follow every saved entry. */
  const afterSave = async (entry: PerfEntry, next: PerfEntry[]) => {
    if (ctx && entry.playId) {
      await syncPlayResults(ctx, entry.playId, next).catch(() => {});
      refreshPlay();
      reloadPlays();
    }
    if (ctx) {
      // Insights are recomputed from the real numbers after every new entry.
      const fresh = await loadAllPlays(ctx).catch(() => plays);
      const projectedPct = g.plan
        ? computeForecast({
            key: g.plan.northStarKey,
            label: g.plan.northStarMetric,
            ws,
            entries: next,
            planCreatedAt: g.plan.createdAt,
          }).projectedPct
        : undefined;
      refreshInsights(ctx, ws, { entries: next, plays: fresh, plan: g.plan, projectedPct })
        .then(() => g.reload())
        .catch(() => {});
    }
  };

  // Numbers for a post marked as posted in Distribute.
  const saveSheet = async (p: PendingResult, v: ResultValues) => {
    if (!companyId || !userId) return;
    const entry: PerfEntry = {
      id: p.store === "db" ? p.id : crypto.randomUUID(),
      date: p.date,
      title: p.title,
      format: p.format,
      source: "Draft",
      impressions: v.impressions,
      engagementRate: v.engagementRate,
      followersGained: v.followersGained,
      notes: v.notes,
      playId: p.playId,
      variant: null,
    };
    const { error } = await upsertWithLinks(
      "perf_entries",
      toRow(entry, companyId, userId),
      p.store === "db" ? { pending: false, play_id: p.playId } : { play_id: p.playId },
    );
    if (error) {
      toast.error("Could not save the results", { description: friendlyError(error) });
      throw new Error(error.message);
    }
    if (p.store === "local") removeLocalPending(companyId, p.id);
    setPending((prev) => prev.filter((x) => x.id !== p.id));
    setSheetFor(null);
    const next = [entry, ...entries].sort((a, b) => b.date.localeCompare(a.date));
    setEntries(next);
    toast.success("Results logged", {
      description: "Your forecast and insights now include them.",
    });
    await afterSave(entry, next);
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("perf_entries").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete entry");
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast("Entry deleted");
  };

  const inStyle: React.CSSProperties = {
    height: 36,
    width: "100%",
    boxSizing: "border-box",
    padding: "0 10px",
    border: 0,
    borderRadius: 12,
    background: "rgba(255,255,255,0.18)",
    color: "#ffffff",
    fontFamily: "inherit",
    fontSize: 14,
  };

  const totalImpressionsForShare = FORMATS.reduce((s, f) => s + totals[f].imp, 0);

  return (
    <div className="sx-shell">
      <AppRail active="/results" />

      <AppHeader
        title="Results"
        subtitle="Measure what is working. Double down on what performs."
      />

      <main className="sx-main">
        <div className="sx-page">
          {play && (
            <PlayBanner
              play={play}
              note={
                play.status === "measured"
                  ? "Results logged and attached to this play. Your forecast and insights now include them."
                  : "Enter the numbers for this play below. Saving attaches them to the play and marks it measured."
              }
              onClear={() => navigate({ to: "/results", search: {} })}
              action={
                play.status === "measured" ? (
                  <button
                    type="button"
                    className="gh-btn gh-btn--primary"
                    onClick={() => navigate({ to: "/dashboard" })}
                  >
                    Back to Growth
                  </button>
                ) : undefined
              }
            />
          )}
          {pending.length > 0 && (
            <section
              className="sx-glass rs-pending"
              aria-labelledby="rs-pending-h"
              data-tour="pending-results"
            >
              <h2 id="rs-pending-h" className="gh-h3">
                Waiting for numbers
              </h2>
              <p className="gh-sub" style={{ margin: "4px 0 10px" }}>
                Posted pieces need their results. Add them 24 to 48 hours after posting.
              </p>
              {pending.map((p) => (
                <div key={p.id} className="rs-pending-row">
                  <span className="rs-pending-title">{p.title}</span>
                  <span className="ds-pill">{p.format}</span>
                  <span className="rs-pending-date">
                    Posted{" "}
                    {new Date(p.date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <button
                    type="button"
                    className="gh-btn gh-btn--small gh-btn--primary"
                    onClick={() => setSheetFor(p)}
                  >
                    Log numbers
                  </button>
                </div>
              ))}
            </section>
          )}
          {/* KPI row */}
          <div className="tr-kpis">
            {kpis.map((k) => {
              const pct = k.target ? Math.min(100, (k.current / k.target) * 100) : 0;
              const onTrack = k.target > 0 && k.current >= k.target * 0.9;
              const val = k.suffix
                ? (Math.round(k.current * 10) / 10).toFixed(1) + k.suffix
                : Math.round(k.current).toLocaleString();
              const targetLabel = k.target
                ? k.suffix
                  ? k.target + k.suffix
                  : k.target.toLocaleString()
                : "-";
              return (
                <div
                  key={k.name}
                  className="sx-glass"
                  style={{ minHeight: 124, padding: "16px 18px", borderRadius: 22 }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.92)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {k.name}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 32,
                      fontWeight: 300,
                      letterSpacing: "-0.02em",
                      lineHeight: 1.1,
                    }}
                  >
                    {val}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      fontSize: 12.5,
                      color: "rgba(255,255,255,0.85)",
                    }}
                  >
                    <span>Target {targetLabel}</span>
                    <span
                      style={{
                        height: 22,
                        padding: "0 9px",
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        flexShrink: 0,
                        background: onTrack ? "rgba(255,255,255,0.2)" : "#ffffff",
                        color: onTrack ? "#ffffff" : "#0b3a75",
                      }}
                    >
                      {onTrack ? "On track" : "Behind"}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.25)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 3,
                        background: "#ffffff",
                        width: `${pct}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Content performance log */}
          <div
            className="sx-glass"
            style={{
              minHeight: 300,
              maxHeight: 480,
              padding: "20px 24px",
              borderRadius: 26,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexShrink: 0,
                minHeight: 44,
              }}
            >
              <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>
                Content performance log
              </div>
              {entries.length > 0 && (
                <span
                  style={{
                    minWidth: 24,
                    height: 24,
                    padding: "0 8px",
                    boxSizing: "border-box",
                    borderRadius: 12,
                    background: "#ffffff",
                    color: "#0a66c2",
                    fontSize: 13,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {entries.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  setDraft(blank());
                }}
                style={{
                  marginLeft: "auto",
                  height: 44,
                  padding: "0 18px",
                  borderRadius: 12,
                  border: 0,
                  background: "#ffffff",
                  color: "#0a66c2",
                  fontFamily: "inherit",
                  fontSize: 15,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxShadow: "0 10px 24px rgba(6,42,92,0.22)",
                }}
              >
                <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
                Add entry
              </button>
            </div>

            <div className="tr-table">
              <div
                className={`tr-table-inner${entries.length === 0 && !adding ? " is-empty" : ""}`}
              >
                {/* Column headers */}
                <div
                  className="tr-cols"
                  style={{
                    flexShrink: 0,
                    marginTop: 6,
                    display: "grid",
                    gridTemplateColumns: COLS,
                    gap: 12,
                    padding: "0 12px",
                    height: 30,
                    alignItems: "center",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  {[
                    "Date",
                    "Title",
                    "Format",
                    "Source",
                    "Impressions",
                    "Eng %",
                    "Followers",
                    "Notes",
                    "",
                  ].map((h) => (
                    <span key={h}>{h}</span>
                  ))}
                </div>

                {(adding || editingId) && plays.length > 0 && (
                  <div className="tr-linkrow">
                    <label htmlFor="tr-play">Result for a play</label>
                    <select
                      id="tr-play"
                      className="tf-in"
                      value={linkPlayId}
                      onChange={(e) => startFromPlay(plays.find((p) => p.id === e.target.value))}
                    >
                      <option value="">Not from a play</option>
                      {plays.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    {runningExp && (
                      <>
                        <label htmlFor="tr-variant">Hook</label>
                        <select
                          id="tr-variant"
                          className="tf-in"
                          value={draft.variant ?? ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              variant: (e.target.value || null) as PerfEntry["variant"],
                            })
                          }
                        >
                          <option value="">Which hook was this?</option>
                          <option value="a">Hook A: {runningExp.variantA.slice(0, 48)}</option>
                          <option value="b">Hook B: {runningExp.variantB.slice(0, 48)}</option>
                        </select>
                      </>
                    )}
                  </div>
                )}
                {/* Inline add row */}
                {adding && (
                  <AddRow
                    draft={draft}
                    setDraft={setDraft}
                    onSave={save}
                    onCancel={() => {
                      setAdding(false);
                      setDraft(blank());
                    }}
                    saving={saving}
                    inStyle={inStyle}
                  />
                )}

                {/* Data rows or empty state */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                  }}
                >
                  {loadingEntries ? (
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      Loading entries...
                    </div>
                  ) : entries.length === 0 && !adding ? (
                    <div
                      style={{
                        flex: 1,
                        marginTop: 6,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        borderRadius: 18,
                        border: "1.5px dashed rgba(255,255,255,0.5)",
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 600 }}>No entries yet</div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "rgba(255,255,255,0.9)",
                          textAlign: "center",
                          padding: "0 16px",
                        }}
                      >
                        Log your first piece of content to start tracking what works.
                      </div>
                    </div>
                  ) : (
                    entries.map((e) =>
                      editingId === e.id ? (
                        <AddRow
                          key={e.id}
                          draft={draft}
                          setDraft={setDraft}
                          onSave={save}
                          onCancel={() => {
                            setEditingId(null);
                            setDraft(blank());
                          }}
                          saving={saving}
                          inStyle={inStyle}
                        />
                      ) : (
                        <div
                          key={e.id}
                          className="tr-row"
                          style={{
                            flexShrink: 0,
                            display: "grid",
                            gridTemplateColumns: COLS,
                            gap: 12,
                            padding: "0 12px",
                            height: 46,
                            alignItems: "center",
                            borderTop: "1px solid rgba(255,255,255,0.22)",
                            fontSize: 14,
                          }}
                        >
                          <span style={{ color: "rgba(255,255,255,0.9)" }}>
                            {e.date.slice(5).replace("-", " ")}
                          </span>
                          <span
                            style={{
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {e.title}
                          </span>
                          <span>
                            <span
                              style={{
                                height: 24,
                                padding: "0 10px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.24)",
                                fontSize: 12.5,
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                            >
                              {e.format}
                            </span>
                          </span>
                          <span>{e.source}</span>
                          <span>{e.impressions.toLocaleString()}</span>
                          <span>{e.engagementRate}%</span>
                          <span>
                            {e.followersGained > 0 ? `+${e.followersGained}` : e.followersGained}
                          </span>
                          <span
                            style={{
                              color: "rgba(255,255,255,0.85)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {e.notes}
                          </span>
                          <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(e.id);
                                setDraft(e);
                                setLinkPlayId(e.playId ?? "");
                              }}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                border: "1px solid rgba(255,255,255,0.4)",
                                background: "transparent",
                                color: "#ffffff",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 0,
                              }}
                            >
                              <SquarePen size={13} strokeWidth={2.2} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => del(e.id)}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                border: "1px solid rgba(255,255,255,0.4)",
                                background: "transparent",
                                color: "#ffffff",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 0,
                              }}
                            >
                              <Trash2 size={13} strokeWidth={2.2} aria-hidden="true" />
                            </button>
                          </span>
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {g.status === "ready" && g.plan && (
            <div className="tr-growth">
              <section className="sx-glass" aria-labelledby="tr-ins-h">
                <h2 id="tr-ins-h" style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 600 }}>
                  Insights
                </h2>
                {g.insights.length ? (
                  g.insights
                    .slice(0, 6)
                    .map((i) => (
                      <InsightRow key={i.id} insight={i} onApply={apply} applying={busy === i.id} />
                    ))
                ) : (
                  <div className="gh-empty">
                    Insights appear once you have logged results across at least two formats or
                    plays.
                  </div>
                )}
              </section>
              <section className="sx-glass" aria-labelledby="tr-exp-h" data-tour="experiments">
                <h2 id="tr-exp-h" style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 600 }}>
                  Experiments
                </h2>
                {g.experiments.length ? (
                  g.experiments.slice(0, 4).map((x) => {
                    const live = liveExp(x);
                    const ready = !!(live.result.a && live.result.b);
                    const lead = ready
                      ? live.result.a!.value >= live.result.b!.value
                        ? "a"
                        : "b"
                      : null;
                    return (
                      <div key={x.id} className="tr-exp">
                        <ExperimentSummary
                          experiment={live}
                          play={g.allPlays.find((p) => p.id === x.playId)}
                        />
                        {x.status === "running" && (
                          <div className="tr-exp-actions">
                            {ready ? (
                              <>
                                <span>
                                  Hook {lead!.toUpperCase()} is ahead. Declare the winner:
                                </span>
                                <button
                                  type="button"
                                  className="gh-btn gh-btn--small"
                                  disabled={busy === x.id}
                                  onClick={() => declare(x, "a")}
                                >
                                  Hook A wins
                                </button>
                                <button
                                  type="button"
                                  className="gh-btn gh-btn--small"
                                  disabled={busy === x.id}
                                  onClick={() => declare(x, "b")}
                                >
                                  Hook B wins
                                </button>
                              </>
                            ) : (
                              <span>
                                Log results for both hooks to compare them. Pick the play and the
                                hook when you add an entry.
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="gh-empty">
                    No experiments yet. On Growth, pick a play and choose Run as experiment.
                  </div>
                )}
              </section>
            </div>
          )}

          <div className="tr-bottom">
            {/* Format intelligence */}
            <div style={{ minWidth: 0 }} data-tour="format-intel">
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>
                Format intelligence
              </div>
              <div className="tr-formats" style={{ marginTop: 12 }}>
                {FORMATS.map((f) => {
                  const t = totals[f];
                  const pct = totalImpressionsForShare
                    ? Math.round((t.imp / totalImpressionsForShare) * 100)
                    : 0;
                  const avgImp = t.count ? Math.round(t.imp / t.count).toLocaleString() : "-";
                  const avgEng = t.count ? `${(t.eng / t.count).toFixed(1)}%` : "-";
                  return (
                    <div
                      key={f}
                      className="sx-glass"
                      style={{ minHeight: 226, padding: 18, borderRadius: 22 }}
                    >
                      <span
                        style={{
                          height: 26,
                          padding: "0 12px",
                          borderRadius: 999,
                          background: "#ffffff",
                          color: "#0a66c2",
                          fontSize: 12.5,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        {f}
                      </span>
                      <div
                        style={{
                          marginTop: 18,
                          display: "flex",
                          flexDirection: "column",
                          gap: 14,
                          fontSize: 14,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "rgba(255,255,255,0.88)" }}>Avg impressions</span>
                          <span style={{ fontWeight: 600 }}>{avgImp}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "rgba(255,255,255,0.88)" }}>Avg engagement</span>
                          <span style={{ fontWeight: 600 }}>{avgEng}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "rgba(255,255,255,0.88)" }}>Entries logged</span>
                          <span style={{ fontWeight: 600 }}>{t.count}</span>
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 20,
                          height: 6,
                          borderRadius: 3,
                          background: "rgba(255,255,255,0.25)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 3,
                            background: "#ffffff",
                            width: `${pct}%`,
                          }}
                        />
                      </div>
                      <div
                        style={{ marginTop: 8, fontSize: 12.5, color: "rgba(255,255,255,0.85)" }}
                      >
                        {t.count ? `${pct}% of your reach` : "No entries yet"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weekly trend */}
            <div
              className="sx-glass"
              style={{
                minHeight: 284,
                padding: "20px 24px",
                borderRadius: 26,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>
                  Weekly trend, followers
                </div>
                <span style={{ marginLeft: "auto", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                  Last 6 weeks
                </span>
              </div>
              <TrendChart entries={entries} baseline={Number(ws.baseline.followers || 0)} />
            </div>
          </div>
        </div>
      </main>
      {sheetFor && (
        <ResultSheet
          title={sheetFor.title}
          format={sheetFor.format}
          onCancel={() => setSheetFor(null)}
          onSave={(v) => saveSheet(sheetFor, v)}
        />
      )}
    </div>
  );
}

// --- Inline add/edit row ---

function AddRow({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  inStyle,
}: {
  draft: Partial<PerfEntry>;
  setDraft: (d: Partial<PerfEntry>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  inStyle: React.CSSProperties;
}) {
  const [rawImp, setRawImp] = useState(draft.impressions ? String(draft.impressions) : "");
  const [rawEng, setRawEng] = useState(draft.engagementRate ? String(draft.engagementRate) : "");
  const [rawFol, setRawFol] = useState(draft.followersGained ? String(draft.followersGained) : "");

  return (
    <div
      style={{
        flexShrink: 0,
        display: "grid",
        gridTemplateColumns: COLS,
        gap: 12,
        padding: "0 12px",
        height: 52,
        alignItems: "center",
        borderRadius: 14,
        background: "rgba(255,255,255,0.14)",
        border: "1px solid rgba(255,255,255,0.4)",
        marginTop: 4,
      }}
    >
      <input
        className="tf-in"
        type="text"
        value={draft.date || ""}
        onChange={(e) => setDraft({ ...draft, date: e.target.value })}
        style={inStyle}
      />
      <input
        className="tf-in"
        type="text"
        placeholder="Title"
        value={draft.title || ""}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        style={inStyle}
      />
      <select
        className="tf-in"
        value={draft.format || "Article"}
        onChange={(e) => setDraft({ ...draft, format: e.target.value as Format })}
        style={{ ...inStyle, appearance: "none" as const }}
      >
        {FORMATS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <select
        className="tf-in"
        value={draft.source || "Transcript"}
        onChange={(e) => setDraft({ ...draft, source: e.target.value as PerfEntry["source"] })}
        style={{ ...inStyle, appearance: "none" as const }}
      >
        {SOURCES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        className="tf-in"
        type="text"
        placeholder="0"
        value={rawImp}
        onChange={(e) => {
          setRawImp(e.target.value);
          setDraft({ ...draft, impressions: e.target.value === "" ? 0 : Number(e.target.value) });
        }}
        style={inStyle}
      />
      <input
        className="tf-in"
        type="text"
        placeholder="0"
        value={rawEng}
        onChange={(e) => {
          setRawEng(e.target.value);
          setDraft({
            ...draft,
            engagementRate: e.target.value === "" ? 0 : Number(e.target.value),
          });
        }}
        style={inStyle}
      />
      <input
        className="tf-in"
        type="text"
        placeholder="0"
        value={rawFol}
        onChange={(e) => {
          setRawFol(e.target.value);
          setDraft({
            ...draft,
            followersGained: e.target.value === "" ? 0 : Number(e.target.value),
          });
        }}
        style={inStyle}
      />
      <input
        className="tf-in"
        type="text"
        placeholder="Add a note"
        value={draft.notes || ""}
        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        style={inStyle}
      />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          type="button"
          aria-label="Save entry"
          onClick={onSave}
          disabled={saving}
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: 0,
            background: "#ffffff",
            color: "#0a66c2",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Check size={17} />
        </button>
        <button
          type="button"
          aria-label="Cancel"
          onClick={onCancel}
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.4)",
            background: "transparent",
            color: "#ffffff",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
