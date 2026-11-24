import type { AiPlan, NorthStarKey, PlanInputs, PlayFormat } from "./growth-types";

/** Deterministic, workspace-specific plan. Used whenever the AI call fails, so the app never breaks. */

const NORTH_STAR_LABELS: Record<NorthStarKey, string> = {
  followers: "LinkedIn followers",
  weeklyImpressions: "Weekly impressions",
  engagementRate: "Engagement rate",
  monthlyVisitors: "Monthly profile visitors",
};

const num = (v?: string) => {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const first = (s: string, fallback: string) => clean(s.split(/[,;/]| and /i)[0] || "") || fallback;

export function pickNorthStar(inputs: PlanInputs): NorthStarKey {
  const t = inputs.targets;
  const focus = inputs.growthPrefs?.focus;
  if (focus === "Generate leads" && num(t.monthlyVisitors)) return "monthlyVisitors";
  if (focus === "Launch a product" && num(t.weeklyImpressions)) return "weeklyImpressions";
  if (num(t.followers)) return "followers";
  if (num(t.weeklyImpressions)) return "weeklyImpressions";
  if (num(t.engagementRate)) return "engagementRate";
  if (num(t.monthlyVisitors)) return "monthlyVisitors";
  return "followers";
}

export function northStarLabel(key: NorthStarKey) {
  return NORTH_STAR_LABELS[key];
}

function audienceParts(inputs: PlanInputs) {
  const role = first(inputs.audience.jobTitles, "operators");
  const seniority = clean(inputs.audience.seniority);
  const size = clean(inputs.audience.companySize);
  const sector = clean(inputs.sector) || "your market";
  const roleLabel = /s$/i.test(role) ? role : `${role}s`;
  // Prefix seniority only when it is a simple word and the title does not already carry one.
  const titled =
    /^(vp|svp|evp|head|director|chief|c[a-z]o|lead|manager|senior|founder|co-founder)\b/i.test(
      role,
    );
  const who = [
    seniority &&
    /^[A-Za-z-]+$/.test(seniority) &&
    !titled &&
    !role.toLowerCase().includes(seniority.toLowerCase())
      ? seniority
      : "",
    roleLabel,
  ]
    .filter(Boolean)
    .join(" ");
  return { role: roleLabel, who, size, sector };
}

function goalPhrase(inputs: PlanInputs, key: NorthStarKey) {
  const b = num(inputs.baseline[key]),
    t = num(inputs.targets[key]);
  const label = NORTH_STAR_LABELS[key].replace(/^(?!LinkedIn)./, (c) => c.toLowerCase());
  if (t && b) return `grow ${label} from ${b.toLocaleString()} to ${t.toLocaleString()}`;
  if (t) return `reach ${t.toLocaleString()} ${label}`;
  const g = clean(inputs.goalDescription);
  return g
    ? g.replace(/[.!]+$/, "").replace(/^./, (c) => c.toLowerCase())
    : `build a steady audience of ${label}`;
}

export function buildFallbackPlan(inputs: PlanInputs): AiPlan {
  const key = pickNorthStar(inputs);
  const company = clean(inputs.companyName) || "our company";
  const { role, who, size, sector } = audienceParts(inputs);
  const goal = goalPhrase(inputs, key);
  const gap =
    num(inputs.targets[key]) && num(inputs.baseline[key])
      ? num(inputs.targets[key]) / Math.max(1, num(inputs.baseline[key]))
      : 0;
  const cadence =
    cadenceFromTime(inputs.growthPrefs?.weeklyTime) ??
    (inputs.startingFromScratch ? 3 : gap > 3 ? 5 : gap > 1.5 ? 4 : 3);
  const sizeLabel = size ? `${size}` : "growing";

  const pillars = [
    {
      name: "Proof from the field",
      description: `Real outcomes ${company} creates for ${who} in ${sector}, told with numbers.`,
      share: 35,
    },
    {
      name: "Point of view",
      description: `Clear, sometimes contrarian takes on how ${sector} is changing and what ${role} should do about it.`,
      share: 25,
    },
    {
      name: `Building ${company}`,
      description: `Honest build in public updates that show the team, decisions and lessons behind ${company}.`,
      share: 25,
    },
    {
      name: "Playbooks",
      description: `Practical how-to content ${role} can use the same day.`,
      share: 15,
    },
  ];

  const learned = inputs.learnings?.length
    ? ` It also builds on what already worked: ${inputs.learnings[0]}`
    : "";

  const voice = inputs.growthPrefs?.voice || "Direct";
  const lead = VOICE_LEADS[voice] ?? VOICE_LEADS.Direct;

  return applyPrefs(
    {
      northStarMetric: NORTH_STAR_LABELS[key],
      northStarKey: key,
      goalSummary: `${company} will ${goal} by publishing focused content for ${who} in ${sector}.`,
      audienceSummary: `${who}${size ? ` at ${size} companies` : ""} in ${sector}.`,
      pillars,
      cadencePerWeek: cadence,
      plays: [
        {
          title: `Why we started ${company}`,
          type: "founder story",
          format: "video script",
          pillar: `Building ${company}`,
          hook: `${lead.story} ${company} after watching ${who} in ${sector} lose weeks to the same avoidable problem. Here is what I saw.`,
          rationale: `Founder stories on video earn follows from ${role} who want to know who is behind the product.${learned}`,
        },
        {
          title: `The ${sector} habit ${role} should drop`,
          type: "contrarian take",
          format: "post",
          pillar: "Point of view",
          hook: `${lead.contrarian} for ${who} in ${sector}: the playbook everyone copies is quietly slowing your team down.`,
          rationale: `A sharp point of view starts conversations in the comments, which widens reach toward the ${NORTH_STAR_LABELS[key].replace(/^(?!LinkedIn)./, (c) => c.toLowerCase())} goal.`,
        },
        {
          title: `How a ${sizeLabel} ${sector} team got results with ${company}`,
          type: "customer win",
          format: "article",
          pillar: "Proof from the field",
          hook: `How one ${sizeLabel} ${sector} team of ${role} turned a stuck quarter around in 30 days, step by step.`,
          rationale: `Specific proof is what moves ${who} from following to trusting, and articles get saved and shared internally.`,
        },
        {
          title: `A 3 step checklist for ${role}`,
          type: "how-to",
          format: "post",
          pillar: "Playbooks",
          hook: `${role.replace(/^./, (c) => c.toUpperCase())} in ${sector}: the 3 step checklist we use every week to ship faster with less rework.`,
          rationale: `Useful checklists get saved and reshared, a cheap way to reach new ${role} each week.`,
        },
        {
          title: `This week building ${company}`,
          type: "build in public",
          format: "video script",
          pillar: `Building ${company}`,
          hook: `This week building ${company} in public: what ${who} in ${sector} told us, and what we changed because of it.`,
          rationale: `Regular build in public updates keep ${company} visible and give ${role} a reason to follow along.`,
        },
      ],
    },
    inputs,
  );
}

const VOICE_LEADS: Record<string, { contrarian: string; story: string }> = {
  Direct: { contrarian: "Unpopular opinion", story: "I started" },
  Warm: { contrarian: "A gentle challenge", story: "I want to share why I started" },
  Analytical: { contrarian: "What the numbers say", story: "The data is why I started" },
  Bold: { contrarian: "Hot take", story: "I built" },
};

/** Weekly hours to pieces per week. */
export function cadenceFromTime(weeklyTime?: string): number | undefined {
  if (!weeklyTime) return undefined;
  if (weeklyTime.startsWith("1")) return 2;
  if (weeklyTime.startsWith("3")) return 3;
  if (weeklyTime.startsWith("6")) return 5;
  return undefined;
}

const FORMAT_FROM_PREF: Record<string, PlayFormat> = {
  Posts: "post",
  Articles: "article",
  "Video scripts": "video script",
};

/**
 * Applies Setup strategy choices to any plan (AI or fallback): cadence from weekly time, only the chosen formats,
 * pillars from chosen topics, and a hiring or launch play when that is the focus.
 */
export function applyPrefs(plan: AiPlan, inputs: PlanInputs): AiPlan {
  const prefs = inputs.growthPrefs;
  if (!prefs) return plan;
  let next = { ...plan };
  const cadence = cadenceFromTime(prefs.weeklyTime);
  if (cadence) next.cadencePerWeek = cadence;

  const topics = prefs.topics
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (
    topics.length >= 3 &&
    !plan.pillars.some((p) => topics.some((t) => p.name.toLowerCase().includes(t.toLowerCase())))
  ) {
    const base = Math.floor(100 / topics.length);
    const pillars = topics.map((t, i) => ({
      name: t.charAt(0).toUpperCase() + t.slice(1),
      description: `What ${clean(inputs.companyName) || "we"} know about ${t}, told for ${clean(inputs.audience.jobTitles.split(/[,;]/)[0] || "your audience")}.`,
      share: i === 0 ? 100 - base * (topics.length - 1) : base,
    }));
    next = {
      ...next,
      pillars,
      plays: next.plays.map((p, i) => ({ ...p, pillar: pillars[i % pillars.length].name })),
    };
  }

  const allowed = prefs.formats.map((f) => FORMAT_FROM_PREF[f]).filter(Boolean);
  if (allowed.length) {
    next = {
      ...next,
      plays: next.plays.map((p, i) =>
        allowed.includes(p.format) ? p : { ...p, format: allowed[i % allowed.length] },
      ),
    };
  }

  const company = clean(inputs.companyName) || "our company";
  const sector = clean(inputs.sector) || "our market";
  const { who } = audienceParts(inputs);
  const swap = (type: "hiring" | "launch") => {
    if (next.plays.some((p) => p.type === type)) return;
    const idx = next.plays.length - 1;
    const play =
      type === "hiring"
        ? {
            title: `We are hiring at ${company}`,
            type,
            hook: `We are hiring at ${company}, and the best people for it already work with ${who} in ${sector}.`,
            rationale:
              "Hiring posts reach strong candidates through your existing network, which is the focus you chose.",
          }
        : {
            title: `Launching something new at ${company}`,
            type,
            hook: `${who} in ${sector} asked for this for months. Today we are launching it.`,
            rationale:
              "A clear launch story turns attention into trials, which is the focus you chose.",
          };
    next = {
      ...next,
      plays: next.plays.map((p, i) =>
        i === idx ? { ...p, ...play, format: allowed[0] ?? p.format } : p,
      ),
    };
  };
  if (prefs.focus === "Hire talent") swap("hiring");
  if (prefs.focus === "Launch a product") swap("launch");
  return next;
}
