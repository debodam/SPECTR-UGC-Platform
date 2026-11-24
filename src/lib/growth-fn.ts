import { createServerFn } from "@tanstack/react-start";
import { errMessage } from "./utils";
import { AiPlanSchema, type AiPlan, type PlanInputs } from "./growth-types";
import { applyPrefs, buildFallbackPlan } from "./growth-plan";
import { checkPayload, isSignedIn } from "./server-auth";

export interface PlanResult {
  plan: AiPlan;
  source: "ai" | "fallback";
  reason?: string;
}

const MODEL = "claude-sonnet-4-6";

const SYSTEM = `You are a B2B growth strategist who builds LinkedIn content strategies for startups. You return only valid JSON, no markdown fences, no commentary. Never use em dashes, and never use a hyphen as an em dash substitute; rewrite the sentence instead. Every plan must be specific to the company, sector and audience given. Generic advice is a failure.`;

function planPrompt(i: PlanInputs) {
  const lines = [
    `Company: ${i.companyName || "Unknown"}`,
    `Sector: ${i.sector || "Unknown"}`,
    i.companyDescription && `What the company does: ${i.companyDescription.slice(0, 1200)}`,
    `Audience: ${[i.audience.seniority, i.audience.jobTitles].filter(Boolean).join(" ") || "Not specified"}${i.audience.companySize ? ` at ${i.audience.companySize} companies` : ""}`,
    i.audience.description && `Audience notes: ${i.audience.description}`,
    i.goalDescription && `Goal in their words: ${i.goalDescription}`,
    `Baseline: ${JSON.stringify(i.baseline)}`,
    `Targets: ${JSON.stringify(i.targets)}`,
    i.startingFromScratch && "They are starting from scratch on LinkedIn.",
    i.learnings?.length &&
      `What has already worked for them (build on this): ${i.learnings.join(" | ")}`,
    i.growthPrefs?.focus && `Growth focus: ${i.growthPrefs.focus}`,
    i.growthPrefs?.weeklyTime &&
      `Time they can give each week: ${i.growthPrefs.weeklyTime}. Set cadence to fit it.`,
    i.growthPrefs?.formats?.length &&
      `Formats they will make (use only these): ${i.growthPrefs.formats.join(", ")}`,
    i.growthPrefs?.topics &&
      `Topics they want to be known for (base the pillars on these): ${i.growthPrefs.topics}`,
    i.growthPrefs?.voice && `Voice for every hook: ${i.growthPrefs.voice}`,
    i.growthPrefs?.avoid && `Do not sound like: ${i.growthPrefs.avoid}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `${lines}

Build their LinkedIn growth plan. Return a JSON object with exactly these keys:
- "northStarMetric": short label of the single metric that matters most, based on their targets.
- "northStarKey": one of "followers", "weeklyImpressions", "engagementRate", "monthlyVisitors".
- "goalSummary": one sentence: what they will achieve, for whom, by when if known.
- "audienceSummary": one short line describing exactly who they are writing for.
- "pillars": 3 or 4 objects { "name", "description", "share" } where share is a percent of content and all shares add up to 100.
- "cadencePerWeek": integer, realistic pieces per week for a small team (1 to 7).
- "plays": 4 or 5 objects for THIS week, each { "title", "type", "hook", "rationale", "pillar", "format" }.
  - "type" is one of: "founder story", "contrarian take", "customer win", "build in public", "launch", "hiring", "how-to".
  - "format" is one of: "article", "post", "video script".
  - "pillar" must exactly match one pillar name.
  - "hook" is the opening line they would actually say or write. It must name the audience and the sector explicitly.
  - "rationale" is one sentence on why this play moves the north star metric for this audience.
Use a mix of types and formats.`;
}

function extractJson(raw: string): unknown {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : raw;
  const obj = body.match(/\{[\s\S]*\}/);
  return JSON.parse(obj ? obj[0] : body);
}

const noDashes = (s: string) =>
  s
    .replace(/(\w)\s*[—–]\s*(\w)/g, "$1, $2")
    .replace(/[—–]/g, " ")
    .replace(/ {2,}/g, " ");

function sanitize(plan: AiPlan): AiPlan {
  const total = plan.pillars.reduce((s, p) => s + p.share, 0) || 1;
  const pillars = plan.pillars.map((p) => ({
    ...p,
    name: noDashes(p.name),
    description: noDashes(p.description),
    share: Math.round((p.share / total) * 100),
  }));
  const names = new Set(pillars.map((p) => p.name));
  return {
    ...plan,
    northStarMetric: noDashes(plan.northStarMetric),
    goalSummary: noDashes(plan.goalSummary),
    audienceSummary: noDashes(plan.audienceSummary),
    pillars,
    plays: plan.plays.map((p) => ({
      ...p,
      title: noDashes(p.title),
      hook: noDashes(p.hook),
      rationale: noDashes(p.rationale),
      pillar: names.has(p.pillar) ? p.pillar : pillars[0].name,
    })),
  };
}

export const generateGrowthPlan = createServerFn({ method: "POST" })
  .inputValidator((v: PlanInputs & { token?: string }) =>
    checkPayload<PlanInputs & { token?: string }>(v, 60_000),
  )
  .handler(async ({ data }): Promise<PlanResult> => {
    const fallback = (reason: string): PlanResult => ({
      plan: buildFallbackPlan(data),
      source: "fallback",
      reason,
    });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your-api-key-here")
      return fallback("ANTHROPIC_API_KEY is not configured");
    if (!(await isSignedIn(data.token))) return fallback("Not signed in");
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 2500,
        system: SYSTEM,
        messages: [{ role: "user", content: planPrompt(data) }],
      });
      const raw = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
      const parsed = AiPlanSchema.safeParse(extractJson(raw));
      if (!parsed.success)
        return fallback(
          `AI response failed validation: ${parsed.error.issues[0]?.message ?? "invalid"}`,
        );
      return { plan: applyPrefs(sanitize(parsed.data), data), source: "ai" };
    } catch (err) {
      console.error("Growth plan error:", err);
      return fallback(errMessage(err) ?? "AI call failed");
    }
  });

export interface PhraseInput {
  company: string;
  audience: string;
  texts: string[];
}

const numbersIn = (s: string) =>
  (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "")).sort();

/**
 * Lets Claude rephrase computed insights for this company. The numbers are fixed: any rephrased text whose numbers
 * differ from the computed text is discarded and the computed wording is kept.
 */
export const phraseInsights = createServerFn({ method: "POST" })
  .inputValidator((v: PhraseInput & { token?: string }) => {
    const p = checkPayload<PhraseInput & { token?: string }>(v, 40_000);
    if (!Array.isArray(p.texts) || p.texts.length > 20) throw new Error("Invalid request");
    return p;
  })
  .handler(async ({ data }): Promise<{ texts: string[]; source: "ai" | "computed" }> => {
    const computed = { texts: data.texts, source: "computed" as const };
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your-api-key-here" || !data.texts.length) return computed;
    if (!(await isSignedIn(data.token))) return computed;
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 800,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Rephrase each insight below for the team at ${data.company || "this company"}, who write for ${data.audience || "their audience"}. Keep every number exactly as written, keep each to one or two short sentences, plain and direct. Return JSON {"texts": [...]} with the same count and order.\n\n${JSON.stringify(data.texts)}`,
          },
        ],
      });
      const raw = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
      const parsed = (extractJson(raw) as { texts?: unknown }).texts;
      if (!Array.isArray(parsed) || parsed.length !== data.texts.length) return computed;
      const texts = data.texts.map((orig, i) => {
        const t = typeof parsed[i] === "string" ? noDashes(parsed[i] as string).trim() : "";
        return t && JSON.stringify(numbersIn(t)) === JSON.stringify(numbersIn(orig)) ? t : orig;
      });
      return { texts, source: "ai" };
    } catch (err) {
      console.error("Insight phrasing error:", err);
      return computed;
    }
  });
