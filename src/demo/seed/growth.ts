// Growth Engine seed: plan, plays, experiments, insights, plan history.
import { SEED_ENTRIES } from "./results";

export const GROWTH_PLAN = {
  northStarMetric: "Net new followers per week from customer success and RevOps leaders",
  northStarTarget: 150,
  goalSummary:
    "Grow from 2,140 to 4,000 followers in 12 weeks by becoming the most useful voice on customer onboarding for mid-market B2B SaaS.",
  audienceSummary:
    "VPs, directors and heads of customer success, onboarding and RevOps at 50 to 500 person SaaS companies, plus founders hiring their first CS lead.",
  cadencePerWeek: { total: 5, video: 2, article: 1, post: 2 },
  channels: ["LinkedIn"],
  pillars: [
    {
      id: "p1",
      name: "Onboarding, unfiltered",
      description: "Hard lessons and specific mistakes from real onboardings, told with numbers.",
      sharePct: 35,
    },
    {
      id: "p2",
      name: "Customer wins with numbers",
      description: "One customer, one outcome, one before and after metric.",
      sharePct: 25,
    },
    {
      id: "p3",
      name: "Founder in the trenches",
      description: "Honest build in public moments: hires, misses, decisions.",
      sharePct: 20,
    },
    {
      id: "p4",
      name: "Frameworks you can steal",
      description: "Simple models and templates a CS leader can use this week.",
      sharePct: 20,
    },
  ],
};

export const PLAN_HISTORY = [
  {
    version: 1,
    daysAgo: 63,
    summary: "Initial plan generated at setup: 4 posts a week, 1 video, 1 article, 2 posts.",
    change: null,
  },
  {
    version: 2,
    daysAgo: 35,
    summary:
      "Cadence moved to 4 a week with 1 video after the first video script outperformed posts.",
    change: "Video: 0 to 1 a week",
  },
  {
    version: 3,
    daysAgo: 7,
    summary:
      "Insight applied: video scripts earn about 2.4x the impressions of posts, so cadence moved to 2 videos a week.",
    change: "Video: 1 to 2 a week, Post: 3 to 2 a week",
  },
];

export type PlayStatus =
  "suggested" | "in progress" | "recorded" | "transformed" | "scheduled" | "posted" | "measured";

export interface SeedPlay {
  key: string;
  weekOffset: number; // 0 = this week, -1 last week
  title: string;
  type: string;
  pillarId: string;
  format: "Article" | "Post" | "Video Script";
  hook: string;
  rationale: string;
  status: PlayStatus;
  transcriptId?: string;
  entryTitle?: string; // link to results by title
}

export const SEED_PLAYS: SeedPlay[] = [
  // This week
  {
    key: "play-kickoff-questions",
    weekOffset: 0,
    title: "Three questions to ask before every kickoff",
    type: "how-to",
    pillarId: "p4",
    format: "Post",
    status: "posted",
    hook: "Most kickoffs fail before they start. These three questions fix that.",
    rationale:
      "Framework posts are saved often. Your last two how-to posts earned 2.2k and 2.3k impressions.",
  },
  {
    key: "play-cobalt",
    weekOffset: 0,
    title: "How Cobalt Ledger cut time to first value from 41 days to 19",
    type: "customer win",
    pillarId: "p2",
    format: "Video Script",
    status: "transformed",
    transcriptId: "tr-cobalt",
    hook: "41 days to 19 days. Here is how one customer got there.",
    rationale:
      "Number hooks on video earned 1.5x the impressions of question hooks, and customer wins convert followers best.",
  },
  {
    key: "play-checklist",
    weekOffset: 0,
    title: "Why we deleted our onboarding checklist",
    type: "contrarian take",
    pillarId: "p1",
    format: "Article",
    status: "recorded",
    transcriptId: "tr-checklist",
    hook: "We deleted our onboarding checklist and customers got value faster.",
    rationale:
      "Contrarian titles on articles beat how-to titles by about 19 percent in impressions.",
  },
  {
    key: "play-cshire",
    weekOffset: 0,
    title: "Our first CS hire: what I got wrong",
    type: "founder story",
    pillarId: "p3",
    format: "Post",
    status: "scheduled",
    transcriptId: "tr-cshire",
    hook: "My first customer success hire was a mistake. It was my mistake, not hers.",
    rationale:
      "Founder stories convert about 1.8x more followers per 1,000 impressions than frameworks.",
  },
  {
    key: "play-signals",
    weekOffset: 0,
    title: "The 5 signals a customer is about to stall",
    type: "framework",
    pillarId: "p4",
    format: "Article",
    status: "suggested",
    hook: "Five signs your customer is about to stall, and what to do in the next 24 hours.",
    rationale:
      "Your day-9 silence content is your strongest topic. A signals framework extends it into something saveable.",
  },
  // Last week (measured)
  {
    key: "play-w8-a",
    weekOffset: -1,
    title: "Five words that kill a kickoff call",
    type: "contrarian take",
    pillarId: "p1",
    format: "Video Script",
    status: "measured",
    entryTitle: "Five words that kill a kickoff call",
    hook: "Five words that kill a kickoff call.",
    rationale: "Builds on the best kickoff video from week 6.",
  },
  {
    key: "play-w8-b",
    weekOffset: -1,
    title: "What time to first value actually measures",
    type: "framework",
    pillarId: "p4",
    format: "Post",
    status: "measured",
    entryTitle: "What time to first value actually measures",
    hook: "Time to first value is a feeling before it is a number.",
    rationale: "Definition posts make your frameworks easier to cite.",
  },
  {
    key: "play-w8-c",
    weekOffset: -1,
    title: "Onboarding is a promise, not a project plan",
    type: "contrarian take",
    pillarId: "p1",
    format: "Article",
    status: "measured",
    entryTitle: "Onboarding is a promise, not a project plan",
    hook: "Onboarding is a promise, not a project plan.",
    rationale: "Core belief of the brand, written for the first time.",
  },
  {
    key: "play-w8-d",
    weekOffset: -1,
    title: "Our CS team's one rule for week one",
    type: "founder story",
    pillarId: "p3",
    format: "Post",
    status: "measured",
    entryTitle: "Our CS team's one rule for week one",
    hook: "We have one rule for week one.",
    rationale: "Short operating rules tend to be shared.",
  },
  // Two weeks ago (measured)
  {
    key: "play-w7-a",
    weekOffset: -2,
    title: "Why I stopped asking if customers have questions",
    type: "contrarian take",
    pillarId: "p1",
    format: "Video Script",
    status: "measured",
    entryTitle: "Why I stopped asking if customers have questions",
    hook: "I stopped asking customers if they have questions.",
    rationale: "Kickoff content outperforms all other topics.",
  },
  {
    key: "play-w7-b",
    weekOffset: -2,
    title: "The champion is not the buyer",
    type: "framework",
    pillarId: "p4",
    format: "Post",
    status: "measured",
    entryTitle: "The champion is not the buyer",
    hook: "The champion is not the buyer.",
    rationale: "Sales and CS leaders both engage with this idea.",
  },
  {
    key: "play-w7-c",
    weekOffset: -2,
    title: "How to read a contract for onboarding clues",
    type: "how-to",
    pillarId: "p4",
    format: "Article",
    status: "measured",
    entryTitle: "How to read a contract for onboarding clues",
    hook: "The contract already tells you why the customer bought.",
    rationale: "Niche tactical content gets strong saves.",
  },
  {
    key: "play-w7-d",
    weekOffset: -2,
    title: "The day I almost lost our first customer",
    type: "founder story",
    pillarId: "p3",
    format: "Post",
    status: "measured",
    entryTitle: "The day I almost lost our first customer",
    hook: "The day I almost lost our first customer.",
    rationale: "Personal stories convert followers well.",
  },
];

export const GUIDED_PLAY_KEY_FOR_TOUR = "play-signals";

export interface SeedExperiment {
  id: string;
  playKey?: string;
  status: "running" | "concluded";
  daysAgo: number;
  hypothesis: string;
  variantA: string;
  variantB: string;
  metric: string;
  resultA?: number;
  resultB?: number;
  winner?: "A" | "B";
  learning?: string;
}

export const SEED_EXPERIMENTS: SeedExperiment[] = [
  {
    id: "exp-hook",
    status: "concluded",
    daysAgo: 24,
    playKey: "play-w8-a",
    hypothesis:
      "Opening a video script with a number will earn more impressions than opening with a question.",
    variantA:
      'Question hook: "What is the kickoff mistake everyone makes?" (60 seconds: the kickoff mistake everyone makes)',
    variantB:
      'Number hook: "50 percent to 68 percent. I changed the last two minutes of one call." (The last two minutes of a kickoff call)',
    metric: "Impressions",
    resultA: 2900,
    resultB: 4300,
    winner: "B",
    learning:
      "The number hook earned 48 percent more impressions and 34 percent more followers. Lead video scripts with a specific before and after number.",
  },
  {
    id: "exp-title",
    status: "concluded",
    daysAgo: 14,
    hypothesis: "A contrarian article title will beat a how-to title for impressions.",
    variantA: 'How-to title: "A simple model for time to first value"',
    variantB: 'Contrarian title: "Onboarding is not a checklist problem"',
    metric: "Impressions",
    resultA: 2350,
    resultB: 2700,
    winner: "B",
    learning:
      "The contrarian title earned 15 percent more impressions. Keep how-to content for posts, use contrarian titles for articles.",
  },
  {
    id: "exp-cobalt",
    status: "running",
    daysAgo: 1,
    playKey: "play-cobalt",
    hypothesis:
      "A customer result hook will beat a customer story hook on the Cobalt Ledger video.",
    variantA: 'Result hook: "41 days to 19 days. Here is how one customer got there."',
    variantB:
      'Story hook: "A VP of Customer Success told me she was losing customers before they ever used the product."',
    metric: "Impressions",
  },
];

function avg(a: number[]) {
  return a.reduce((x, y) => x + y, 0) / a.length;
}
const byFmt = (f: string) => SEED_ENTRIES.filter((e) => e.format === f);
const vid = avg(byFmt("Video Script").map((e) => e.impressions));
const post = avg(byFmt("Post").map((e) => e.impressions));
const eng = avg(SEED_ENTRIES.map((e) => e.engagementRate));

// Insights computed from the data so the numbers always match Results.
export const SEED_INSIGHTS = [
  {
    id: "ins-1",
    kind: "recommendation",
    daysAgo: 7,
    applied: true,
    text: `Video scripts average ${Math.round(vid).toLocaleString()} impressions, ${(vid / post).toFixed(1)}x the ${Math.round(post).toLocaleString()} average for posts. Move to 2 video scripts a week.`,
    evidence: { videoAvg: Math.round(vid), postAvg: Math.round(post) },
  },
  {
    id: "ins-2",
    kind: "pattern",
    daysAgo: 6,
    applied: false,
    text: "Videos that open with a specific number average 5,100 impressions. Videos that open with a question or a greeting average 2,100.",
    evidence: { numberHooks: [3300, 4300, 5900], other: [2900, 1400] },
  },
  {
    id: "ins-3",
    kind: "warning",
    daysAgo: 4,
    applied: false,
    text: `Average engagement rate is ${eng.toFixed(1)}% against a 4.5% target. Posts are the drag at 2.9%. Cut bullet lists and end every post with one direct question.`,
    evidence: { avgEngagement: Number(eng.toFixed(2)), target: 4.5 },
  },
  {
    id: "ins-4",
    kind: "recommendation",
    daysAgo: 3,
    applied: false,
    text: "Customer wins and founder stories gain the most followers per 1,000 impressions (about 24 versus 14 for frameworks). Raise customer wins from 20 to 25 percent of the plan.",
    evidence: { customerWinPlan: 25 },
  },
  {
    id: "ins-5",
    kind: "pattern",
    daysAgo: 2,
    applied: false,
    text: "Topics about the first 10 days of onboarding are your strongest. Four of your five best performers are about kickoff or the day-9 silence.",
    evidence: { topTopic: "first 10 days" },
  },
  {
    id: "ins-6",
    kind: "warning",
    daysAgo: 29,
    applied: true,
    text: "Videos that start with 'So today' lose viewers in the first 3 seconds. The week 5 video earned 1,400 impressions against a 3,957 average.",
    evidence: { weakOpen: "So today" },
  },
];
