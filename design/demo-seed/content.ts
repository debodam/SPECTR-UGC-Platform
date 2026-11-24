// Recordings, generated content, guided prompts and the scripted sample recording for the demo tour.
import type { Format } from "./results";

export interface SeedTranscript { id: string; daysAgo: number; hour: number; durationSeconds: number; text: string; }

export const SEED_TRANSCRIPTS: SeedTranscript[] = [
  {
    id: "tr-jordan", daysAgo: 2, hour: 15,
    durationSeconds: 187,
    text: "I want to talk about Jordan at Eastgate High because he is the cleanest example we have. He is a junior guard, great in drills, and he was shooting sixty one percent from the free throw line in games. That is the number from his last twelve games. His coach was honest with us. He said the kid never misses in practice, he misses when it matters. So we did three things. First, we looked at game film and found that every miss came in the last four minutes of a quarter, when he was tired. Second, we moved his free throws to the end of practice, after conditioning, so he was practicing the shot in the exact state he would be in during a game. Third, and this is the part I'm proudest of, we told both of them when his fatigue score spiked. Not just the coach, Jordan too, so he learned what tired feels like before it showed up in his shot. After eight weeks he was at seventy four percent. Not sixty one. Seventy four. And the coach started using the same setup for the whole roster. It's not magic. It's just refusing to practice the shot rested when you have to make it tired.",
  },
  {
    id: "tr-sameprogram", daysAgo: 3, hour: 10, durationSeconds: 96,
    text: "We stopped giving every athlete the same program last season and I know that sounds like an obvious thing to say. But walk into most teams and there is one sheet on the wall. Twelve players, one workout. The problem is the point guard who plays thirty four minutes and the big who plays eight are not recovering the same way, and they are not trying to get the same thing out of the week. One of our players was completing every session perfectly and getting slower. So we replaced the shared sheet with one question per athlete. What is the one thing that has to be true by the end of this block for you to say it worked? Then the week is built around that. It's messier for the coach, honestly. Every plan looks different. But injuries dropped and nobody has asked for the sheet back.",
  },
  {
    id: "tr-quiet", daysAgo: 5, hour: 9, durationSeconds: 142,
    text: "Okay so something I keep noticing across teams. There's this moment around week four where a player just goes quiet. Preseason was great, everyone was fired up, they hit their numbers and then nothing. Shorter answers, late to warmups, less talking on the bench. And the instinct is to give a pep talk, call it an attitude problem, and that never works. What actually works is looking at what they were supposed to recover from by the end of week three. Almost every time it's the same thing. The player who is quiet is not unmotivated, they are carrying fatigue nobody is tracking. So we started flagging it automatically. If leg heaviness is a four or five two days in a row, the coach gets a message. And honestly the answer is usually a player who has been playing through it and did not want to say. So the lesson is, quiet is a signal, not an attitude. You don't push the player harder, you adjust the week.",
  },
  {
    id: "tr-assistant", daysAgo: 6, hour: 17, durationSeconds: 74,
    text: "The first assistant coach I hired was a mistake and it was my mistake, not his. I hired for his playing resume. What we needed was somebody who could work with no playbook and no equipment and be fine with that. He was great at running a program that already existed and we didn't have one yet. It took us four months to see it. What I'd do now is give candidates a messy real practice situation on the first call and watch what they do with it. Not a clean drill sheet. A real one, with eight players showing up instead of twelve.",
  },
  {
    id: "tr-parent", daysAgo: 13, hour: 14, durationSeconds: 89,
    text: "Quick notes after the call with the parent whose son left the program. They never said the training was bad. They said it never felt finished. We built the plan, we ran the sessions, and then nobody ever showed the kid a result he could point to. That's the pattern. Players don't leave because the workouts are hard. They leave because they can't see a win. So the first six weeks have to produce one number the player can tell his teammates about. Not a dashboard. A number. Vertical, free throw percentage, sprint time. One number.",
  },
  {
    id: "tr-film", daysAgo: 19, hour: 11, durationSeconds: 101,
    text: "Our first meeting with a new team has no slides and I'm not going back. We used to open with the company story, the tech, the roadmap. Now we open by asking the coach to tell us about the last player they were worried about. Then we build that player's week live from what they say. Coaches lean in. By minute ten they are correcting the plan, which means they are already imagining using it. The close rate on those meetings is almost double. The lesson I keep relearning is that people trust the thing they helped shape.",
  },
  {
    id: "tr-endpractice", daysAgo: 27, hour: 16, durationSeconds: 118,
    text: "Here's the practice mistake I made for a year. I would run a great session, lots of energy, and then end it with, good work, see you tomorrow. That sentence is where improvement goes to die. Players leave without knowing what they are building toward. What you should end with is one number and one reason. Free throws, ten in a row under fatigue, because that is what the fourth quarter asks for. And then you write it where they can see it before they leave. We started doing that and our attendance on optional sessions went from about fifty percent to sixty eight. All we changed was the last two minutes of practice.",
  },
];

export interface SeedGeneration { id: string; transcriptId?: string; playKey?: string; format: Format; daysAgo: number; hour: number; title: string; content: string; }

export const SEED_GENERATIONS: SeedGeneration[] = [
  // Jordan set (Video, Article, Posts)
  {
    id: "gen-jordan-article", transcriptId: "tr-jordan", playKey: "play-jordan", format: "Article", daysAgo: 2, hour: 15,
    title: "How one guard went from 61 to 74 percent at the free throw line in 8 weeks",
    content: `# How one guard went from 61 to 74 percent at the free throw line in 8 weeks

Jordan is a junior guard at Eastgate High. In practice he almost never missed a free throw. In games he was shooting 61 percent over his last twelve. His coach said something I keep coming back to: "He never misses in practice. He misses when it matters."

That gap between practice and games is where most shooting work quietly fails. Here is what we changed.

## 1. We started from game film, not the practice gym

Practice numbers told us nothing, because he was fine in practice. Film told us everything. Every miss came in the last four minutes of a quarter, when he was tired.

## 2. We moved the free throws to the end of practice

Instead of shooting free throws fresh at the start, Jordan shot them after conditioning, with a raised heart rate and heavy legs. That is the state he is in during a real game, so that is the state we trained the shot in.

## 3. We told both sides when fatigue spiked

Most tools alert only the coach. We alert the coach and the athlete at the same time, with the same message and one clear question: what does tired feel like right now? Jordan learned to recognize fatigue before it showed up in his shot.

## The result

After eight weeks, Jordan was at 74 percent from the line. The more interesting change was what happened next. His coach adopted the same setup for the whole roster, because the idea was simple enough to copy.

## What I would tell another coach

Do not practice the shot rested if you have to make it tired. Find the exact moment in the game where the skill breaks, and train that moment.

If you want the practice template we used with Jordan, send me a message and I will share it.`,
  },
  {
    id: "gen-jordan-posts", transcriptId: "tr-jordan", playKey: "play-jordan", format: "Post", daysAgo: 2, hour: 15,
    title: "Jordan free throw LinkedIn posts (3 options)",
    content: `OPTION 1 (number hook)
61 percent to 74 percent.

That is how much better one high school guard got at the free throw line in 8 weeks after we changed one thing about practice.

We stopped shooting free throws fresh and started shooting them tired.

His coach put it best: "He never misses in practice. He misses when it matters."

When in your practice do your players practice the shot the way they will have to make it?

OPTION 2 (story hook)
A coach told me his best guard never missed a free throw in practice.

In games he was at 61 percent.

So we watched the film, found every miss came in the last four minutes of a quarter, and moved his free throws to the end of practice, after conditioning.

Eight weeks later: 74 percent.

The biggest change was not the number. It was that the whole roster started shooting tired.

OPTION 3 (lesson hook)
Practice is not a rehearsal for rest. It is a rehearsal for the fourth quarter.

At Eastgate High we moved free throws from the start of practice to the end.

Then we told both the coach and the player the moment fatigue spiked.

61 percent became 74 in 8 weeks.

If your players practice the shot rested, they are training for a game that does not exist.`,
  },
  {
    id: "gen-jordan-video", transcriptId: "tr-jordan", playKey: "play-jordan", format: "Video Script", daysAgo: 2, hour: 15,
    title: "Jordan 60 second video script",
    content: `HOOK (0 to 3s, on court)
"61 to 74 percent. Here is how one guard got there."

SETUP (3 to 15s)
"Jordan never missed a free throw in practice. In games he was at 61 percent."

BEAT 1 (15 to 28s)
"First, we watched film. Every miss came in the last four minutes of a quarter, when he was tired."

BEAT 2 (28 to 42s)
"Second, we moved his free throws to the end of practice, after conditioning. Same shot, game conditions."

BEAT 3 (42 to 52s)
"Third, when fatigue spiked we told the coach and Jordan at the same time."

PAYOFF (52 to 58s)
"Eight weeks later: 74 percent. And his coach moved the whole roster to the same setup."

CTA (58 to 60s)
"Follow for one training lesson a week."

ON SCREEN TEXT
61% > 74% | Shoot it tired | Tell both sides

B-ROLL IDEAS
Free throws after a suicide sprint, a whiteboard with the last four minutes circled, a simple before and after bar.`,
  },
  // Same program article
  {
    id: "gen-sameprogram-article", transcriptId: "tr-sameprogram", playKey: "play-sameprogram", format: "Article", daysAgo: 3, hour: 10,
    title: "Why we stopped giving every athlete the same program",
    content: `# Why we stopped giving every athlete the same program

Last season we stopped handing every athlete the same program. Walk into most teams and you will see it: one sheet on the wall, twelve players, one workout.

The problem is that a shared sheet measures attendance, not progress.

## The player who did everything right

One player finished every session on the sheet. On paper, a perfect block. Three weeks later he was slower than when he started. He had done everything we asked and gotten the opposite of what he needed.

## What we do instead

We ask one question at the start of every block: "What is the one thing that has to be true by the end of this block for you to say it worked?"

Then we write the answer at the top of that athlete's week, and every session has to point at it. If a session does not move that answer forward, it waits.

## What got harder

Every plan now looks different. It is harder for a coach to run and harder to compare athletes. That is a real cost and we feel it.

## What got better

Soft tissue injuries dropped. Players stopped describing training as homework. And nobody has asked for the sheet back.

## The test I would run

Pick your five most recent players. Ask each one what has to be true by the end of the block. If the program on the wall does not mention that answer anywhere, it is measuring your schedule, not their progress.`,
  },
  // Quiet player post and video
  {
    id: "gen-quiet-post", transcriptId: "tr-quiet", format: "Post", daysAgo: 5, hour: 9,
    title: "Quiet is a signal, not an attitude",
    content: `Around week 4, many players go quiet.

Preseason was great. They hit their numbers. Then shorter answers, late to warmups, less talking.

The instinct is a pep talk. It almost never works.

What works is looking at what they were supposed to recover from by the end of week 3. In most cases the player is carrying fatigue nobody is tracking, and did not want to say.

So now, if leg heaviness is a 4 or 5 two days in a row, the coach gets a message.

The answer is usually a player who has been playing through it.

Quiet is a signal, not an attitude. Do not push harder. Adjust the week.`,
  },
  {
    id: "gen-quiet-video", transcriptId: "tr-quiet", format: "Video Script", daysAgo: 6, hour: 12,
    title: "The player who went quiet in week 4",
    content: `HOOK (0 to 3s)
"Your player did not go quiet because he lost motivation."

SETUP (3 to 14s)
"Week 4. Great preseason. Hit every number. And then nothing. Short answers. Late to warmups."

BEAT 1 (14 to 28s)
"Do not give a pep talk. Look at what he was supposed to recover from by the end of week 3."

BEAT 2 (28 to 42s)
"Nine times out of ten, he is carrying fatigue nobody is tracking."

PAYOFF (42 to 55s)
"So we ask one question: how heavy do your legs feel? The answer is usually a player who has been playing through it."

CTA (55 to 60s)
"Quiet is a signal. Adjust the week."`,
  },
  // Assistant coach post
  {
    id: "gen-assistant-post", transcriptId: "tr-assistant", playKey: "play-assistant", format: "Post", daysAgo: 6, hour: 17,
    title: "My first assistant coach hire: what I got wrong",
    content: `My first assistant coach hire was a mistake. It was my mistake, not his.

I hired for his playing resume. What we needed was someone who could work with no playbook, no equipment and no existing program, and be fine with that.

He was excellent at running a program that already existed. We did not have one.

It took us four months to see it.

What I would do now: on the first call, give the candidate a messy, real practice situation. Not a clean drill sheet. A real one, with eight players instead of twelve.

Then watch what they do with it.

You learn more in 15 minutes than in three rounds of interviews.`,
  },
  // End of practice video (older)
  {
    id: "gen-endpractice-video", transcriptId: "tr-endpractice", format: "Video Script", daysAgo: 27, hour: 16,
    title: "The last two minutes of practice",
    content: `HOOK (0 to 3s)
"50 percent to 68 percent. I changed the last two minutes of practice."

BEAT 1 (3 to 18s)
"For a year I ended every practice with: good work, see you tomorrow."

BEAT 2 (18 to 32s)
"That sentence is where improvement goes to die. Players leave without knowing what they are building toward."

BEAT 3 (32 to 48s)
"Now I end with one number and one reason. Ten free throws in a row, tired, because that is what the fourth quarter asks for."

PAYOFF (48 to 58s)
"Optional session attendance went from about 50 percent to 68."

CTA (58 to 60s)
"End with a number and a reason."`,
  },
];

// Prewritten outputs for the tutorial play (never fails, no network needed).
export const TOUR_PLAY = {
  playKey: "play-sixweek",
  title: "The 6 week basketball program that added 3.5 inches to a vertical",
  sampleRecording: {
    durationSeconds: 58,
    // Streamed into the live transcript. delayMs is the wait before each chunk appears.
    chunks: [
      { delayMs: 700, text: "Okay so here's my six week basketball training program." },
      { delayMs: 1400, text: " Fourteen guards ran it, and the average vertical went up three and a half inches." },
      { delayMs: 1600, text: " Weeks one and two are about landing. Teaching players to absorb force before we ask them to produce it." },
      { delayMs: 1300, text: " Weeks three and four, we add heavy lower body strength, two days a week, nothing fancy." },
      { delayMs: 1300, text: " Week five is the jump week. Short, fast, low volume, lots of rest between sets." },
      { delayMs: 1700, text: " Week six is the test, and a deload. The legs feel fresh and the number shows up." },
      { delayMs: 1800, text: " The one rule: nobody trains hard two days in a row on the same legs. Fatigue hides in week four, and that is where most programs fall apart." },
      { delayMs: 2000, text: " So we check how heavy the legs feel every morning, and if it's a four or five twice in a row, we change the week." },
    ],
  },
  outputs: {
    Article: `# The 6 week basketball program that added 3.5 inches to a vertical

Most vertical jump programs are a list of exercises. Ours is a sequence, and the order is the whole point.

We ran this with 14 high school guards. Average vertical jump went up 3.5 inches in six weeks, and nobody missed practice with a soft tissue injury.

## Weeks 1 and 2: Learn to land
Before you ask a player to produce force, teach them to absorb it. Landing drills, tempo squats and single leg work. It feels too easy. That is the point.

## Weeks 3 and 4: Build the base
Heavy lower body strength twice a week. Simple lifts, progressive load, no heroics. This is where the real gains come from.

## Week 5: Jump week
Short, fast, low volume. Lots of rest between sets. Quality over everything.

## Week 6: Deload and test
Legs are fresh, the number shows up. Test on the same day, at the same time, with the same warmup.

## The one rule that kept everyone healthy
Nobody trains hard two days in a row on the same legs. And every morning, players rate how heavy their legs feel from 1 to 5.

## What to do when the legs say 4 or 5 twice in a row
Do not push through. Cut the next session in half and move the heavy day back one. Fatigue shows up in week 4 and it is the moment most programs quietly fall apart.

A program is not a list of exercises. It is a sequence with an off switch.`,
    Post: `OPTION 1
Most vertical jump programs are a list of exercises.

Ours is a sequence:

1. Weeks 1 and 2: learn to land
2. Weeks 3 and 4: build the base
3. Week 5: jump week
4. Week 6: deload and test

14 guards. Average vertical up 3.5 inches. Nobody missed practice with a soft tissue injury.

What week does your program start to fall apart?

OPTION 2
Fatigue hides in week 4.

Players still hit their numbers. They get quiet. Legs feel heavy and nobody says anything.

Our rule: if leg heaviness is a 4 or 5 two days in a row, the next session gets cut in half.

That one rule kept 14 guards healthy through a 6 week jump program.

OPTION 3
The best jump program we ran started with landing.

Not jumping. Landing.

Two weeks of absorbing force before we asked anyone to produce it.

Result across 14 guards: 3.5 inches added in 6 weeks.`,
    "Video Script": `HOOK (0 to 3s)
"3.5 inches in six weeks. Here is the program."

BEAT 1 (3 to 20s)
"Weeks one and two, learn to land. Weeks three and four, heavy lower body strength twice a week. Week five, jump week. Short, fast, lots of rest."

BEAT 2 (20 to 38s)
"Week six is a deload and the test. Legs are fresh and the number shows up."

PAYOFF (38 to 55s)
"One rule: nobody trains hard two days in a row on the same legs. If leg heaviness is a four or five twice, cut the next session in half."

CTA (55 to 60s)
"Follow for one training lesson a week."`,
  },
  refineExample: {
    instruction: "Make the post shorter and add a question at the end",
    result: `Most vertical programs are a list of exercises.

Ours is a sequence:
1. Learn to land
2. Build the base
3. Jump week
4. Deload and test

14 guards. 3.5 inches. No soft tissue injuries.

What week does your program fall apart?`,
  },
};

// Guided prompts shown in Record when a play is started.
export const GUIDED_PROMPTS: Record<string, string[]> = {
  "play-sixweek": [
    "What does week one of your program look like and why do you start there?",
    "What is the one rule that keeps players healthy?",
    "What do you change the moment a player's legs feel heavy?",
  ],
  "play-jordan": [
    "What was the athlete's starting point and why did it hurt?",
    "What exactly did you change, in order?",
    "What was the result, in numbers, and what surprised you?",
  ],
  "play-sameprogram": [
    "Why did the shared program stop working?",
    "What do you ask every athlete now instead?",
    "What got harder after the change, honestly?",
  ],
  "play-assistant": [
    "What did you get wrong in the first hire?",
    "What would you look for now?",
    "What is the first interview exercise you would run?",
  ],
  "play-three-questions": [
    "What three questions do you ask before writing any program?",
    "What happened the last time you skipped one of them?",
  ],
};
