// Growth Engine seed: plan, plays, experiments, insights, plan history.
import { SEED_ENTRIES } from "./results";

export const GROWTH_PLAN = {
  northStarMetric: "Net new followers per week from coaches, performance staff and club directors",
  northStarTarget: 150,
  goalSummary:
    "Grow from 2,140 to 4,000 followers in 12 weeks by becoming the most useful voice on athlete development for basketball coaches and club directors.",
  audienceSummary:
    "Head coaches, player development directors and strength coaches at high school, club and college basketball programs, plus athletic directors and club directors who choose training tools.",
  cadencePerWeek: { total: 5, video: 2, article: 1, post: 2 },
  channels: ["LinkedIn"],
  pillars: [
    { id: "p1", name: "Training, unfiltered", description: "Hard lessons and specific mistakes from real practices, told with numbers.", sharePct: 35 },
    { id: "p2", name: "Athlete wins with numbers", description: "One athlete, one outcome, one before and after metric.", sharePct: 25 },
    { id: "p3", name: "Founder and coach in the trenches", description: "Honest build in public moments: hires, misses, decisions.", sharePct: 20 },
    { id: "p4", name: "Programs you can steal", description: "Simple programs and templates a coach can use this week.", sharePct: 20 },
  ],
};

export const PLAN_HISTORY = [
  { version: 1, daysAgo: 63, summary: "Initial plan generated at setup: 4 posts a week, 1 video, 1 article, 2 posts.", change: null },
  { version: 2, daysAgo: 35, summary: "Cadence moved to 4 a week with 1 video after the first video script outperformed posts.", change: "Video: 0 to 1 a week" },
  { version: 3, daysAgo: 7, summary: "Insight applied: video scripts earn about 2.4x the impressions of posts, so cadence moved to 2 videos a week.", change: "Video: 1 to 2 a week, Post: 3 to 2 a week" },
];

export type PlayStatus = "suggested" | "in progress" | "recorded" | "transformed" | "scheduled" | "posted" | "measured";

export interface SeedPlay {
  key: string; weekOffset: number; // 0 = this week, -1 last week
  title: string; type: string; pillarId: string; format: "Article" | "Post" | "Video Script";
  hook: string; rationale: string; status: PlayStatus;
  transcriptId?: string; entryTitle?: string; // link to results by title
}

export const SEED_PLAYS: SeedPlay[] = [
  // This week
  { key: "play-three-questions", weekOffset: 0, title: "Three questions to ask before writing any training program", type: "how-to", pillarId: "p4", format: "Post", status: "posted",
    hook: "Most programs fail before week one. These three questions fix that.",
    rationale: "Framework posts are saved often. Your last two how-to posts earned 2.2k and 2.3k impressions." },
  { key: "play-jordan", weekOffset: 0, title: "How one guard went from 61 to 74 percent at the line in 8 weeks", type: "athlete win", pillarId: "p2", format: "Video Script", status: "transformed", transcriptId: "tr-jordan",
    hook: "61 to 74 percent. Here is how one guard got there.",
    rationale: "Number hooks on video earned 1.5x the impressions of question hooks, and athlete wins convert followers best." },
  { key: "play-sameprogram", weekOffset: 0, title: "Why we stopped giving every athlete the same program", type: "contrarian take", pillarId: "p1", format: "Article", status: "recorded", transcriptId: "tr-sameprogram",
    hook: "We stopped giving every athlete the same program and injuries dropped.",
    rationale: "Contrarian titles on articles beat how-to titles by about 15 percent in impressions." },
  { key: "play-assistant", weekOffset: 0, title: "My first assistant coach hire: what I got wrong", type: "founder story", pillarId: "p3", format: "Post", status: "scheduled", transcriptId: "tr-assistant",
    hook: "My first assistant coach hire was a mistake. It was my mistake, not his.",
    rationale: "Founder stories convert about 1.8x more followers per 1,000 impressions than frameworks." },
  { key: "play-sixweek", weekOffset: 0, title: "The 6 week basketball program that added 3.5 inches to a vertical", type: "program", pillarId: "p4", format: "Article", status: "suggested",
    hook: "A 6 week basketball program that added 3.5 inches to a vertical, and the one rule that kept everyone healthy.",
    rationale: "Your week 4 fatigue content is your strongest topic. A full program extends it into something saveable that coaches can copy." },
  // Last week (measured)
  { key: "play-w8-a", weekOffset: -1, title: "Five words that kill a practice", type: "contrarian take", pillarId: "p1", format: "Video Script", status: "measured", entryTitle: "Five words that kill a practice",
    hook: "Five words that kill a practice.", rationale: "Builds on the best end of practice video from week 6." },
  { key: "play-w8-b", weekOffset: -1, title: "What training load actually measures", type: "program", pillarId: "p4", format: "Post", status: "measured", entryTitle: "What training load actually measures",
    hook: "Training load is a feeling before it is a number.", rationale: "Definition posts make your frameworks easier to cite." },
  { key: "play-w8-c", weekOffset: -1, title: "Training is a promise, not a schedule", type: "contrarian take", pillarId: "p1", format: "Article", status: "measured", entryTitle: "Training is a promise, not a schedule",
    hook: "Training is a promise, not a schedule.", rationale: "Core belief of the brand, written for the first time." },
  { key: "play-w8-d", weekOffset: -1, title: "Our one rule for the first week of a season", type: "founder story", pillarId: "p3", format: "Post", status: "measured", entryTitle: "Our one rule for the first week of a season",
    hook: "We have one rule for week one.", rationale: "Short operating rules tend to be shared." },
  // Two weeks ago (measured)
  { key: "play-w7-a", weekOffset: -2, title: "Why I stopped asking players if they feel good", type: "contrarian take", pillarId: "p1", format: "Video Script", status: "measured", entryTitle: "Why I stopped asking players if they feel good",
    hook: "I stopped asking players if they feel good.", rationale: "Fatigue content outperforms all other topics." },
  { key: "play-w7-b", weekOffset: -2, title: "The best athlete is not always the best trainee", type: "program", pillarId: "p4", format: "Post", status: "measured", entryTitle: "The best athlete is not always the best trainee",
    hook: "The best athlete is not always the best trainee.", rationale: "Coaches and parents both engage with this idea." },
  { key: "play-w7-c", weekOffset: -2, title: "How to read game film for training clues", type: "how-to", pillarId: "p4", format: "Article", status: "measured", entryTitle: "How to read game film for training clues",
    hook: "Your game film already tells you what to train.", rationale: "Niche tactical content gets strong saves." },
  { key: "play-w7-d", weekOffset: -2, title: "The day I almost quit coaching", type: "founder story", pillarId: "p3", format: "Post", status: "measured", entryTitle: "The day I almost quit coaching",
    hook: "The day I almost quit coaching.", rationale: "Personal stories convert followers well." },
];

export const GUIDED_PLAY_KEY_FOR_TOUR = "play-sixweek";

export interface SeedExperiment {
  id: string; playKey?: string; status: "running" | "concluded"; daysAgo: number;
  hypothesis: string; variantA: string; variantB: string; metric: string;
  resultA?: number; resultB?: number; winner?: "A" | "B"; learning?: string;
}

export const SEED_EXPERIMENTS: SeedExperiment[] = [
  { id: "exp-hook", status: "concluded", daysAgo: 24, playKey: "play-w8-a",
    hypothesis: "Opening a video script with a number will earn more impressions than opening with a question.",
    variantA: "Question hook: \"What is the free throw mistake everyone makes?\" (60 seconds: the free throw mistake everyone makes)",
    variantB: "Number hook: \"58 to 71 percent. I changed the last 10 minutes of practice.\" (From 58 to 71 percent at the line)",
    metric: "Impressions", resultA: 2900, resultB: 4300, winner: "B",
    learning: "The number hook earned 48 percent more impressions and 42 percent more followers. Lead video scripts with a specific before and after number." },
  { id: "exp-title", status: "concluded", daysAgo: 14,
    hypothesis: "A contrarian article title will beat a how-to title for impressions.",
    variantA: "How-to title: \"A simple model for load, recovery and game days\"",
    variantB: "Contrarian title: \"Basketball training is not a workout problem\"",
    metric: "Impressions", resultA: 2350, resultB: 2700, winner: "B",
    learning: "The contrarian title earned 15 percent more impressions. Keep how-to content for posts, use contrarian titles for articles." },
  { id: "exp-jordan", status: "running", daysAgo: 1, playKey: "play-jordan",
    hypothesis: "A result hook will beat a story hook on the Jordan free throw video.",
    variantA: "Result hook: \"61 to 74 percent. Here is how one guard got there.\"",
    variantB: "Story hook: \"A coach told me his best guard never missed a free throw in practice.\"",
    metric: "Impressions", },
];

function avg(a: number[]) { return a.reduce((x, y) => x + y, 0) / a.length; }
const byFmt = (f: string) => SEED_ENTRIES.filter(e => e.format === f);
const vid = avg(byFmt("Video Script").map(e => e.impressions));
const post = avg(byFmt("Post").map(e => e.impressions));
const eng = avg(SEED_ENTRIES.map(e => e.engagementRate));
const postEng = avg(byFmt("Post").map(e => e.engagementRate));

// Insights computed from the data so the numbers always match Results.
export const SEED_INSIGHTS = [
  { id: "ins-1", kind: "recommendation", daysAgo: 7, applied: true,
    text: `Video scripts average ${Math.round(vid).toLocaleString()} impressions, ${(vid / post).toFixed(1)}x the ${Math.round(post).toLocaleString()} average for posts. Move to 2 video scripts a week.`,
    evidence: { videoAvg: Math.round(vid), postAvg: Math.round(post) } },
  { id: "ins-2", kind: "pattern", daysAgo: 6, applied: false,
    text: "Videos that open with a specific number average about 4,700 impressions. Videos that open with a question or a greeting average about 2,150.",
    evidence: { numberHooks: [3300, 4300, 5900, 5200], other: [2900, 1400] } },
  { id: "ins-3", kind: "warning", daysAgo: 4, applied: false,
    text: `Average engagement rate is ${eng.toFixed(1)}% against a 4.5% target. Posts are the drag at ${postEng.toFixed(1)}%. Cut bullet lists and end every post with one direct question.`,
    evidence: { avgEngagement: Number(eng.toFixed(2)), target: 4.5 } },
  { id: "ins-4", kind: "recommendation", daysAgo: 3, applied: false,
    text: "Athlete wins and founder stories gain the most followers per 1,000 impressions (about 24 versus 14 for programs). Raise athlete wins from 20 to 25 percent of the plan.",
    evidence: { athleteWinPlan: 25 } },
  { id: "ins-5", kind: "pattern", daysAgo: 2, applied: false,
    text: "Concrete moments from practice are your strongest topic. Four of your five best performers are about a specific practice moment, like a tired player or a missed free throw.",
    evidence: { topTopic: "practice moments" } },
  { id: "ins-6", kind: "warning", daysAgo: 29, applied: true,
    text: `Videos that start with 'So today' lose viewers in the first 3 seconds. The week 5 video earned 1,400 impressions against a ${Math.round(vid).toLocaleString()} average.`,
    evidence: { weakOpen: "So today" } },
];
