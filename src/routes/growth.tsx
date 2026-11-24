import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CircleAlert, FlaskConical, History, Lightbulb, RefreshCw, Target, X } from "lucide-react";
import { AppHeader, AppRail } from "@/components/spectr/AppChrome";
import { ExperimentSummary, InsightRow, PlayCard, nextStep } from "@/components/spectr/GrowthCards";
import { ExperimentDialog } from "@/components/spectr/ExperimentDialog";
import { useApp } from "@/lib/spectr-store";
import { useGrowth } from "@/lib/use-growth";
import { advancePlay, createExperiment, isLocalMode, type RepoCtx } from "@/lib/growth-repo";
import { applyInsight, createGrowthPlan, declareWinner } from "@/lib/growth-service";
import { computeForecast, formatMetric } from "@/lib/growth-forecast";
import { variantResult } from "@/lib/growth-insights";
import type { Experiment, Insight, Play, PlayFormat } from "@/lib/growth-types";
import { errMessage, friendlyError } from "@/lib/utils";

export const Route = createFileRoute("/growth")({ component: RootPage });

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
  return <GrowthPlanPage />;
}

const weekLabel = (iso?: string) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";
const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const FORMAT_LABELS: Record<PlayFormat, string> = {
  post: "Posts",
  article: "Articles",
  "video script": "Video scripts",
};

/** Splits the weekly cadence across formats in proportion to this week's plays. */
function cadenceByFormat(total: number, plays: Play[]): { format: PlayFormat; count: number }[] {
  const formats: PlayFormat[] = ["post", "article", "video script"];
  const counts = formats.map((f) => plays.filter((p) => p.format === f).length);
  const sum = counts.reduce((a, b) => a + b, 0);
  if (!sum) return formats.map((f, i) => ({ format: f, count: i === 0 ? total : 0 }));
  const raw = counts.map((c) => (c / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => {
      if (left > 0) {
        out[i]++;
        left--;
      }
    });
  return formats.map((f, i) => ({ format: f, count: out[i] }));
}

function GrowthPlanPage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const ws = state.workspace;
  const ctx: RepoCtx | null = useMemo(
    () =>
      ws.companyId && state.user?.id ? { companyId: ws.companyId, userId: state.user.id } : null,
    [ws.companyId, state.user?.id],
  );
  const g = useGrowth(ctx);
  const [building, setBuilding] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [expPlay, setExpPlay] = useState<Play | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const buildPlan = async (regenerate: boolean) => {
    if (!ctx) return;
    setBuilding(true);
    setConfirmRegen(false);
    try {
      const r = await createGrowthPlan(ctx, ws, { regenerate });
      toast.success(regenerate ? "Plan regenerated" : "Your growth plan is ready", {
        description:
          r.source === "fallback"
            ? "Built from your workspace inputs while AI was unavailable."
            : undefined,
      });
      await g.reload();
    } catch (e) {
      toast.error("Could not build your plan", { description: friendlyError(e) });
    } finally {
      setBuilding(false);
    }
  };

  const startExperiment = async (
    e: Parameters<React.ComponentProps<typeof ExperimentDialog>["onCreate"]>[0],
  ) => {
    if (!ctx || !expPlay) return;
    await createExperiment(ctx, { playId: expPlay.id, ...e });
    setExpPlay(null);
    toast.success("Experiment started", {
      description: "Publish both hooks, then log each one's numbers in Results.",
    });
    await g.reload();
  };

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
        description: await declareWinner(ctx, x, winner, g.entries, title),
      });
      await g.reload();
    } catch (e) {
      toast.error("Could not declare a winner", { description: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  };

  const goStep = async (p: Play) => {
    if (ctx && p.status === "suggested")
      await advancePlay(ctx, p.id, "in progress").catch(() => {});
    navigate({ to: nextStep(p).to, search: { play: p.id } });
  };

  const forecast = useMemo(
    () =>
      g.plan
        ? computeForecast({
            key: g.plan.northStarKey,
            label: g.plan.northStarMetric,
            ws,
            entries: g.entries,
            planCreatedAt: g.plan.createdAt,
          })
        : null,
    [g.plan, ws, g.entries],
  );
  const expByPlay = useMemo(
    () => new Map(g.experiments.map((e) => [e.playId, e])),
    [g.experiments],
  );
  const liveExp = (x: Experiment): Experiment =>
    x.status === "complete"
      ? x
      : {
          ...x,
          result: { a: variantResult(x, g.entries, "a"), b: variantResult(x, g.entries, "b") },
        };
  const started = g.plays.filter((p) => p.status !== "suggested").length;

  return (
    <div className="sx-shell">
      <AppRail active="/growth" />
      <AppHeader
        title="Growth plan"
        subtitle="Your strategy, this week's plays and what is working."
        actions={
          g.plan ? (
            <button
              type="button"
              className="gh-btn gh-btn--ghost"
              disabled={building}
              onClick={() => setConfirmRegen(true)}
            >
              <RefreshCw size={15} className={building ? "animate-spin" : ""} aria-hidden="true" />
              <span className="sx-hide-sm">{building ? "Regenerating" : "Regenerate plan"}</span>
            </button>
          ) : undefined
        }
      />

      <main className="sx-main">
        <div className="sx-page gh-page">
          {g.status === "loading" && <GrowthSkeleton />}

          {g.status === "error" && (
            <div className="sx-glass gh-state" role="alert">
              <CircleAlert size={28} aria-hidden="true" />
              <div className="gh-state-title">We could not load your growth plan</div>
              <div className="gh-state-sub">{g.error}</div>
              <button type="button" className="gh-btn gh-btn--primary" onClick={() => g.reload()}>
                Try again
              </button>
            </div>
          )}

          {g.status === "ready" && !g.plan && (
            <div className="sx-glass gh-state">
              <Target size={30} aria-hidden="true" />
              <div className="gh-state-title">
                {building ? "Building your growth plan" : "No growth plan yet"}
              </div>
              <div className="gh-state-sub">
                SPECTR turns your goal, audience and targets into a north star, content pillars and
                this week's plays.
              </div>
              <button
                type="button"
                className="gh-btn gh-btn--primary"
                disabled={building}
                onClick={() => buildPlan(false)}
              >
                {building ? "Building" : "Build my growth plan"}
              </button>
            </div>
          )}

          {g.status === "ready" && g.plan && forecast && (
            <>
              {/* 1. Goal and forecast */}
              <section
                className="sx-glass gh-goal"
                aria-labelledby="gp-goal-h"
                data-tour="growth-goal"
              >
                <div className="gh-eyebrow">North star</div>
                <h2 id="gp-goal-h" className="gh-h2">
                  {g.plan.northStarMetric}
                </h2>
                <p className="gh-goal-summary">{g.plan.goalSummary}</p>
                {forecast.state === "no-target" ? (
                  <div className="gh-forecast-note">{forecast.sentence}</div>
                ) : (
                  <>
                    <div className="gh-goal-numbers">
                      <span className="gh-big">
                        {formatMetric(forecast.current, forecast.unit)}
                      </span>
                      <span className="gh-of">
                        of {formatMetric(forecast.target, forecast.unit)} target
                      </span>
                    </div>
                    <div
                      className="gh-progress"
                      role="progressbar"
                      aria-valuenow={Math.round(forecast.progressPct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Progress to target"
                    >
                      <div style={{ width: `${forecast.progressPct}%` }} />
                      {forecast.state === "ok" && (
                        <i
                          style={{ left: `${Math.min(100, forecast.projectedPct)}%` }}
                          title="Projected"
                        />
                      )}
                    </div>
                    <div className="gh-forecast">
                      <div className="gh-forecast-main">
                        {forecast.sentence}
                        {forecast.gapSentence ? ` ${forecast.gapSentence}` : ""}
                      </div>
                      {forecast.state === "ok" && (
                        <div className="gh-forecast-note">{forecast.assumption}</div>
                      )}
                    </div>
                  </>
                )}
              </section>

              {/* 2. Pillars and 3. cadence */}
              <div className="gpp-row">
                <section aria-labelledby="gp-pillars-h" data-tour="growth-pillars">
                  <h2 id="gp-pillars-h" className="gh-h2 gpp-h">
                    Content pillars
                  </h2>
                  <div className="gpp-pillars">
                    {g.plan.pillars.map((p) => (
                      <div key={p.name} className="sx-glass gpp-pillar">
                        <div className="gpp-share">{p.share}%</div>
                        <div className="gpp-name">{p.name}</div>
                        <div className="gpp-desc">{p.description}</div>
                        <div className="gpp-bar">
                          <div style={{ width: `${p.share}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section
                  className="sx-glass gpp-cadence"
                  aria-labelledby="gp-cad-h"
                  data-tour="growth-cadence"
                >
                  <h2 id="gp-cad-h" className="gh-h3">
                    Weekly cadence
                  </h2>
                  <div className="gpp-cad-total">
                    <span>{g.plan.cadencePerWeek}</span> pieces a week
                  </div>
                  {cadenceByFormat(g.plan.cadencePerWeek, g.plays).map((c) => (
                    <div key={c.format} className="gpp-cad-row">
                      <span>{FORMAT_LABELS[c.format]}</span>
                      <b>{c.count}</b>
                    </div>
                  ))}
                  <div className="gh-forecast-note">
                    Split follows this week's plays. {g.plan.audienceSummary}
                  </div>
                </section>
              </div>

              {/* 4. This week's plays */}
              <section aria-labelledby="gp-plays-h" data-tour="growth-plays">
                <div className="gh-section-head gh-section-head--bare">
                  <div>
                    <h2 id="gp-plays-h" className="gh-h2">
                      This week's plays
                    </h2>
                    <div className="gh-sub">
                      Week of {weekLabel(g.plays[0]?.weekStart)} · {started} of {g.plays.length}{" "}
                      started
                    </div>
                  </div>
                </div>
                {g.plays.length ? (
                  <div className="gh-plays">
                    {g.plays.map((p) => (
                      <PlayCard
                        key={p.id}
                        play={p}
                        experiment={expByPlay.get(p.id)}
                        onStep={goStep}
                        onExperiment={setExpPlay}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="sx-glass gh-state gh-state--inline">
                    <div className="gh-state-title">No plays for this week yet</div>
                    <div className="gh-state-sub">
                      Regenerate to draft fresh plays from your plan and latest results.
                    </div>
                    <button
                      type="button"
                      className="gh-btn gh-btn--primary"
                      disabled={building}
                      onClick={() => setConfirmRegen(true)}
                    >
                      Regenerate plan
                    </button>
                  </div>
                )}
              </section>

              {/* 5. Experiments and 6. Insights */}
              <div className="gh-bottom">
                <section className="sx-glass gh-card" aria-labelledby="gp-exp-h">
                  <div className="gh-card-head">
                    <FlaskConical size={18} aria-hidden="true" />
                    <h2 id="gp-exp-h" className="gh-h3">
                      Experiments
                    </h2>
                  </div>
                  {g.experiments.length ? (
                    g.experiments.map((x) => {
                      const live = liveExp(x);
                      const ready = !!(live.result.a && live.result.b);
                      return (
                        <div key={x.id} className="tr-exp">
                          <div className="gh-eyebrow" style={{ marginBottom: 4 }}>
                            {x.status === "running" ? "Running" : "Concluded"}
                          </div>
                          <ExperimentSummary
                            experiment={live}
                            play={g.allPlays.find((p) => p.id === x.playId)}
                          />
                          {x.status === "running" && (
                            <div className="tr-exp-actions">
                              {ready ? (
                                <>
                                  <span>Declare the winner:</span>
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
                                <span>Log results for both hooks in Results to compare them.</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="gh-empty">
                      Choose Run as experiment on any play to test two hooks against each other.
                    </div>
                  )}
                </section>
                <section
                  className="sx-glass gh-card"
                  aria-labelledby="gp-ins-h"
                  data-tour="growth-insights"
                >
                  <div className="gh-card-head">
                    <Lightbulb size={18} aria-hidden="true" />
                    <h2 id="gp-ins-h" className="gh-h3">
                      Insights
                    </h2>
                  </div>
                  {g.insights.length ? (
                    g.insights
                      .slice(0, 8)
                      .map((i) => (
                        <InsightRow
                          key={i.id}
                          insight={i}
                          onApply={apply}
                          applying={busy === i.id}
                        />
                      ))
                  ) : (
                    <div className="gh-empty">
                      Insights appear after you log results. They compare formats and pillars using
                      your real numbers.
                    </div>
                  )}
                </section>
              </div>

              {/* 7. Plan history */}
              <section className="sx-glass gh-card" aria-labelledby="gp-hist-h">
                <div className="gh-card-head">
                  <History size={18} aria-hidden="true" />
                  <h2 id="gp-hist-h" className="gh-h3">
                    Plan history
                  </h2>
                </div>
                {g.plan.history.length ? (
                  <ol className="gpp-history">
                    {g.plan.history.map((h, i) => (
                      <li key={`${h.at}-${i}`}>
                        <span className="gpp-hist-version">v{g.plan!.history.length - i}</span>
                        <span className="gpp-hist-change">{h.change}</span>
                        <span className="gpp-hist-date">{when(h.at)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="gh-empty">Changes to your plan will be listed here.</div>
                )}
              </section>

              {isLocalMode() && (
                <div className="gh-local-note">
                  Growth data is saved on this device until the growth database migration is
                  applied.
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {expPlay && (
        <ExperimentDialog
          play={expPlay}
          onCancel={() => setExpPlay(null)}
          onCreate={startExperiment}
        />
      )}
      {confirmRegen && (
        <div
          className="gx-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmRegen(false);
          }}
        >
          <div
            className="gx-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="regen-h"
            style={{ maxWidth: 480 }}
          >
            <div className="gx-head">
              <h2 id="regen-h" className="gh-h2">
                Regenerate your growth plan?
              </h2>
              <button
                type="button"
                className="gx-close"
                aria-label="Close"
                onClick={() => setConfirmRegen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="gx-sub">
              Your pillars, cadence and this week's suggested plays are rebuilt from your current
              goals, audience and results. Plays you already started are kept, and the change is
              recorded in your plan history.
            </p>
            <div className="gx-actions">
              <button
                type="button"
                className="gh-btn gh-btn--ghost"
                onClick={() => setConfirmRegen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="gh-btn gh-btn--primary"
                autoFocus
                onClick={() => buildPlan(true)}
              >
                Regenerate plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GrowthSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your growth plan"
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      <div className="sx-glass gh-goal">
        <div className="tf-sk gh-sk" style={{ width: "40%", height: 26 }} />
        <div className="tf-sk gh-sk" style={{ width: "80%", height: 14, marginTop: 18 }} />
        <div className="tf-sk gh-sk" style={{ width: "100%", height: 10, marginTop: 26 }} />
      </div>
      <div className="gh-plays">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sx-glass gh-play">
            <div className="tf-sk gh-sk" style={{ width: "50%", height: 12 }} />
            <div className="tf-sk gh-sk" style={{ width: "85%", height: 20, marginTop: 14 }} />
            <div className="tf-sk gh-sk" style={{ width: "100%", height: 54, marginTop: 14 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
