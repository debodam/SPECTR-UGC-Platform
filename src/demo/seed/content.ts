// Recordings, generated content, guided prompts and the scripted sample recording for the demo tour.
import type { Format } from "./results";

export interface SeedTranscript {
  id: string;
  daysAgo: number;
  hour: number;
  durationSeconds: number;
  text: string;
}

export const SEED_TRANSCRIPTS: SeedTranscript[] = [
  {
    id: "tr-cobalt",
    daysAgo: 2,
    hour: 15,
    durationSeconds: 187,
    text: "I want to talk about Cobalt Ledger because it's the cleanest example we have. When they signed, their average time to first value was forty one days. That's the number from their last three cohorts. Their VP of customer success, Priya, was honest with us. She said we lose people in the gap between the contract and the first real use. So we did three things. First, we read the contract and the kickoff recording and pulled out what each customer actually bought it for, not what the sales deck said. Second, we built the thirty day plan around that one outcome. Third, and this is the part I'm proudest of, we told both sides when something stalled. Not just the CSM, the customer champion too. After eight weeks the average time to first value was nineteen days. Not forty one. Nineteen. And their renewal conversations changed, because customers were already seeing results before anyone asked. It's not magic. It's just refusing to treat onboarding as a checklist and treating it as a promise.",
  },
  {
    id: "tr-checklist",
    daysAgo: 3,
    hour: 10,
    durationSeconds: 96,
    text: "We deleted our onboarding checklist last quarter and I know that sounds insane. Every CS team I know has one. Twelve steps, a nice progress bar. The problem is customers would complete eleven steps and still not get value, because the checklist measured activity, not outcomes. One customer had a hundred percent complete and had never sent a single real record through the product. So we replaced it with one question per customer. What is the one thing that has to be true for you to say this was worth it? Then everything in the first thirty days points at that. It's messier for us, honestly. Every plan looks different. But time to first value dropped and nobody has asked for the checklist back.",
  },
  {
    id: "tr-silence",
    daysAgo: 5,
    hour: 9,
    durationSeconds: 142,
    text: "Okay so something I keep noticing across our customers. There's this moment around day nine where the customer just goes quiet. Kickoff was great, everyone was excited, they've got their admin set up and then nothing. No logins, no replies to the CSM. And the instinct is to send a check-in email, just circling back, and that never works. What actually works is looking at what they were supposed to do by day seven. Almost every time it's the same thing. The person who bought it is not the person who has to do the work. So the admin is sitting there waiting for a decision from someone above them. We started flagging that automatically. If the integration step isn't done by day seven we ask who owns the approval. And honestly the answer is usually a name nobody mentioned in the kickoff. So the lesson is, silence is a signal, not a mood. You don't nudge the customer harder, you find the missing person.",
  },
  {
    id: "tr-cshire",
    daysAgo: 6,
    hour: 17,
    durationSeconds: 74,
    text: "The first customer success hire I made was a mistake and it was my mistake, not hers. I hired for experience at big companies. What we needed was somebody who could work with no playbook and no tooling and be fine with that. She was great at running a machine and we didn't have a machine. It took us four months to see it. What I'd do now is give candidates a messy real customer situation on the first call and watch what they do with it. Not a case study with clean data. A real, slightly broken one.",
  },
  {
    id: "tr-churn",
    daysAgo: 13,
    hour: 14,
    durationSeconds: 89,
    text: "Quick notes after the call with the customer that churned. They never said the product was bad. They said it never felt finished. We set up the integration, we trained the admin, and then nobody on their side ever saw a result they could show their boss. That's the pattern. People don't leave because of missing features. They leave because they can't point to a win. So the first thirty days have to produce one number the champion can forward to their manager. Not a dashboard. A number.",
  },
  {
    id: "tr-demo",
    daysAgo: 19,
    hour: 11,
    durationSeconds: 101,
    text: "Our demo has no slides and I'm not going back. We used to open with the company story, the market, the problem. Now we open by asking the prospect to tell us about the last customer they were nervous about onboarding. Then we build the plan live from what they say. People lean in. By minute ten they are correcting the plan, which means they are already imagining using it. The close rate on those demos is almost double. The lesson I keep relearning is that people trust the thing they helped shape.",
  },
  {
    id: "tr-kickoff",
    daysAgo: 27,
    hour: 16,
    durationSeconds: 118,
    text: "Here's the kickoff mistake I made for a year. I would run a really good kickoff call, lots of energy, and then end it with, let me know if you have any questions. That sentence is where onboarding goes to die. Nobody has questions at the end of a kickoff because they haven't touched the product yet. What you should end with is a date and a name. By Thursday, Sam connects the data source. And then you put it on the calendar before you hang up. We started doing that and our day seven activation went from about fifty percent to sixty eight. All we changed was the last two minutes of the call.",
  },
];

export interface SeedGeneration {
  id: string;
  transcriptId?: string;
  playKey?: string;
  format: Format;
  daysAgo: number;
  hour: number;
  title: string;
  content: string;
}

export const SEED_GENERATIONS: SeedGeneration[] = [
  // Cobalt Ledger set (Video, Article, Posts)
  {
    id: "gen-cobalt-article",
    transcriptId: "tr-cobalt",
    playKey: "play-cobalt",
    format: "Article",
    daysAgo: 2,
    hour: 15,
    title: "How Cobalt Ledger cut time to first value from 41 days to 19",
    content: `# How Cobalt Ledger cut time to first value from 41 days to 19

When Cobalt Ledger signed with us, their average time to first value was 41 days. That number came from their last three customer cohorts, and their VP of Customer Success, Priya, said something I keep coming back to: "We don't lose people in the product. We lose them in the gap between the contract and the first real use."

That gap is where most onboarding programs quietly fail. Here is what we changed.

## 1. We started from what the customer bought, not what we sold

Sales decks promise a lot. Contracts and kickoff calls tell you what a specific customer cares about. We read both for every new account and pulled out one outcome. Not five goals. One sentence that finishes "this was worth it if...".

## 2. We built the 30 day plan around that one outcome

Every task in the plan either moved that outcome forward or was cut. For one team, that meant skipping three standard setup steps and connecting their billing data on day two, because that was the number their CFO wanted to see.

## 3. We told both sides when something stalled

Most tools alert the customer success manager. We alert the CSM and the customer champion at the same time, with the same message and one clear question: who needs to approve the next step? In most stalls, the missing piece was a person nobody mentioned in the kickoff.

## The result

After eight weeks, average time to first value was 19 days. The more interesting change was what happened next. Renewal conversations got easier because customers had already seen a result before anyone asked for one.

## What I would tell another CS leader

Do not treat onboarding as a checklist. Treat it as a promise to deliver one specific result by a specific date, and make it obvious to both sides when that promise is at risk.

If you want to see the plan template we used with Cobalt Ledger, send me a message and I will share it.`,
  },
  {
    id: "gen-cobalt-posts",
    transcriptId: "tr-cobalt",
    playKey: "play-cobalt",
    format: "Post",
    daysAgo: 2,
    hour: 15,
    title: "Cobalt Ledger LinkedIn posts (3 options)",
    content: `OPTION 1 (number hook)
41 days to 19 days.

That is how much faster Cobalt Ledger reached first value after we changed one thing about onboarding.

We stopped asking "what are the 12 steps?" and started asking "what has to be true for this to feel worth it?"

Everything in the first 30 days pointed at that one answer.

Their VP of CS put it best: "We don't lose people in the product. We lose them between the contract and the first real use."

What is the one outcome your newest customer bought for?

OPTION 2 (story hook)
A VP of Customer Success told me she was losing customers before they ever used the product.

Average time to first value: 41 days.

So we read the contract and the kickoff recording for every new account, built the plan around one outcome, and alerted both the CSM and the customer when something stalled.

Eight weeks later: 19 days.

The biggest change was not speed. It was that renewal conversations started with results.

OPTION 3 (lesson hook)
Onboarding is not a checklist. It is a promise.

At Cobalt Ledger we replaced a 12 step plan with one sentence: "This was worth it if..."

Then we told both sides the moment that promise was at risk.

Time to first value went from 41 days to 19.

If your onboarding plan is the same for every customer, it is probably optimizing for your team, not theirs.`,
  },
  {
    id: "gen-cobalt-video",
    transcriptId: "tr-cobalt",
    playKey: "play-cobalt",
    format: "Video Script",
    daysAgo: 2,
    hour: 15,
    title: "Cobalt Ledger 60 second video script",
    content: `HOOK (0 to 3s, on camera)
"41 days to 19 days. Here is how one customer got there."

SETUP (3 to 15s)
"Cobalt Ledger was losing customers between signing and first use. Average time to first value: 41 days."

BEAT 1 (15 to 28s)
"First, we stopped using a checklist. We read the contract and the kickoff call and wrote one sentence: this was worth it if..."

BEAT 2 (28 to 42s)
"Second, we built the 30 day plan around only that outcome. Anything that did not move it got cut."

BEAT 3 (42 to 52s)
"Third, when something stalled, we told the CSM and the customer champion at the same time."

PAYOFF (52 to 58s)
"Eight weeks later: 19 days. And renewal talks started with results."

CTA (58 to 60s)
"Follow for one onboarding lesson a week."

ON SCREEN TEXT
41 days > 19 days | One outcome | Alert both sides

B-ROLL IDEAS
Screen capture of the 30 day plan, a calendar with a date and a name, a simple before and after bar.`,
  },
  // Checklist article
  {
    id: "gen-checklist-article",
    transcriptId: "tr-checklist",
    playKey: "play-checklist",
    format: "Article",
    daysAgo: 3,
    hour: 10,
    title: "Why we deleted our onboarding checklist",
    content: `# Why we deleted our onboarding checklist

Last quarter we deleted our onboarding checklist. Every customer success team I know has one: twelve steps, a progress bar, a satisfying green check at the end.

The problem is that a checklist measures activity, not outcomes.

## The customer who was 100 percent complete

One customer finished every step on our list. On paper, a perfect onboarding. Three weeks later we discovered they had never sent a single real record through the product. They had done everything we asked and gotten nothing they cared about.

## What we do instead

We ask one question on the first call: "What is the one thing that has to be true for you to say this was worth it?"

Then we write the answer at the top of the plan, and every task in the first 30 days has to point at it. If a task does not move that answer forward, it waits.

## What got harder

Every plan now looks different. It is harder to train new CSMs, harder to report on, and harder to compare customers. That is a real cost and we feel it.

## What got better

Time to first value dropped. Customers stopped describing onboarding as homework. And nobody has asked for the checklist back.

## The test I would run

Pick your five most recent customers. Ask each one what had to be true for this to be worth it. If your checklist does not mention that answer anywhere, it is measuring your process, not their progress.`,
  },
  // Silence post and video
  {
    id: "gen-silence-post",
    transcriptId: "tr-silence",
    format: "Post",
    daysAgo: 5,
    hour: 9,
    title: "Silence is a signal, not a mood",
    content: `Around day 9 of onboarding, many customers go quiet.

Kickoff was great. The admin is set up. Then nothing.

The instinct is to send a "just checking in" email. It almost never works.

What works is looking at what was supposed to happen by day 7. In most cases, the person who bought the product is not the person doing the work, and the admin is waiting on an approval from someone we never met.

So now, if the integration step is open at day 7, we ask one question: who owns the approval?

The answer is usually a name nobody mentioned at kickoff.

Silence is a signal, not a mood. Do not nudge harder. Find the missing person.`,
  },
  {
    id: "gen-silence-video",
    transcriptId: "tr-silence",
    format: "Video Script",
    daysAgo: 6,
    hour: 12,
    title: "The customer who went quiet on day 9",
    content: `HOOK (0 to 3s)
"Your customer did not go quiet because they are busy."

SETUP (3 to 14s)
"Day 9 of onboarding. Great kickoff. Admin is set up. And then nothing. No logins. No replies."

BEAT 1 (14 to 28s)
"Do not send a check in email. Look at what was supposed to happen by day 7."

BEAT 2 (28 to 42s)
"Nine times out of ten, the admin is waiting on an approval from someone we never met."

PAYOFF (42 to 55s)
"So we ask one question: who owns the approval? The answer is usually a name nobody mentioned in the kickoff."

CTA (55 to 60s)
"Silence is a signal. Find the missing person."`,
  },
  // CS hire post
  {
    id: "gen-cshire-post",
    transcriptId: "tr-cshire",
    playKey: "play-cshire",
    format: "Post",
    daysAgo: 6,
    hour: 17,
    title: "Our first CS hire: what I got wrong",
    content: `My first customer success hire was a mistake. It was my mistake, not hers.

I hired for big company experience. What we needed was someone who could work with no playbook, no tooling and no process, and be fine with that.

She was excellent at running a machine. We did not have a machine.

It took us four months to see it.

What I would do now: on the first call, give the candidate a messy, real customer situation. Not a clean case study. A real, slightly broken one.

Then watch what they do with it.

You learn more in 15 minutes than in three rounds of interviews.`,
  },
  // Kickoff video (older)
  {
    id: "gen-kickoff-video",
    transcriptId: "tr-kickoff",
    format: "Video Script",
    daysAgo: 27,
    hour: 16,
    title: "The last two minutes of a kickoff call",
    content: `HOOK (0 to 3s)
"50 percent to 68 percent. I changed the last two minutes of one call."

BEAT 1 (3 to 18s)
"For a year I ended every kickoff with: let me know if you have any questions."

BEAT 2 (18 to 32s)
"That sentence is where onboarding goes to die. Nobody has questions before they touch the product."

BEAT 3 (32 to 48s)
"Now I end with a date and a name. By Thursday, Sam connects the data source. Then I put it on the calendar before we hang up."

PAYOFF (48 to 58s)
"Day seven activation went from about 50 percent to 68."

CTA (58 to 60s)
"End with a date and a name."`,
  },
];

// Prewritten outputs for the tutorial play (never fails, no network needed).
export const TOUR_PLAY = {
  playKey: "play-signals",
  title: "The 5 signals a customer is about to stall",
  sampleRecording: {
    durationSeconds: 58,
    // Streamed into the live transcript. delayMs is the wait before each chunk appears.
    chunks: [
      { delayMs: 700, text: "Okay so here's what I've learned about stalled customers." },
      {
        delayMs: 1400,
        text: " Five signals, and you can see them before the customer says anything.",
      },
      { delayMs: 1600, text: " One, the admin logs in once and never again." },
      { delayMs: 1300, text: " Two, nobody has invited a second person." },
      { delayMs: 1300, text: " Three, the integration step has been open for more than a week." },
      {
        delayMs: 1700,
        text: " Four, the champion stops replying but their calendar still accepts meetings, which means they're busy, not gone.",
      },
      {
        delayMs: 1800,
        text: " And five, support tickets stop. People assume quiet means happy. Quiet usually means they've mentally moved on.",
      },
      {
        delayMs: 2000,
        text: " So we watch for two of the five at once, and when that happens the CSM reaches out to the person who signed the contract, not just the admin.",
      },
    ],
  },
  outputs: {
    Article: `# The 5 signals a customer is about to stall (and what to do in the next 24 hours)

Most customers do not announce that onboarding is failing. They go quiet. By the time a CSM notices, the best moment to help has passed.

Here are five signals we watch for, all visible in the first three weeks.

## 1. The admin logs in once and never again
One login after kickoff usually means the admin got blocked and did not know who to ask.

## 2. Nobody has invited a second person
Products that stick become team products. If the admin is still the only user at day 10, the champion has not yet found a reason to share it.

## 3. The integration step has been open for more than a week
This is the most reliable signal we have. It usually means an approval is stuck with someone we have not met.

## 4. The champion stops replying but still accepts meetings
This is a busy person, not a lost one. A short, specific message works better than a long check in.

## 5. Support tickets stop
Quiet is not the same as happy. Customers who are getting value ask questions. Customers who have moved on stop asking.

## What to do when you see two at once
Do not send a generic nudge. Contact the person who signed the contract, name the one thing that is blocked, and offer a 15 minute call this week to unblock it.

Two signals together are a pattern. One signal is noise.`,
    Post: `OPTION 1
Your customer did not go quiet because they are busy.

Five signals I watch for in the first 3 weeks:

1. The admin logs in once
2. Nobody invites a second user
3. The integration step is open for more than a week
4. The champion stops replying but still accepts meetings
5. Support tickets stop

Two at once? Do not send "just checking in." Contact whoever signed the contract and name the one thing that is blocked.

OPTION 2
Quiet does not mean happy.

When support tickets stop in the first month, we get nervous. Customers who find value ask questions. Customers who have moved on do not.

Two quiet signals at once is our trigger to call the person who signed the contract.

OPTION 3
The most reliable churn signal we have is boring.

An integration step that has been open for more than a week.

It almost always means an approval is stuck with someone we have not met. Find that person and the stall usually ends in a day.`,
    "Video Script": `HOOK (0 to 3s)
"Five signs your customer is about to stall."

BEAT 1 (3 to 20s)
"One, the admin logs in once and never comes back. Two, nobody invites a second user. Three, the integration has been open for a week."

BEAT 2 (20 to 38s)
"Four, the champion stops replying but still accepts meetings. That is busy, not gone. Five, support tickets stop. Quiet is not happy."

PAYOFF (38 to 55s)
"Two of these at once? Skip the check in email. Call whoever signed the contract and name the one thing that is blocked."

CTA (55 to 60s)
"Follow for one onboarding lesson a week."`,
  },
  refineExample: {
    instruction: "Make the post shorter and add a question at the end",
    result: `Your customer did not go quiet because they are busy.

Watch for two of these at once:
1. One login from the admin
2. No second user invited
3. Integration open for a week
4. Champion stops replying
5. Support tickets stop

Then skip "just checking in" and call whoever signed the contract.

Which of these have you seen first?`,
  },
};

// Guided prompts shown in Record when a play is started.
export const GUIDED_PROMPTS: Record<string, string[]> = {
  "play-signals": [
    "What are the first signs you notice that a customer is about to stall?",
    "Which signal has been the most reliable for you, and why?",
    "What do you do the moment you see two signals at once?",
  ],
  "play-cobalt": [
    "What was the customer's starting point and why did it hurt?",
    "What exactly did you change, in order?",
    "What was the result, in numbers, and what surprised you?",
  ],
  "play-checklist": [
    "Why did the old checklist stop working?",
    "What do you ask every customer now instead?",
    "What got harder after the change, honestly?",
  ],
  "play-cshire": [
    "What did you get wrong in the first hire?",
    "What would you look for now?",
    "What is the first interview exercise you would run?",
  ],
  "play-kickoff-questions": [
    "What three questions do you ask before every kickoff?",
    "What happened the last time you skipped one of them?",
  ],
};
