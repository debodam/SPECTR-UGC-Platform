/**
 * Turns the Rampwise seed (src/demo/seed, built by buildDemoSeed) into the same rows the real app reads
 * from Supabase, so every real page renders unchanged in the demo.
 */
import { buildDemoSeed } from "./seed";
import { SEED_PLAYS, SEED_INSIGHTS, SEED_EXPERIMENTS } from "./seed/growth";
import { SEED_GENERATIONS } from "./seed/content";
import { weekStartOf } from "@/lib/growth-types";
import { emptyGrowthPrefs, type Workspace } from "@/lib/spectr-store";

export type DemoRow = Record<string, unknown>;
export type DemoTables = Record<string, DemoRow[]>;

const DAY = 86400000;
export const DEMO_WS_ID = "demo-workspace-rampwise";
export const DEMO_PLAN_ID = "demo-plan-v3";

const at = (now: Date, daysAgo: number, hour = 9) => {
  const t = new Date(now.getTime() - daysAgo * DAY);
  t.setHours(hour, 0, 0, 0);
  return t.toISOString();
};

/** Pillar shares are set so the open "customer wins" insight raises it from 20 to 25 percent, as its text says. */
const PILLAR_SHARE: Record<string, number> = { p1: 40, p2: 20, p3: 20, p4: 20 };

/** Actions for the insights that can be applied from the Growth plan. */
const INSIGHT_ACTION: Record<string, unknown> = {
  "ins-1": { type: "cadence", value: 5 },
  "ins-4": { type: "pillar_share", pillar: "Customer wins with numbers", delta: 5 },
};

const earlier = (time: string, now: Date) => {
  const t = new Date(now.getTime() - 5 * 60000);
  if (t.getDate() !== now.getDate()) return "00:00";
  const nowHm = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  return time < nowHm ? time : nowHm;
};

export function demoSeed(now = new Date()) {
  return buildDemoSeed(now);
}

export function demoWorkspace(): Workspace {
  const w = demoSeed().workspace;
  return {
    companyId: w.companyId,
    companyName: w.companyName,
    companyLogoUrl: "",
    industry: w.industry,
    primaryPlatform: "LinkedIn",
    startingFromScratch: false,
    baseline: { ...w.baseline },
    targets: { ...w.targets },
    goalDescription: w.goalDescription,
    companyDescription: w.companyDescription,
    companyPdfUrl: "",
    companyPdfName: "",
    audience: { ...w.audience },
    growthPrefs: { ...emptyGrowthPrefs, ...w.growthPrefs, avoid: "" },
  };
}

export function buildDemoTables(now = new Date()): DemoTables {
  const seed = buildDemoSeed(now);
  const user = seed.user.id;
  const company = seed.companyId;
  const own = { company_id: company, user_id: user };
  const w = seed.workspace;

  const pillars = seed.growth.plan.pillars.map((p) => ({
    name: p.name,
    description: p.description,
    share: PILLAR_SHARE[p.id] ?? p.sharePct,
  }));
  const pillarName = (id: string) => seed.growth.plan.pillars.find((p) => p.id === id)?.name ?? "";
  const playId = (key?: string) => (key ? `demo-${key}` : null);

  const entries = seed.entries.map((e) => {
    const play = SEED_PLAYS.find((p) => p.entryTitle === e.title);
    return {
      ...own,
      id: e.id,
      date: e.date,
      title: e.title,
      format: e.format,
      source: e.source,
      impressions: e.impressions,
      engagement_rate: e.engagementRate,
      followers_gained: e.followersGained,
      notes: e.notes,
      play_id: playId(play?.key),
      variant: null,
      pending: false,
      created_at: `${e.date}T12:00:00.000Z`,
    };
  });

  const genForTitle = (title: string) => SEED_GENERATIONS.find((g) => g.title === title);
  const playForTitle = (title: string) => SEED_PLAYS.find((p) => p.title === title);
  const queue = seed.queue.map((q) => {
    const status = q.status.toLowerCase();
    return {
      ...own,
      id: q.id,
      title: q.title,
      content: genForTitle(q.title)?.content ?? "",
      platform: "LinkedIn",
      format: q.format,
      date: q.date,
      // The seed's "due today" post must read as due whenever the demo is opened.
      time: q.due ? earlier(q.time, now) : q.time,
      status,
      posted_at: status === "posted" ? `${q.date}T${q.time}:00` : null,
      play_id: playId(playForTitle(q.title)?.key),
      created_at: at(now, 10),
    };
  });

  // Posted yesterday and waiting for numbers: a pending Results entry, as Mark as posted creates.
  const pending = seed.queue
    .filter((q) => q.awaitingResults)
    .map((q, i) => ({
      ...own,
      id: `demo-pending-${i + 1}`,
      date: q.date,
      title: q.title,
      format: q.format,
      source: "Draft",
      impressions: 0,
      engagement_rate: 0,
      followers_gained: 0,
      notes: "",
      play_id: playId(playForTitle(q.title)?.key),
      variant: null,
      pending: true,
      created_at: at(now, 1),
    }));

  const transcripts = seed.transcripts.map((t) => ({
    ...own,
    ...t,
    play_id: playId(SEED_PLAYS.find((p) => p.transcriptId === t.id)?.key),
  }));
  const generations = seed.generations.map((g) => ({
    ...own,
    id: g.id,
    format: g.format,
    content: g.content,
    created_at: g.created_at,
    play_id: playId(g.playKey),
  }));

  const plays = SEED_PLAYS.map((p) => {
    const entry = p.entryTitle ? entries.find((e) => e.title === p.entryTitle) : undefined;
    const gen = generations.find((g) => g.play_id === playId(p.key));
    const tr = transcripts.find((t) => t.play_id === playId(p.key));
    return {
      ...own,
      id: playId(p.key),
      workspace_id: DEMO_WS_ID,
      plan_id: DEMO_PLAN_ID,
      week_start: weekStartOf(new Date(now.getTime() + p.weekOffset * 7 * DAY)),
      title: p.title,
      type: p.type,
      hook: p.hook,
      rationale: p.rationale,
      pillar: pillarName(p.pillarId),
      format: p.format.toLowerCase(),
      status: p.status,
      linked_log_id: tr?.id ?? null,
      linked_content_id: gen?.id ?? null,
      results: entry
        ? {
            impressions: entry.impressions,
            engagementRate: entry.engagement_rate,
            followersGained: entry.followers_gained,
            entries: 1,
          }
        : {},
      created_at: at(now, -p.weekOffset * 7 + 7),
    };
  });

  const history = [...seed.growth.planHistory].reverse().map((h) => ({
    at: `${h.date}T09:00:00.000Z`,
    change: h.summary,
    source: h.version === 1 ? "generated" : h.version === 3 ? "insight" : "regenerated",
  }));
  const plan = seed.growth.plan;
  const growthPlan = {
    ...own,
    id: DEMO_PLAN_ID,
    workspace_id: DEMO_WS_ID,
    active: true,
    north_star_metric: plan.northStarMetric,
    north_star_key: "followers",
    goal_summary: plan.goalSummary,
    pillars,
    cadence_per_week: plan.cadencePerWeek.total,
    channels: plan.channels,
    audience_summary: plan.audienceSummary,
    history,
    created_at: plan.createdAt,
  };

  const experiments = SEED_EXPERIMENTS.map((e) => ({
    ...own,
    id: `demo-${e.id}`,
    workspace_id: DEMO_WS_ID,
    play_id: playId(e.playKey) ?? "",
    hypothesis: e.hypothesis,
    variant_a: e.variantA,
    variant_b: e.variantB,
    metric: "impressions",
    result:
      e.resultA !== undefined && e.resultB !== undefined
        ? { a: { value: e.resultA, entries: 1 }, b: { value: e.resultB, entries: 1 } }
        : {},
    winner: e.winner ? e.winner.toLowerCase() : null,
    learning: e.learning ?? "",
    status: e.status === "concluded" ? "complete" : "running",
    created_at: at(now, e.daysAgo),
  }));

  const insights = SEED_INSIGHTS.map((i) => {
    const numbers: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(i.evidence))
      numbers[k] = Array.isArray(v) ? v.join(", ") : (v as number | string);
    return {
      ...own,
      id: `demo-${i.id}`,
      workspace_id: DEMO_WS_ID,
      text: i.text,
      kind: i.kind,
      evidence: {
        key: i.id,
        numbers,
        ...(INSIGHT_ACTION[i.id] ? { action: INSIGHT_ACTION[i.id] } : {}),
      },
      applied: i.applied,
      created_at: at(now, i.daysAgo),
    };
  });

  return {
    profiles: [{ id: user, email: seed.user.email, full_name: seed.user.name }],
    companies: [
      {
        id: company,
        name: w.companyName,
        logo_url: null,
        created_by: user,
        created_at: at(now, 70),
      },
      ...seed.secondaryWorkspaces.map((s) => ({
        id: s.companyId,
        name: s.companyName,
        logo_url: null,
        created_by: user,
        created_at: at(now, 40),
      })),
    ],
    workspaces: [
      {
        id: DEMO_WS_ID,
        ...own,
        setup_complete: true,
        industry: w.industry,
        starting_from_scratch: false,
        baseline: w.baseline,
        targets: w.targets,
        goal_description: w.goalDescription,
        audience: w.audience,
        growth_prefs: { ...w.growthPrefs, avoid: "" },
      },
      ...seed.secondaryWorkspaces.map((s) => ({
        id: `demo-workspace-${s.companyId}`,
        company_id: s.companyId,
        user_id: user,
        setup_complete: true,
        industry: s.industry,
        starting_from_scratch: false,
        baseline: s.baseline,
        targets: s.targets,
        goal_description: "",
        audience: { jobTitles: "", seniority: "", companySize: "", description: "" },
        growth_prefs: {},
      })),
    ],
    perf_entries: [...entries, ...pending],
    queue_items: queue,
    transcripts,
    generations,
    saved_contexts: seed.savedContexts.map((c, i) => ({
      id: `demo-ctx-${i + 1}`,
      user_id: user,
      name: c.name,
      text: c.text,
      created_at: at(now, 30 - i),
    })),
    growth_plans: [growthPlan],
    plays,
    experiments,
    insights,
  };
}
