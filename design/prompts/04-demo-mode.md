# Step 4: Build the guided demo for recruiters

Work autonomously, no questions. One commit per stage on the current branch, never push. UI follows /design/DESIGN.md. No em dashes in any copy.

## Context
SPECTR is a portfolio and interview project. A recruiter or interviewer should be able to open a link, be guided through the whole product like a tutorial, and understand my product thinking in about 4 minutes. No signup, no access code, no real accounts.

## Entry points
- Route /demo that starts the demo directly (for my resume and LinkedIn).
- On the landing page, a "Try the demo" button next to the access code box.

## Sandbox
- The demo runs in an isolated sandbox that never touches real data. Use client side state (persisted in sessionStorage, reset on each new demo start) or a separate in memory data layer behind the same data hooks the real app uses, so the real components render in demo mode. Add a DemoProvider and a data adapter switch. No Supabase writes in demo mode.
- Seed data is already written in /design/demo-seed (Rampwise, a fictional AI onboarding startup). Read /design/demo-seed/README.md first. Copy the files into the app (for example src/demo/seed) and use buildDemoSeed(new Date()) as the single source for the sandbox. Do not invent new data. It covers the workspace, 32 results entries, the Distribute queue, 7 recordings with transcripts, generated content, the Growth plan, plays in every status, experiments and insights. If a screen needs data that is missing, add it in the same style and keep it consistent with the totals in the README.
- Generation in demo: use the prewritten outputs in content.ts (TOUR_PLAY.outputs for the tutorial play, SEED_GENERATIONS for existing plays) so Transform is instant and never fails. Add a "Try your own topic" option that makes one real live generation if the server key is available, capped to 3 per session with graceful fallback to cached output.
- Record in demo: a "Use sample recording" button streams TOUR_PLAY.sampleRecording.chunks into the live transcript with those delays and drives the orb animation. A real microphone is optional.
- Disabled in demo with a friendly tooltip ("Disabled in demo"): account settings changes, delete workspace, real posting actions that need an external account. Everything else works.

## Guided tutorial (the core of this step)
Build a tour engine (use a small library such as driver.js or build a custom one) with a dimmed overlay and a spotlight cutout around the target element, a tooltip card in the glass style with title, short copy, Next, Back and Skip tour, a progress indicator ("Step 3 of 9"), keyboard support (Enter, Escape, arrow keys) and focus management. The user can only click the highlighted element or Next, so they are guided, and each step advances automatically when they complete the action.

Steps (adjust as needed to the real UI):
1. Welcome: what SPECTR is in one sentence, how long this takes, Start button.
2. Dashboard growth plan card: explain the north star metric and the forecast, then click View full growth plan.
2b. Growth Plan page: briefly tour pillars, cadence and this week's plays, then continue.
3. This week's plays: highlight a play card, explain hook and rationale, user clicks Start play.
4. Record: explain the guided prompts, user clicks Use sample recording, watch the orb react and the transcript stream, user clicks Stop.
5. Transform: user clicks Generate, see article, posts and video script, explain refine.
6. Distribute: show the posting queue, explain why it uses a ready to post flow, user clicks Copy post and Mark as posted.
7. Results: show logged numbers, format intelligence and the experiment compare.
8. Insight and plan update: show an insight, click Apply, watch the plan change and the forecast move.
9. Finish: recap the loop in 3 lines, then show the closing screen described below.

Rules: the tour must work at 1280x720 and up, never block with overlapping elements, handle route changes between steps, and recover if the user navigates away (a "Resume tour" chip). A "Replay tour" button stays available in the demo banner.

## Demo chrome
- A slim banner: "Demo mode. Nothing here is saved." with Replay tour and Exit demo (returns to landing).
- Closing screen: after the last tour step, show a centered glass card with a short, confident message: the demo used fictional data for a made up company called Rampwise, and nothing was saved. Include a primary button "See what else I've built" that opens https://debodam.com in a new tab, and secondary buttons "Replay the tour" and "Exit demo". Keep the copy plain, with no em dashes. No other recruiter panel, case study or stats anywhere.
- Also add a small, always visible footer link in the demo banner: "Built by Debojeet Dam" linking to https://debodam.com.
- Optional lightweight event log to the console or a local object (demo started, step reached, completed, panel opened), no external analytics.

## Quality
- Demo must work on first load with no network except fonts, and never show an error. If live generation fails, silently use cached output.
- Typecheck, lint and build pass. Playwright script runs the entire tour at 1440x900 and 1280x720, clicking through every step and screenshotting each. Fix anything that overlaps, misaligns or gets stuck.
- Make sure demo mode cannot leak into the real app and the real app has no demo code paths active.

## Final report
What you built, where to edit seed data, copy and links, decisions made, anything incomplete.
