// Builds the full demo dataset relative to "now". Import buildDemoSeed in the demo data adapter.
import { DEMO_USER, DEMO_COMPANY_ID, DEMO_WORKSPACE, DEMO_SECONDARY_WORKSPACES, DEMO_SAVED_CONTEXTS } from "./company";
import { SEED_ENTRIES, SEED_QUEUE } from "./results";
import { SEED_TRANSCRIPTS, SEED_GENERATIONS, TOUR_PLAY, GUIDED_PROMPTS } from "./content";
import { GROWTH_PLAN, PLAN_HISTORY, SEED_PLAYS, SEED_EXPERIMENTS, SEED_INSIGHTS } from "./growth";
import { DEMO_END } from "./recruiter.config";

const DAY = 86400000;
const iso = (now: Date, d: number) => new Date(now.getTime() - d * DAY).toISOString().slice(0, 10);
const stamp = (now: Date, d: number, hour = 9) => { const t = new Date(now.getTime() - d * DAY); t.setHours(hour, 0, 0, 0); return t.toISOString(); };

export function buildDemoSeed(now: Date = new Date()) {
  const entries = SEED_ENTRIES.map((e, i) => ({
    id: `demo-entry-${i + 1}`, date: iso(now, e.daysAgo), title: e.title, format: e.format, source: e.source,
    impressions: e.impressions, engagementRate: e.engagementRate, followersGained: e.followersGained, notes: e.notes,
  }));
  const totalGained = entries.reduce((s, e) => s + e.followersGained, 0);
  const currentFollowers = Number(DEMO_WORKSPACE.baseline.followers) + totalGained; // 3123

  const queue = SEED_QUEUE.map((q, i) => ({
    id: `demo-queue-${i + 1}`, title: q.title, format: q.format, date: iso(now, -q.daysFromNow), time: q.time,
    status: q.status, awaitingResults: !!q.awaitingResults, due: !!q.due,
  }));

  const transcripts = SEED_TRANSCRIPTS.map(t => ({
    id: t.id, transcript_text: t.text, duration_seconds: t.durationSeconds, created_at: stamp(now, t.daysAgo, t.hour),
  }));
  const generations = SEED_GENERATIONS.map(g => ({
    id: g.id, transcriptId: g.transcriptId, playKey: g.playKey, format: g.format, title: g.title, content: g.content, created_at: stamp(now, g.daysAgo, g.hour),
  }));

  const monday = (offsetWeeks: number) => { const t = new Date(now.getTime() + offsetWeeks * 7 * DAY); const dow = (t.getDay() + 6) % 7; t.setDate(t.getDate() - dow); return t.toISOString().slice(0, 10); };
  const plays = SEED_PLAYS.map(p => ({
    ...p, id: `demo-${p.key}`, weekStart: monday(p.weekOffset),
    guidedPrompts: GUIDED_PROMPTS[p.key] || [],
    linkedEntryId: p.entryTitle ? entries.find(e => e.title === p.entryTitle)?.id : undefined,
    linkedGenerationIds: generations.filter(g => g.playKey === p.key).map(g => g.id),
  }));

  return {
    user: DEMO_USER, companyId: DEMO_COMPANY_ID, workspace: DEMO_WORKSPACE, secondaryWorkspaces: DEMO_SECONDARY_WORKSPACES,
    savedContexts: DEMO_SAVED_CONTEXTS, setupComplete: true,
    entries, queue, transcripts, generations,
    growth: {
      plan: { ...GROWTH_PLAN, createdAt: stamp(now, 63), currentFollowers, weekOfProgram: 9, totalWeeks: 12 },
      planHistory: PLAN_HISTORY.map(h => ({ ...h, date: iso(now, h.daysAgo) })),
      plays,
      experiments: SEED_EXPERIMENTS.map(e => ({ ...e, startedAt: iso(now, e.daysAgo) })),
      insights: SEED_INSIGHTS.map(i => ({ ...i, createdAt: stamp(now, i.daysAgo) })),
    },
    tour: TOUR_PLAY,
    end: DEMO_END,
  };
}
