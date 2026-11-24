import type { Workspace } from "./spectr-store";
import type { GrowthPlan, PlanInputs, Play } from "./growth-types";
import { buildFallbackPlan } from "./growth-plan";
import { generateGrowthPlan } from "./growth-fn";
import { loadActivePlan, loadExperiments, loadInsights, savePlanWithPlays, type RepoCtx } from "./growth-repo";

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

export interface CreatedPlan { plan: GrowthPlan; plays: Play[]; source: "ai" | "fallback" }

/**
 * Generates a plan (Claude first, deterministic fallback on any failure) and saves it with this week's plays.
 * On regenerate, the previous plan's history carries forward.
 */
export async function createGrowthPlan(ctx: RepoCtx, ws: Workspace, opts: { regenerate?: boolean } = {}): Promise<CreatedPlan> {
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
    { at: new Date().toISOString(), change: opts.regenerate ? "Plan regenerated from your latest results" : "Plan created from your workspace setup", source: opts.regenerate ? "regenerated" as const : "generated" as const },
    ...(previous?.history ?? []),
  ].slice(0, 30);
  const saved = await savePlanWithPlays(ctx, { ...p, channels: ["LinkedIn"], history }, plays);
  return { ...saved, source: result.source };
}
