/**
 * The guided tour. Edit copy here. Each step either waits for Next, for a click on its target, or for a condition.
 * `num` is the step shown to the visitor ("Step 3 of 9"); a few steps share a number because they are one idea.
 */
export const TOUR_TOTAL = 9;

const PLAY = "demo-play-sixweek";
const DUE = '[data-queue-id="demo-queue-9"]';
const INSIGHT = '[data-insight-id="demo-ins-4"]';

export interface TourStep {
  id: string;
  num: number;
  /** Pathname the step lives on. */
  route: string;
  /** Where to send the visitor if they are not on the route (may include a query). */
  go?: string;
  /** Spotlight targets. None means a centered card. */
  targets?: string[];
  title: string;
  body: string | string[];
  /** button: wait for Next. click: advance when `click` (or the first target) is clicked. wait: advance when done(). */
  advance: "button" | "click" | "wait";
  click?: string;
  done?: () => boolean;
  nextLabel?: string;
  /** Show Next on a "wait" step, disabled until done() is true. */
  nextWhenDone?: boolean;
  /** Elements the card should not cover (important UI next to the spotlight). */
  avoid?: string[];
  /** Skip this step when it no longer applies (for example the visitor already did it). */
  skip?: () => boolean;
}

/** State of the demo's sample take, mirrored by the Record page on <html data-sample>. */
const sample = () =>
  typeof document === "undefined" ? "" : document.documentElement.dataset.sample;

export const TOUR: TourStep[] = [
  {
    id: "welcome",
    num: 1,
    route: "/",
    title: "Welcome to SPECTR",
    body: "SPECTR turns a few minutes of talking into a week of LinkedIn content, then learns from the results. This tour takes about 4 minutes and uses a made up company called Fastbreak AI, an AI coach for basketball and team athletes.",
    advance: "button",
    nextLabel: "Start the tour",
  },
  {
    id: "plan-card",
    num: 2,
    route: "/",
    targets: ['[data-tour="growth-card"]'],
    title: "Everything starts from a growth plan",
    body: "The plan has one north star metric. For Fastbreak AI it is followers from coaches, performance staff and club directors: 3,123 today against a 4,000 target. The forecast line projects the current pace to the end of the 12 weeks.",
    advance: "button",
  },
  {
    id: "open-plan",
    num: 2,
    route: "/",
    targets: ['[data-tour="view-growth"]'],
    title: "Open the full plan",
    body: "Click View full growth plan.",
    advance: "click",
  },
  {
    id: "pillars",
    num: 2,
    route: "/growth",
    targets: ['[data-tour="growth-pillars"]'],
    avoid: ['[data-tour="growth-cadence"]'],
    title: "Content pillars",
    body: "Four themes, each with a share of the plan, so the mix stays deliberate instead of random.",
    advance: "button",
  },
  {
    id: "cadence",
    num: 2,
    route: "/growth",
    targets: ['[data-tour="growth-cadence"]'],
    title: "Weekly cadence",
    body: "Five pieces a week, split by format. The split changed twice already because the results said so.",
    advance: "button",
  },
  {
    id: "play",
    num: 3,
    route: "/growth",
    targets: [`[data-play-id="${PLAY}"]`],
    click: `[data-play-id="${PLAY}"] .gh-btn--primary`,
    title: "This week's plays",
    body: "Each play is one specific piece: a hook to open with and the reason it should work for coaches, based on past results. This one is the 6 week basketball program that added 3.5 inches to a vertical. Click Start on it.",
    advance: "click",
  },
  {
    id: "prompts",
    num: 4,
    route: "/record",
    go: `/record?play=${PLAY}`,
    targets: ['[data-tour="play-banner"]'],
    title: "Guided prompts",
    body: "Starting a play opens Record with three prompts for that piece, so nobody faces a blank page.",
    advance: "button",
  },
  {
    id: "sample",
    num: 4,
    route: "/record",
    go: `/record?play=${PLAY}`,
    targets: ['[data-tour="sample-recording"]'],
    title: "Record a take",
    body: "Normally you talk for a minute. Click Use sample recording to hear a prepared 50 second take, with sound.",
    advance: "click",
  },
  {
    id: "listening",
    num: 4,
    route: "/record",
    go: `/record?play=${PLAY}`,
    targets: ['[data-tour="orb-col"]', '[data-tour="live-transcript"]'],
    title: "Listening. Watch your words appear.",
    body: "The orb follows the voice and the transcript fills in word by word as it is spoken.",
    advance: "wait",
    nextWhenDone: true,
    // Ended, or the visitor already clicked Stop.
    done: () => sample() === "ended" || sample() === "stopped",
  },
  {
    id: "stop",
    num: 4,
    route: "/record",
    go: `/record?play=${PLAY}`,
    targets: ['[data-tour="stop-recording"]'],
    avoid: ['[data-tour="record-caption"] > div:first-child'],
    title: "That is the whole take",
    body: "Click Stop to save it. It is linked to this play, then Transform opens with it.",
    advance: "click",
    skip: () => sample() === "stopped",
  },
  {
    id: "generate",
    num: 5,
    route: "/transform",
    go: `/transform?play=${PLAY}`,
    targets: ['[data-tour="generate"]'],
    avoid: ['[aria-label="Content instructions"]', '[aria-label="Source text"]'],
    title: "Generate",
    body: "The transcript and the play's hook are already filled in, and the format matches the play. Click Generate.",
    advance: "click",
  },
  {
    id: "output",
    num: 5,
    route: "/transform",
    go: `/transform?play=${PLAY}`,
    targets: ['[data-tour="output"]'],
    title: "Article, posts and video script",
    body: [
      "One take becomes all three formats in the company's voice. Switch tabs to see each one.",
      "Refine rewrites a piece from a short note, like: make it shorter and end with a question.",
    ],
    advance: "button",
    nextLabel: "Go to Distribute",
  },
  {
    id: "queue",
    num: 6,
    route: "/distribute",
    targets: [DUE],
    title: "An honest posting queue",
    body: "LinkedIn does not let tools like this post for you, so SPECTR does not pretend to. When a post is due, you copy it or open LinkedIn's composer, then mark it posted.",
    advance: "button",
  },
  {
    id: "copy",
    num: 6,
    route: "/distribute",
    targets: [DUE],
    click: `${DUE} [data-tour="copy-post"]`,
    title: "Copy the post",
    body: "Click Copy post. The text is ready to paste into LinkedIn.",
    advance: "click",
  },
  {
    id: "posted",
    num: 6,
    route: "/distribute",
    targets: [DUE],
    click: `${DUE} [data-tour="mark-posted"]`,
    title: "Mark it posted",
    body: "Click Mark as posted. The play moves forward and Results gets an entry that waits for the numbers.",
    advance: "click",
  },
  {
    id: "pending",
    num: 7,
    route: "/results",
    targets: ['[data-tour="pending-results"]'],
    title: "Waiting for numbers",
    body: "Posts from the last few days wait here until their numbers are copied in from LinkedIn analytics. It takes about 20 seconds a post.",
    advance: "button",
  },
  {
    id: "formats",
    num: 7,
    route: "/results",
    targets: ['[data-tour="format-intel"]'],
    title: "Format intelligence",
    body: "For Fastbreak AI, video scripts earn about 2.4 times the impressions of posts. This is the kind of pattern the plan learns from.",
    advance: "button",
  },
  {
    id: "experiments",
    num: 7,
    route: "/results",
    targets: ['[data-tour="experiments"]'],
    title: "Experiments",
    body: "Hooks are tested head to head. A number hook beat a question hook by 48 percent, and every video script now opens with a number.",
    advance: "button",
    nextLabel: "See the insight",
  },
  {
    id: "insight",
    num: 8,
    route: "/growth",
    targets: [INSIGHT],
    click: `${INSIGHT} button`,
    title: "Insights change the plan",
    body: "Insights are computed from the same numbers you just saw. This one says athlete wins convert followers best. Click Apply.",
    advance: "click",
  },
  {
    id: "changed",
    num: 8,
    route: "/growth",
    targets: ['[data-tour="growth-pillars"]'],
    title: "The plan updated",
    body: "Athlete wins moved from 20 to 25 percent of the plan, and the change is in the plan history. As new results are logged, the forecast moves the same way.",
    advance: "button",
  },
  {
    id: "finish",
    num: 9,
    route: "/growth",
    title: "That is the loop",
    body: [
      "Plan: a growth plan with specific plays each week.",
      "Create: record a take and turn it into every format.",
      "Learn: post it, log the numbers, and let insights reshape the plan.",
    ],
    advance: "button",
    nextLabel: "Finish",
  },
];
