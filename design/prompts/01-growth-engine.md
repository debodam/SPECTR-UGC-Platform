# Step 1: Add the Growth Engine and make it the heart of SPECTR

Work autonomously. Do not ask me questions. Make sensible decisions and list them at the end. One commit per stage on the current branch. Never push. UI follows /design/DESIGN.md and /design/source (blue glass system, SF Pro font rule, no em dashes in any copy).

## Context
SPECTR is positioned as a growth engine for startups, but today it is only a pipeline: Record, Transform, Distribute, Track. It must feel like a growth product that tells the user what to do next and why, and gets smarter from results. This is a portfolio and interview project, not a public launch. The loop is:
Goal > Strategy > This week's plays > Record > Transform > Distribute > Results > Strategy updates.

## First
Read the whole app: routes, components, Supabase schema and migrations, the existing Setup, Settings (Audience, Goals, Targets), Track (KPI cards, format intelligence, performance log) and the Anthropic SDK usage. Reuse what exists. Do not break current functionality. Write a short plan to /design/growth-plan-notes.md before coding.

## Stage 1: Data model
Add Supabase migrations (with RLS matching existing tables) for:
- growth_plans: workspace_id, north_star_metric, goal summary, pillars (jsonb: name, description, share of content), cadence per week, channels, audience summary, created_at
- plays: workspace_id, plan_id, week_start, title, type (founder story, contrarian take, customer win, build in public, launch, hiring, how-to), hook, rationale, format (article, post, video script), status (suggested, in progress, recorded, transformed, scheduled, posted, measured), linked_log_id, linked_content_id
- experiments: workspace_id, play_id, hypothesis, variant_a, variant_b, metric, result, winner, learning, status
- insights: workspace_id, text, kind (pattern, recommendation, warning), evidence (jsonb), created_at, applied boolean
Keep types in a shared TypeScript file.

## Stage 2: Growth Plan generation (built at the end of onboarding)
- The plan is built by the final button of Setup ("Build my growth plan"), never by a button on the Dashboard. Call Claude through the existing server-side pattern with the workspace's sector, audience, goals, targets and growth preferences. Return strict JSON: north star metric, 3 to 4 pillars, weekly cadence, and 4 to 5 plays for this week with hook and rationale. Validate with zod. If the call fails, fall back to a high quality deterministic plan built from the same inputs so the app never breaks.
- Plans must be specific to the workspace inputs, never generic. Include the audience and sector in each hook.
- Setup must collect everything the plan needs (growth focus, weekly time, formats, topics, voice). See step 1b stage 4 and 5 for the exact flow.

## Stage 3: Dashboard card and Growth Plan page (the original Dashboard stays)
- Keep the original Dashboard exactly as designed. Do NOT replace it with a new home screen.
- Add one growth plan card to the Dashboard (north star, progress, forecast line, this week's top 3 plays, "View full growth plan" button).
- Build a full Growth Plan page at /growth with a rail item "Growth plan" under Dashboard: goal and forecast, pillars, cadence, this week's plays, experiments, insights, plan history, and a Regenerate plan button with confirmation.
- Nav stays: Dashboard, Growth plan, Transform, Record, Results (was Track), Distribute, Settings. Keep routes working with redirects.
- Design empty, loading and error states for both.
- Step 1b has the detailed spec for these. If you are following 1b, do not do this stage twice.

## Stage 4: Plays wired through the loop
- Record: if opened from a play, show the play banner and 3 to 4 guided prompts to speak to. On save, link the log to the play and set status to recorded.
- Transform: when a log is linked to a play, preselect the play's format and show the hook. Link generated content to the play and set status to transformed.
- Distribute: items created from plays carry the play title. Status updates to scheduled.
- Results (Track): when an entry is logged for a play's content, set status to measured and attach numbers to the play.

## Stage 5: Experiments and Insights
- Experiments: from a play card, "Run as experiment" lets the user set two hooks. Results page shows a simple compare view when both variants have numbers and lets the user declare a winner, which writes a learning.
- Insights: after every new Results entry, generate or compute insights from the format intelligence data (for example "Video scripts earn 2.3x impressions of posts"), store them, and show them on Dashboard and Results. A recommendation can be applied: it updates the plan's cadence or pillar share and logs the change in the plan history. Use real calculations from data for the numbers, and let Claude only phrase the insight.

## Stage 6: Quality
- Seed nothing fake in the real app. Empty states must guide the user to the next action.
- Typecheck, lint and build must pass.
- Run the app with Playwright, walk Setup > Dashboard > Start play > Record > Transform > Distribute > Results, screenshot each step and compare against /design styles. Fix issues.

## Final report
List what you built, decisions made, any migrations I must run in Supabase, and anything incomplete.
