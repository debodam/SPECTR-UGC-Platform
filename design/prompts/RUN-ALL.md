# Overnight run: do all remaining steps back to back, unattended

I am asleep. Nobody will answer questions. Work from start to finish without stopping, without asking, and without waiting for approval. Make the best decision, write it down, and keep going. Never push to a remote. Commit after every stage on the current branch (ui/rework).

## Before you start
1. Check git status. If step 1 (design/prompts/01-growth-engine.md) left uncommitted work, run the typecheck, fix anything broken, and commit it as "Growth Engine: finish stage 6" before moving on. Do not discard any of that work.
2. Create /design/MORNING-REPORT.md now and update it after every step so it is always current, even if the run is cut off.

## Run these in order, completely, following each file exactly
1. design/prompts/01b-fix-growth-flow.md
2. design/prompts/02-make-it-work.md
3. design/prompts/03-audit.md
4. design/prompts/04-demo-mode.md

Rules for the whole run:
- Finish and commit a step before starting the next. After each step run typecheck, lint and build. If something fails, fix it before moving on.
- If a step is blocked (missing credentials, a service you cannot reach, a test you cannot run), do not stop. Build the best version you can, make it degrade gracefully, log it under "Blocked or untested" in the report, and continue.
- Database migrations: you cannot run them against Supabase. Write them as files in supabase/migrations, keep them idempotent (create table if not exists, add column if not exists), and also combine every new migration from this run into one file /design/RUN-IN-SUPABASE.sql in the correct order, so I can paste it in one go. Code must not crash if a migration has not been run yet: wrap new queries so the app falls back to local or seeded behavior and shows a calm message.
- The demo (step 4) must work completely with no database and no API keys, using the seed data in /design/demo-seed. This is the most important deliverable. Make sure it can be opened at /demo with nothing else configured.
- Use Playwright against the dev server to test as much as possible. For flows that need Supabase or Anthropic keys, test them in demo mode or with mocked responses, and say which flows were only tested that way.
- Keep to the design system in /design/DESIGN.md and /design/source. No em dashes in any copy. Global font rule everywhere.
- Do not delete user data, do not change .env, do not commit secrets.

## When everything is done
Finish /design/MORNING-REPORT.md with these sections, written plainly:
1. What was completed, step by step.
2. What to do first in the morning (for example: paste /design/RUN-IN-SUPABASE.sql into the Supabase SQL editor, then run the dev server and open /demo).
3. Decisions you made on my behalf.
4. Blocked or untested items and why.
5. Known issues, ranked by importance.
6. How to run the app and the demo, with exact commands and URLs.
Then print a short summary of that report as your final message.
