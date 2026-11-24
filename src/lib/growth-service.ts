import type { PerfEntry, Workspace } from "./spectr-store";
import type { Experiment, GrowthPlan, Insight, PlanInputs, Play } from "./growth-types";
import { buildFallbackPlan } from "./growth-plan";
import { generateGrowthPlan, phraseInsights } from "./growth-fn";
import {
  computeInsights,
  experimentLearning,
  shiftPillarShare,
  variantResult,
} from "./growth-insights";
import {
  advancePlay,
  loadActivePlan,
  loadExperiments,
  loadInsights,
  markInsightApplied,
  saveInsights,
  savePlanWithPlays,
  updateExperiment,
  updatePlan,
  type RepoCtx,
} from "./growth-repo";

export function planInputsFromWorkspace(ws: Workspace, learnings: string[] = []): PlanInputs {
  return {
    companyName: ws.companyName,
    sector: ws.industry,
    companyDescription: ws.companyDescription,
    goalDescription: ws.goalDescription,
    audience: ws.audience,
    baseline: ws.baseline,
    targets: ws.targets,
    startingFromScratch: ws.startingFromScratch,
    learnings,
  };
}

/** What the workspace has learned so far: experiment learnings and applied insights. */
async function collectLearnings(ctx: RepoCtx): Promise<string[]> {
  try {
    const [exps, insights] = await Promise.all([loadExperiments(ctx), loadInsights(ctx)]);
    return [
      ...exps.filter((e) => e.status === "complete" && e.learning).map((e) => e.learning),
      ...insights.filter((i) => i.applied).map((i) => i.text),
    ].slice(0, 6);
  } catch {
    return [];
  }
}

export interface CreatedPlan {
  plan: GrowthPlan;
  plays: Play[];
  source: "ai" | "fallback";
}

/**
 * Generates a plan (Claude first, deterministic fallback on any failure) and saves it with this week's plays.
 * On regenerate, the previous plan's history carries forward.
 */
export async function createGrowthPlan(
  ctx: RepoCtx,
  ws: Workspace,
  opts: { regenerate?: boolean } = {},
): Promise<CreatedPlan> {
  const [learnings, previous] = await Promise.all([
    opts.regenerate ? collectLearnings(ctx) : Promise.resolve([]),
    opts.regenerate ? loadActivePlan(ctx).catch(() => null) : Promise.resolve(null),
  ]);
  const inputs = planInputsFromWorkspace(ws, learnings);
  let result: { plan: ReturnType<typeof buildFallbackPlan>; source: "ai" | "fallback" };
  try {
    result = await generateGrowthPlan({ data: inputs });
  } catch {
    result = { plan: buildFallbackPlan(inputs), source: "fallback" };
  }
  const { plays, ...p } = result.plan;
  const history = [
    {
      at: new Date().toISOString(),
      change: opts.regenerate
        ? "Plan regenerated from your latest results"
        : "Plan created from your workspace setup",
      source: opts.regenerate ? ("regenerated" as const) : ("generated" as const),
    },
    ...(previous?.history ?? []),
  ].slice(0, 30);
  const saved = await savePlanWithPlays(ctx, { ...p, channels: ["LinkedIn"], history }, plays);
  return { ...saved, source: result.source };
}

/** Rolls the Results entries logged for a play into its numbers and marks it measured. */
export async function syncPlayResults(
  ctx: RepoCtx,
  playId: string,
  entries: PerfEntry[],
): Promise<void> {
  const mine = entries.filter((e) => e.playId === playId);
  if (!mine.length) return;
  const results = {
    impressions: mine.reduce((s, e) => s + e.impressions, 0),
    engagementRate:
      Math.round((mine.reduce((s, e) => s + e.engagementRate, 0) / mine.length) * 10) / 10,
    followersGained: mine.reduce((s, e) => s + e.followersGained, 0),
    entries: mine.length,
  };
  await advancePlay(ctx, playId, "measured", { results });
}

/** Recomputes insights from the latest data, lets Claude phrase them, and stores them. */
export async function refreshInsights(
  ctx: RepoCtx,
  ws: Workspace,
  data: { entries: PerfEntry[]; plays: Play[]; plan: GrowthPlan | null; projectedPct?: number },
): Promise<number> {
  const candidates = computeInsights(data);
  if (!candidates.length) return 0;
  let texts = candidates.map((c) => c.text);
  try {
    const r = await phraseInsights({
      data: { company: ws.companyName, audience: ws.audience.jobTitles, texts },
    });
    texts = r.texts;
  } catch {
    /* keep computed wording */
  }
  await saveInsights(
    ctx,
    candidates.map((c, i) => ({ ...c, text: texts[i] })),
  );
  return candidates.length;
}

/** Applies a recommendation to the plan (cadence or pillar share) and records it in the plan history. */
export async function applyInsight(
  ctx: RepoCtx,
  plan: GrowthPlan,
  insight: Insight,
): Promise<string> {
  const action = insight.evidence.action;
  if (!action) throw new Error("This insight has no action to apply");
  let change: string;
  if (action.type === "cadence") {
    change = `Cadence changed from ${plan.cadencePerWeek} to ${action.value} pieces a week`;
    await updatePlan(ctx, plan.id, {
      cadencePerWeek: action.value,
      history: [{ at: new Date().toISOString(), change, source: "insight" }, ...plan.history],
    });
  } else {
    const before = plan.pillars.find((p) => p.name === action.pillar)?.share ?? 0;
    const pillars = shiftPillarShare(plan.pillars, action.pillar, action.delta);
    const after = pillars.find((p) => p.name === action.pillar)?.share ?? before;
    change = `${action.pillar} share changed from ${before}% to ${after}%`;
    await updatePlan(ctx, plan.id, {
      pillars,
      history: [{ at: new Date().toISOString(), change, source: "insight" }, ...plan.history],
    });
  }
  await markInsightApplied(ctx, insight.id);
  return change;
}

/** Declares an experiment winner from logged numbers and writes the learning. */
export async function declareWinner(
  ctx: RepoCtx,
  exp: Experiment,
  winner: "a" | "b",
  entries: PerfEntry[],
  playTitle: string,
): Promise<string> {
  const a = variantResult(exp, entries, "a"),
    b = variantResult(exp, entries, "b");
  if (!a || !b) throw new Error("Both hooks need results before you can declare a winner");
  const learning = experimentLearning(exp, winner, a, b, playTitle);
  await updateExperiment(ctx, exp.id, { result: { a, b }, winner, learning, status: "complete" });
  return learning;
}
