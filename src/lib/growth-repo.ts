import supabase from "./supabase";
import {
  type Experiment, type GrowthPlan, type Insight, type Play, type PlayStatus,
  PLAY_STATUS_ORDER, weekStartOf,
} from "./growth-types";

/**
 * Data access for the Growth Engine. Uses Supabase when migration 009 is applied; until then (missing table or
 * column) it transparently keeps the same objects in localStorage per company, so the app never breaks.
 */

export interface RepoCtx { companyId: string; userId: string }

type Row = Record<string, any>;
interface LocalDb { plans: GrowthPlan[]; plays: Play[]; experiments: Experiment[]; insights: Insight[] }

let localMode = false;
const wsCache = new Map<string, string>();

export const isLocalMode = () => localMode;

function isMissingSchema(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const m = (error.message || "").toLowerCase();
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code || "")
    || m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache");
}

const localKey = (ctx: RepoCtx) => `spectr-growth-v1:${ctx.companyId}`;
function readLocal(ctx: RepoCtx): LocalDb {
  try {
    const raw = localStorage.getItem(localKey(ctx));
    if (raw) return { plans: [], plays: [], experiments: [], insights: [], ...JSON.parse(raw) };
  } catch { /* fall through */ }
  return { plans: [], plays: [], experiments: [], insights: [] };
}
function writeLocal(ctx: RepoCtx, db: LocalDb) { localStorage.setItem(localKey(ctx), JSON.stringify(db)); }
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

async function workspaceId(ctx: RepoCtx): Promise<string> {
  const k = `${ctx.companyId}:${ctx.userId}`;
  const cached = wsCache.get(k);
  if (cached) return cached;
  const { data } = await supabase.from("workspaces").select("id").eq("company_id", ctx.companyId).eq("user_id", ctx.userId).maybeSingle();
  const id = (data?.id as string | undefined) ?? `local-${ctx.companyId}`;
  wsCache.set(k, id);
  return id;
}

/** Runs a Supabase operation; on a missing table/column switches to local mode and runs the local version. */
async function run<T>(remote: () => Promise<{ data: T; error: any }>, local: () => T): Promise<T> {
  if (!localMode) {
    const { data, error } = await remote();
    if (!error) return data;
    if (!isMissingSchema(error)) throw new Error(error.message || "Request failed");
    localMode = true;
  }
  return local();
}

// ── Row mappers ──
const planFromRow = (r: Row): GrowthPlan => ({
  id: r.id, workspaceId: r.workspace_id, northStarMetric: r.north_star_metric, northStarKey: r.north_star_key,
  goalSummary: r.goal_summary, pillars: r.pillars ?? [], cadencePerWeek: r.cadence_per_week, channels: r.channels ?? [],
  audienceSummary: r.audience_summary, history: r.history ?? [], createdAt: r.created_at,
});
const playFromRow = (r: Row): Play => ({
  id: r.id, workspaceId: r.workspace_id, planId: r.plan_id, weekStart: r.week_start, title: r.title, type: r.type,
  hook: r.hook, rationale: r.rationale, pillar: r.pillar ?? "", format: r.format, status: r.status,
  linkedLogId: r.linked_log_id, linkedContentId: r.linked_content_id, results: r.results ?? {}, createdAt: r.created_at,
});
const expFromRow = (r: Row): Experiment => ({
  id: r.id, workspaceId: r.workspace_id, playId: r.play_id, hypothesis: r.hypothesis, variantA: r.variant_a,
  variantB: r.variant_b, metric: r.metric, result: r.result ?? {}, winner: r.winner, learning: r.learning,
  status: r.status, createdAt: r.created_at,
});
const insightFromRow = (r: Row): Insight => ({
  id: r.id, workspaceId: r.workspace_id, text: r.text, kind: r.kind, evidence: r.evidence ?? { key: "", numbers: {} },
  applied: r.applied, createdAt: r.created_at,
});

// ── Plans ──

export async function loadActivePlan(ctx: RepoCtx): Promise<GrowthPlan | null> {
  const ws = await workspaceId(ctx);
  return run(
    async () => {
      const { data, error } = await supabase.from("growth_plans").select("*").eq("workspace_id", ws).eq("active", true)
        .order("created_at", { ascending: false }).limit(1);
      return { data: data?.[0] ? planFromRow(data[0]) : null, error };
    },
    () => readLocal(ctx).plans[0] ?? null,
  );
}

type NewPlan = Omit<GrowthPlan, "id" | "workspaceId" | "createdAt">;
type NewPlay = Pick<Play, "title" | "type" | "hook" | "rationale" | "pillar" | "format">;

/** Saves a new active plan (retiring the previous one) together with this week's plays. */
export async function savePlanWithPlays(ctx: RepoCtx, plan: NewPlan, plays: NewPlay[]): Promise<{ plan: GrowthPlan; plays: Play[] }> {
  const ws = await workspaceId(ctx);
  const week = weekStartOf();
  return run(
    async () => {
      await supabase.from("growth_plans").update({ active: false }).eq("workspace_id", ws).eq("active", true);
      const { data: p, error } = await supabase.from("growth_plans").insert({
        workspace_id: ws, user_id: ctx.userId, north_star_metric: plan.northStarMetric, north_star_key: plan.northStarKey,
        goal_summary: plan.goalSummary, pillars: plan.pillars, cadence_per_week: plan.cadencePerWeek, channels: plan.channels,
        audience_summary: plan.audienceSummary, history: plan.history, active: true,
      }).select().single();
      if (error || !p) return { data: null as any, error: error ?? { message: "Plan not saved" } };
      // Keep plays the user already started this week; replace only untouched suggestions.
      await supabase.from("plays").delete().eq("workspace_id", ws).eq("week_start", week).eq("status", "suggested");
      const { data: rows, error: e2 } = await supabase.from("plays").insert(plays.map((x) => ({
        workspace_id: ws, user_id: ctx.userId, plan_id: p.id, week_start: week, title: x.title, type: x.type,
        hook: x.hook, rationale: x.rationale, pillar: x.pillar, format: x.format, status: "suggested",
      }))).select();
      return { data: { plan: planFromRow(p), plays: (rows ?? []).map(playFromRow) }, error: e2 };
    },
    () => {
      const db = readLocal(ctx);
      const newPlan: GrowthPlan = { ...plan, id: uuid(), workspaceId: ws, createdAt: now() };
      const kept = db.plays.filter((x) => !(x.weekStart === week && x.status === "suggested"));
      const newPlays: Play[] = plays.map((x) => ({
        ...x, id: uuid(), workspaceId: ws, planId: newPlan.id, weekStart: week, status: "suggested",
        linkedLogId: null, linkedContentId: null, results: {}, createdAt: now(),
      }));
      writeLocal(ctx, { ...db, plans: [newPlan], plays: [...newPlays, ...kept] });
      return { plan: newPlan, plays: newPlays };
    },
  );
}

export async function updatePlan(ctx: RepoCtx, id: string, patch: Partial<Pick<GrowthPlan, "pillars" | "cadencePerWeek" | "history">>): Promise<void> {
  const row: Row = {};
  if (patch.pillars) row.pillars = patch.pillars;
  if (patch.cadencePerWeek !== undefined) row.cadence_per_week = patch.cadencePerWeek;
  if (patch.history) row.history = patch.history;
  await run(
    async () => { const { error } = await supabase.from("growth_plans").update(row).eq("id", id); return { data: undefined, error }; },
    () => { const db = readLocal(ctx); db.plans = db.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)); writeLocal(ctx, db); },
  );
}

// ── Plays ──

/** This week's plays, or the most recent week that has plays. */
export async function loadCurrentPlays(ctx: RepoCtx): Promise<Play[]> {
  const ws = await workspaceId(ctx);
  const all = await run(
    async () => {
      const { data, error } = await supabase.from("plays").select("*").eq("workspace_id", ws).order("week_start", { ascending: false }).order("created_at", { ascending: true }).limit(40);
      return { data: (data ?? []).map(playFromRow), error };
    },
    () => [...readLocal(ctx).plays].sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.createdAt.localeCompare(b.createdAt)),
  );
  if (!all.length) return [];
  const thisWeek = weekStartOf();
  const week = all.some((p) => p.weekStart === thisWeek) ? thisWeek : all[0].weekStart;
  return all.filter((p) => p.weekStart === week);
}

export async function loadAllPlays(ctx: RepoCtx): Promise<Play[]> {
  const ws = await workspaceId(ctx);
  return run(
    async () => {
      const { data, error } = await supabase.from("plays").select("*").eq("workspace_id", ws).order("week_start", { ascending: false }).limit(100);
      return { data: (data ?? []).map(playFromRow), error };
    },
    () => readLocal(ctx).plays,
  );
}

export async function getPlay(ctx: RepoCtx, id: string): Promise<Play | null> {
  return run(
    async () => { const { data, error } = await supabase.from("plays").select("*").eq("id", id).maybeSingle(); return { data: data ? playFromRow(data) : null, error }; },
    () => readLocal(ctx).plays.find((p) => p.id === id) ?? null,
  );
}

type PlayPatch = Partial<Pick<Play, "status" | "linkedLogId" | "linkedContentId" | "results">>;

export async function updatePlay(ctx: RepoCtx, id: string, patch: PlayPatch): Promise<void> {
  const row: Row = {};
  if (patch.status) row.status = patch.status;
  if (patch.linkedLogId !== undefined) row.linked_log_id = patch.linkedLogId;
  if (patch.linkedContentId !== undefined) row.linked_content_id = patch.linkedContentId;
  if (patch.results) row.results = patch.results;
  await run(
    async () => { const { error } = await supabase.from("plays").update(row).eq("id", id); return { data: undefined, error }; },
    () => { const db = readLocal(ctx); db.plays = db.plays.map((p) => (p.id === id ? { ...p, ...patch } : p)); writeLocal(ctx, db); },
  );
}

/** Moves a play forward through the loop; never moves it backwards. */
export async function advancePlay(ctx: RepoCtx, id: string, status: PlayStatus, extra: Omit<PlayPatch, "status"> = {}): Promise<void> {
  const play = await getPlay(ctx, id);
  if (!play) return;
  const next = PLAY_STATUS_ORDER[status] > PLAY_STATUS_ORDER[play.status] ? status : play.status;
  await updatePlay(ctx, id, { ...extra, status: next });
}

// ── Experiments ──

export async function loadExperiments(ctx: RepoCtx): Promise<Experiment[]> {
  const ws = await workspaceId(ctx);
  return run(
    async () => {
      const { data, error } = await supabase.from("experiments").select("*").eq("workspace_id", ws).order("created_at", { ascending: false });
      return { data: (data ?? []).map(expFromRow), error };
    },
    () => readLocal(ctx).experiments,
  );
}

export async function createExperiment(ctx: RepoCtx, e: Pick<Experiment, "playId" | "hypothesis" | "variantA" | "variantB" | "metric">): Promise<Experiment> {
  const ws = await workspaceId(ctx);
  return run(
    async () => {
      const { data, error } = await supabase.from("experiments").insert({
        workspace_id: ws, user_id: ctx.userId, play_id: e.playId, hypothesis: e.hypothesis,
        variant_a: e.variantA, variant_b: e.variantB, metric: e.metric, status: "running",
      }).select().single();
      return { data: data ? expFromRow(data) : (null as any), error };
    },
    () => {
      const db = readLocal(ctx);
      const x: Experiment = { ...e, id: uuid(), workspaceId: ws, result: {}, winner: null, learning: "", status: "running", createdAt: now() };
      db.experiments = [x, ...db.experiments];
      writeLocal(ctx, db);
      return x;
    },
  );
}

export async function updateExperiment(ctx: RepoCtx, id: string, patch: Partial<Pick<Experiment, "result" | "winner" | "learning" | "status">>): Promise<void> {
  await run(
    async () => { const { error } = await supabase.from("experiments").update(patch).eq("id", id); return { data: undefined, error }; },
    () => { const db = readLocal(ctx); db.experiments = db.experiments.map((x) => (x.id === id ? { ...x, ...patch } : x)); writeLocal(ctx, db); },
  );
}

// ── Insights ──

export async function loadInsights(ctx: RepoCtx): Promise<Insight[]> {
  const ws = await workspaceId(ctx);
  return run(
    async () => {
      const { data, error } = await supabase.from("insights").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(30);
      return { data: (data ?? []).map(insightFromRow), error };
    },
    () => readLocal(ctx).insights,
  );
}

/** Replaces any unapplied insight with the same evidence key, so each fact appears once and stays current. */
export async function saveInsights(ctx: RepoCtx, items: Pick<Insight, "text" | "kind" | "evidence">[]): Promise<void> {
  if (!items.length) return;
  const ws = await workspaceId(ctx);
  const keys = items.map((i) => i.evidence.key);
  await run(
    async () => {
      const { data: old } = await supabase.from("insights").select("id, evidence").eq("workspace_id", ws).eq("applied", false);
      const stale = (old ?? []).filter((r: Row) => keys.includes(r.evidence?.key)).map((r: Row) => r.id);
      if (stale.length) await supabase.from("insights").delete().in("id", stale);
      const { error } = await supabase.from("insights").insert(items.map((i) => ({ workspace_id: ws, user_id: ctx.userId, text: i.text, kind: i.kind, evidence: i.evidence })));
      return { data: undefined, error };
    },
    () => {
      const db = readLocal(ctx);
      const kept = db.insights.filter((i) => i.applied || !keys.includes(i.evidence.key));
      db.insights = [...items.map((i) => ({ ...i, id: uuid(), workspaceId: ws, applied: false, createdAt: now() })), ...kept];
      writeLocal(ctx, db);
    },
  );
}

export async function markInsightApplied(ctx: RepoCtx, id: string): Promise<void> {
  await run(
    async () => { const { error } = await supabase.from("insights").update({ applied: true }).eq("id", id); return { data: undefined, error }; },
    () => { const db = readLocal(ctx); db.insights = db.insights.map((i) => (i.id === id ? { ...i, applied: true } : i)); writeLocal(ctx, db); },
  );
}

// ── Linking existing pipeline rows to plays ──

/**
 * Inserts into an existing table with `play_id` (and other optional link columns). If migration 009 has not added
 * those columns yet, retries without them so the original feature keeps working.
 */
export async function insertWithLinks(table: string, row: Row, links: Row): Promise<{ data: Row | null; error: any }> {
  const clean = Object.fromEntries(Object.entries(links).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  if (Object.keys(clean).length) {
    const first = await supabase.from(table).insert({ ...row, ...clean }).select().single();
    if (!first.error || !isMissingSchema(first.error)) return first;
  }
  return supabase.from(table).insert(row).select().single();
}

export async function upsertWithLinks(table: string, row: Row, links: Row): Promise<{ error: any }> {
  const clean = Object.fromEntries(Object.entries(links).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  if (Object.keys(clean).length) {
    const first = await supabase.from(table).upsert({ ...row, ...clean });
    if (!first.error || !isMissingSchema(first.error)) return first;
  }
  return supabase.from(table).upsert(row);
}
