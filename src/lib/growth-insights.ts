import type { Format, PerfEntry } from "./spectr-store";
import type { Experiment, GrowthPlan, InsightEvidence, Pillar, Play } from "./growth-types";

/**
 * Computes insights from real Results data. Every number here is calculated; the AI step may only rephrase
 * `text`, never change the numbers. Each candidate has a stable `key` so re-running replaces it instead of piling up.
 */

export interface InsightCandidate { kind: "pattern" | "recommendation" | "warning"; text: string; evidence: InsightEvidence }

const FORMAT_PLURAL: Record<Format, string> = { Article: "Articles", Post: "Posts", "Video Script": "Video scripts" };
const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const DAY = 86_400_000;

function byFormat(entries: PerfEntry[]) {
  const m = new Map<Format, PerfEntry[]>();
  for (const e of entries) m.set(e.format, [...(m.get(e.format) ?? []), e]);
  return [...m.entries()].map(([format, list]) => ({
    format, n: list.length, imp: avg(list.map((e) => e.impressions)), eng: avg(list.map((e) => e.engagementRate)), fol: avg(list.map((e) => e.followersGained)),
  }));
}

export function computeInsights(opts: { entries: PerfEntry[]; plays: Play[]; plan: GrowthPlan | null; projectedPct?: number; now?: Date }): InsightCandidate[] {
  const { entries, plays, plan } = opts;
  const now = opts.now ?? new Date();
  const out: InsightCandidate[] = [];
  const formats = byFormat(entries).filter((f) => f.n > 0);

  // 1. Which format earns the most reach
  const byImp = [...formats].filter((f) => f.imp > 0).sort((a, b) => b.imp - a.imp);
  if (byImp.length >= 2 && byImp[1].imp > 0) {
    const ratio = r1(byImp[0].imp / byImp[1].imp);
    if (ratio >= 1.2) {
      out.push({
        kind: "pattern",
        text: `${FORMAT_PLURAL[byImp[0].format]} earn ${ratio}x the impressions of ${FORMAT_PLURAL[byImp[1].format].toLowerCase()} (${Math.round(byImp[0].imp).toLocaleString()} vs ${Math.round(byImp[1].imp).toLocaleString()} on average).`,
        evidence: { key: "format_impressions", numbers: { best: byImp[0].format, next: byImp[1].format, ratio, bestAvg: Math.round(byImp[0].imp), nextAvg: Math.round(byImp[1].imp), entries: entries.length } },
      });
    }
  }

  // 2. Which format engages best
  const byEng = [...formats].filter((f) => f.eng > 0).sort((a, b) => b.eng - a.eng);
  const overallEng = avg(entries.map((e) => e.engagementRate));
  if (byEng.length >= 2 && overallEng > 0 && byEng[0].eng / overallEng >= 1.2) {
    out.push({
      kind: "pattern",
      text: `${FORMAT_PLURAL[byEng[0].format]} get the strongest engagement at ${r1(byEng[0].eng)}%, against a ${r1(overallEng)}% average.`,
      evidence: { key: "format_engagement", numbers: { best: byEng[0].format, bestEng: r1(byEng[0].eng), avgEng: r1(overallEng) } },
    });
  }

  // 3. Which pillar performs, from measured plays (recommendation: shift share toward it)
  if (plan) {
    const pillarStats = new Map<string, number[]>();
    for (const p of plays) {
      if (p.status !== "measured" || !p.results.entries || !p.pillar) continue;
      pillarStats.set(p.pillar, [...(pillarStats.get(p.pillar) ?? []), (p.results.impressions ?? 0) / p.results.entries]);
    }
    const ranked = [...pillarStats.entries()].map(([pillar, xs]) => ({ pillar, imp: avg(xs), n: xs.length })).sort((a, b) => b.imp - a.imp);
    if (ranked.length >= 2 && ranked[1].imp > 0) {
      const ratio = r1(ranked[0].imp / ranked[1].imp);
      const current = plan.pillars.find((p) => p.name === ranked[0].pillar)?.share ?? 0;
      if (ratio >= 1.25 && current < 60) {
        out.push({
          kind: "recommendation",
          text: `Give ${ranked[0].pillar} 10% more of your content. Its plays average ${Math.round(ranked[0].imp).toLocaleString()} impressions, ${ratio}x ${ranked[1].pillar}.`,
          evidence: { key: "pillar_share", numbers: { pillar: ranked[0].pillar, ratio, bestAvg: Math.round(ranked[0].imp), currentShare: current }, action: { type: "pillar_share", pillar: ranked[0].pillar, delta: 10 } },
        });
      }
    }

    // 4. Pace against the plan's cadence (recommendation: raise cadence)
    const recent = entries.filter((e) => now.getTime() - new Date(e.date + "T00:00:00").getTime() <= 14 * DAY);
    const perWeek = r1(recent.length / 2);
    if (opts.projectedPct !== undefined && opts.projectedPct < 90 && plan.cadencePerWeek < 7 && entries.length >= 2) {
      const next = plan.cadencePerWeek + 1;
      out.push({
        kind: "recommendation",
        text: `You are on pace for ${opts.projectedPct}% of your target. Raising your plan from ${plan.cadencePerWeek} to ${next} pieces a week is the fastest lever. You logged ${perWeek} a week over the last 2 weeks.`,
        evidence: { key: "cadence", numbers: { projectedPct: opts.projectedPct, cadence: plan.cadencePerWeek, next, perWeek }, action: { type: "cadence", value: next } },
      });
    }
  }

  // 5. Posted or scheduled plays with nothing logged
  const unmeasured = plays.filter((p) => p.status === "posted" || p.status === "scheduled").length;
  if (unmeasured >= 2) {
    out.push({
      kind: "warning",
      text: `${unmeasured} scheduled or posted plays have no results yet. Log their numbers so the plan can learn from them.`,
      evidence: { key: "unmeasured", numbers: { plays: unmeasured } },
    });
  }

  // 6. Results have gone quiet
  const last = entries.map((e) => e.date).sort().pop();
  if (last) {
    const days = Math.floor((now.getTime() - new Date(last + "T00:00:00").getTime()) / DAY);
    if (days >= 14) {
      out.push({
        kind: "warning",
        text: `No results logged in ${days} days. Forecasts and insights only stay accurate with fresh numbers.`,
        evidence: { key: "stale", numbers: { days } },
      });
    }
  }

  return out;
}

/** Numbers for one variant of an experiment, from the Results entries logged against it. */
export function variantResult(exp: Experiment, entries: PerfEntry[], v: "a" | "b") {
  const list = entries.filter((e) => e.playId === exp.playId && e.variant === v);
  if (!list.length) return undefined;
  const value = exp.metric === "engagementRate"
    ? r1(avg(list.map((e) => e.engagementRate)))
    : list.reduce((s, e) => s + (exp.metric === "followersGained" ? e.followersGained : e.impressions), 0);
  return { value, entries: list.length };
}

/** The learning written when a winner is declared. Plain, numeric, no em dashes. */
export function experimentLearning(exp: Experiment, winner: "a" | "b", a: { value: number }, b: { value: number }, playTitle: string) {
  const w = winner === "a" ? a : b, l = winner === "a" ? b : a;
  const metric = exp.metric === "engagementRate" ? "engagement" : exp.metric === "followersGained" ? "followers" : "impressions";
  const hook = winner === "a" ? exp.variantA : exp.variantB;
  const lift = l.value > 0 ? `${r1(w.value / l.value)}x the ${metric} of` : `more ${metric} than`;
  return `On "${playTitle}", hook ${winner.toUpperCase()} earned ${lift} hook ${winner === "a" ? "B" : "A"}. Lead with hooks like: "${hook}"`;
}

/** Applies a share change to one pillar and rebalances the rest so shares still add up to 100. */
export function shiftPillarShare(pillars: Pillar[], name: string, delta: number): Pillar[] {
  const target = pillars.find((p) => p.name === name);
  if (!target) return pillars;
  const newShare = Math.min(80, target.share + delta);
  const others = pillars.filter((p) => p.name !== name);
  const othersTotal = others.reduce((s, p) => s + p.share, 0) || 1;
  const remaining = 100 - newShare;
  const shifted = pillars.map((p) => (p.name === name ? { ...p, share: newShare } : { ...p, share: Math.max(5, Math.round((p.share / othersTotal) * remaining)) }));
  const drift = 100 - shifted.reduce((s, p) => s + p.share, 0);
  return shifted.map((p) => (p.name === name ? { ...p, share: p.share + drift } : p));
}
