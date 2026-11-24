import { z } from "zod";
import type { Format } from "./spectr-store";

export const PLAY_TYPES = [
  "founder story",
  "contrarian take",
  "customer win",
  "build in public",
  "launch",
  "hiring",
  "how-to",
] as const;
export const PLAY_FORMATS = ["article", "post", "video script"] as const;
export const PLAY_STATUSES = [
  "suggested",
  "in progress",
  "recorded",
  "transformed",
  "scheduled",
  "posted",
  "measured",
] as const;
export const NORTH_STAR_KEYS = [
  "followers",
  "weeklyImpressions",
  "engagementRate",
  "monthlyVisitors",
] as const;
export const EXPERIMENT_METRICS = ["impressions", "engagementRate", "followersGained"] as const;

export type PlayType = (typeof PLAY_TYPES)[number];
export type PlayFormat = (typeof PLAY_FORMATS)[number];
export type PlayStatus = (typeof PLAY_STATUSES)[number];
export type NorthStarKey = (typeof NORTH_STAR_KEYS)[number];
export type ExperimentMetric = (typeof EXPERIMENT_METRICS)[number];

export interface Pillar {
  name: string;
  description: string;
  share: number;
}
export interface PlanChange {
  at: string;
  change: string;
  source: "generated" | "regenerated" | "insight";
}

export interface GrowthPlan {
  id: string;
  workspaceId: string;
  northStarMetric: string;
  northStarKey: NorthStarKey;
  goalSummary: string;
  pillars: Pillar[];
  cadencePerWeek: number;
  channels: string[];
  audienceSummary: string;
  history: PlanChange[];
  createdAt: string;
}

export interface PlayResults {
  impressions: number;
  engagementRate: number;
  followersGained: number;
  entries: number;
}

export interface Play {
  id: string;
  workspaceId: string;
  planId: string | null;
  weekStart: string;
  title: string;
  type: PlayType;
  hook: string;
  rationale: string;
  pillar: string;
  format: PlayFormat;
  status: PlayStatus;
  linkedLogId: string | null;
  linkedContentId: string | null;
  results: Partial<PlayResults>;
  createdAt: string;
}

export interface VariantResult {
  value: number;
  entries: number;
}

export interface Experiment {
  id: string;
  workspaceId: string;
  playId: string;
  hypothesis: string;
  variantA: string;
  variantB: string;
  metric: ExperimentMetric;
  result: { a?: VariantResult; b?: VariantResult };
  winner: "a" | "b" | null;
  learning: string;
  status: "running" | "complete";
  createdAt: string;
}

export type InsightAction =
  { type: "cadence"; value: number } | { type: "pillar_share"; pillar: string; delta: number };

export interface InsightEvidence {
  key: string;
  numbers: Record<string, number | string>;
  action?: InsightAction;
}

export interface Insight {
  id: string;
  workspaceId: string;
  text: string;
  kind: "pattern" | "recommendation" | "warning";
  evidence: InsightEvidence;
  applied: boolean;
  createdAt: string;
}

/** Inputs the plan generator needs, taken from the workspace. */
export interface PlanInputs {
  companyName: string;
  sector: string;
  companyDescription: string;
  goalDescription: string;
  audience: { jobTitles: string; seniority: string; companySize: string; description: string };
  baseline: Record<string, string>;
  targets: Record<string, string>;
  startingFromScratch: boolean;
  /** Learnings from experiments and applied insights, used when regenerating. */
  learnings?: string[];
  /** Strategy choices from Setup: focus, weekly time, formats, topics, voice, accounts to avoid sounding like. */
  growthPrefs?: {
    focus: string;
    weeklyTime: string;
    formats: string[];
    topics: string;
    voice: string;
    avoid: string;
  };
}

// ── AI output contract (validated with zod) ──

export const AiPlaySchema = z.object({
  title: z.string().min(3).max(120),
  type: z.enum(PLAY_TYPES),
  hook: z.string().min(10).max(320),
  rationale: z.string().min(10).max(320),
  pillar: z.string().min(2).max(60),
  format: z.enum(PLAY_FORMATS),
});

export const AiPlanSchema = z.object({
  northStarMetric: z.string().min(3).max(80),
  northStarKey: z.enum(NORTH_STAR_KEYS),
  goalSummary: z.string().min(10).max(320),
  audienceSummary: z.string().min(5).max(240),
  pillars: z
    .array(
      z.object({
        name: z.string().min(2).max(60),
        description: z.string().min(5).max(220),
        share: z.number().min(5).max(80),
      }),
    )
    .min(3)
    .max(4),
  cadencePerWeek: z.number().int().min(1).max(10),
  plays: z.array(AiPlaySchema).min(4).max(5),
});

export type AiPlan = z.infer<typeof AiPlanSchema>;

// ── Format mapping between plays (lowercase, per schema) and the app's Format ──

export const toAppFormat = (f: PlayFormat): Format =>
  f === "article" ? "Article" : f === "post" ? "Post" : "Video Script";
export const toPlayFormat = (f: Format): PlayFormat =>
  f === "Article" ? "article" : f === "Post" ? "post" : "video script";

export const PLAY_STATUS_ORDER: Record<PlayStatus, number> = {
  suggested: 0,
  "in progress": 1,
  recorded: 2,
  transformed: 3,
  scheduled: 4,
  posted: 5,
  measured: 6,
};

/** Monday of the week containing `d`, as YYYY-MM-DD. */
export function weekStartOf(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
