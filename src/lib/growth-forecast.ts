import type { Format, PerfEntry, Workspace } from "./spectr-store";
import type { NorthStarKey } from "./growth-types";

/** Simple linear projection of the north star metric from real Results entries. */

export interface Forecast {
  state: "starter" | "no-target" | "untracked" | "ok";
  current: number;
  target: number;
  progressPct: number;
  projected: number;
  projectedPct: number;
  targetDate: string;
  weeksLeft: number;
  ratePerWeek: number;
  sentence: string;
  gapSentence: string;
  assumption: string;
  unit: string;
}

const DAY = 86_400_000;
const WORDS = ["zero", "One", "Two", "Three", "Four", "Five", "Six"];
const FORMAT_PLURAL: Record<Format, string> = { Article: "articles", Post: "posts", "Video Script": "video scripts" };
const num = (v?: string) => { const n = Number(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) ? n : 0; };
const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number, unit: string) => (unit === "%" ? `${round1(n)}%` : Math.round(n).toLocaleString());
const dateLabel = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Value each entry contributes toward the metric, used to rank formats for the gap suggestion. */
const contribution = (e: PerfEntry, key: NorthStarKey) =>
  key === "followers" ? e.followersGained : key === "engagementRate" ? e.engagementRate : e.impressions;

function bestFormat(entries: PerfEntry[], key: NorthStarKey): { format: Format; perEntry: number } | null {
  const by = new Map<Format, { sum: number; n: number }>();
  for (const e of entries) {
    const x = by.get(e.format) ?? { sum: 0, n: 0 };
    x.sum += contribution(e, key); x.n += 1; by.set(e.format, x);
  }
  let best: { format: Format; perEntry: number } | null = null;
  for (const [format, { sum, n }] of by) {
    const perEntry = sum / n;
    if (perEntry > 0 && (!best || perEntry > best.perEntry)) best = { format, perEntry };
  }
  return best;
}

export function computeForecast(opts: {
  key: NorthStarKey; label: string; ws: Workspace; entries: PerfEntry[]; planCreatedAt?: string; now?: Date;
}): Forecast {
  const { key, label, ws, entries } = opts;
  const now = opts.now ?? new Date();
  const unit = key === "engagementRate" ? "%" : "";
  const start = opts.planCreatedAt ? new Date(opts.planCreatedAt) : now;
  const targetDate = new Date(start.getTime() + 84 * DAY);
  const weeksLeft = Math.max(0, (targetDate.getTime() - now.getTime()) / (7 * DAY));
  const baseline = num(ws.baseline[key]);
  const target = num(ws.targets[key]);
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  const empty: Forecast = {
    state: "starter", current: baseline, target, progressPct: 0, projected: baseline, projectedPct: 0,
    targetDate: dateLabel(targetDate), weeksLeft, ratePerWeek: 0, sentence: "", gapSentence: "", assumption: "", unit,
  };
  if (!target) return { ...empty, state: "no-target", sentence: `Set a ${label.toLowerCase()} target in Settings to see a forecast.` };
  if (key === "monthlyVisitors") return { ...empty, state: "untracked", progressPct: Math.min(100, (baseline / target) * 100), sentence: "Profile visitors are not logged per post yet, so progress uses your setup baseline." };
  if (!sorted.length) return { ...empty, progressPct: Math.min(100, (baseline / target) * 100), sentence: "Log your first result in Results to unlock a forecast." };

  const firstDay = new Date(sorted[0].date + "T00:00:00");
  const spanWeeks = Math.max(1, (now.getTime() - firstDay.getTime()) / (7 * DAY));

  let current: number, rate: number, projected: number, assumption: string;
  if (key === "followers") {
    const gained = sorted.reduce((s, e) => s + e.followersGained, 0);
    current = baseline + gained;
    rate = gained / spanWeeks;
    projected = current + rate * weeksLeft;
    assumption = `Assumes the ${rate >= 0 ? "+" : ""}${round1(rate)} followers a week you have averaged over the last ${Math.round(spanWeeks)} week${Math.round(spanWeeks) === 1 ? "" : "s"} continues.`;
  } else {
    // Least-squares trend of the per-entry value over time, projected to the target date.
    const xs = sorted.map((e) => (new Date(e.date + "T00:00:00").getTime() - firstDay.getTime()) / (7 * DAY));
    const ys = sorted.map((e) => (key === "engagementRate" ? e.engagementRate : e.impressions));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    rate = den ? xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den : 0;
    const recent = sorted.slice(-3);
    current = recent.reduce((s, e) => s + (key === "engagementRate" ? e.engagementRate : e.impressions), 0) / recent.length;
    const xNow = (now.getTime() - firstDay.getTime()) / (7 * DAY);
    projected = Math.max(0, my + rate * (xNow + weeksLeft - mx));
    assumption = `Assumes the trend across your ${sorted.length} logged ${sorted.length === 1 ? "entry" : "entries"} (${rate >= 0 ? "+" : ""}${fmt(rate, unit)} per week) continues.`;
  }

  const progressPct = Math.max(0, Math.min(100, (current / target) * 100));
  const projectedPct = Math.max(0, Math.round((projected / target) * 100));
  const sentence = weeksLeft < 0.5
    ? `You are at ${Math.round(progressPct)}% of your ${label.toLowerCase()} target.`
    : `At your current pace you reach ${projectedPct}% of your ${label.toLowerCase()} target by ${dateLabel(targetDate)}.`;

  let gapSentence = "";
  const gap = target - projected;
  const best = bestFormat(sorted, key);
  if (projectedPct >= 100) gapSentence = "You are on track. Keep the cadence.";
  else if (best && weeksLeft >= 1 && key !== "engagementRate") {
    const perWeek = Math.max(1, Math.ceil(gap / weeksLeft / best.perEntry));
    gapSentence = perWeek <= 6
      ? `${WORDS[perWeek]} more ${perWeek === 1 ? FORMAT_PLURAL[best.format].replace(/s$/, "") : FORMAT_PLURAL[best.format]} a week closes the gap.`
      : `Closing the gap needs about ${perWeek} more ${FORMAT_PLURAL[best.format]} a week, or a longer timeline.`;
  } else if (best && key === "engagementRate") {
    gapSentence = `Your ${FORMAT_PLURAL[best.format]} engage best. Lean on them to lift the average.`;
  }

  return { state: "ok", current, target, progressPct, projected, projectedPct, targetDate: dateLabel(targetDate), weeksLeft, ratePerWeek: rate, sentence, gapSentence, assumption, unit };
}

export const formatMetric = fmt;
