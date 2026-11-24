# Morning report (overnight run)

Status: **complete.** All four briefs in RUN-ALL.md ran in order. Every stage is committed on `ui/rework`. Nothing was pushed: the branch was pushed once earlier at your request, and none of tonight's commits have been.

Tonight's commits, oldest first:

| Commit | What |
|---|---|
| a6b664d to 93d1c33 | Growth Engine, stages 1 to 6 |
| 4dd7ddd, dad974c, dbfb902 | Growth flow fix |
| 85e40df, c624139 | Make it work |
| 46cef06 | Audit |
| 721a922 | Demo mode |

## 1. What was completed, step by step

### Step 1: Growth Engine (01-growth-engine.md): done
- **Data model.** Migration 009 adds growth_plans, plays, experiments and insights, plus play_id links on the existing tables. Shared types live in `src/lib/growth-types.ts`. One data layer, `src/lib/growth-repo.ts`, falls back to the device until the migration is run.
- **Plan generation.** Claude output is validated with zod, with a deterministic fallback in `src/lib/growth-plan.ts`.
- **Plays** run through Record, Transform, Distribute and Results. Experiments and insights use real computed numbers.

### Step 1b: Fix growth flow (01b-fix-growth-flow.md): done
- **Dashboard.** The original Dashboard is back, now fed by real Results, queue and drafts. The growth plan card under the orb auto-generates a plan.
- **Growth plan page.** The full page at `/growth` has:
  - pillars and cadence
  - plays
  - experiments with compare
  - insights with Apply
  - plan history
  - Regenerate with confirmation
- **Setup.** A new Strategy step, then "Build my growth plan" with a building screen and save-failure retry. Migration 010 adds `workspaces.growth_prefs`.

### Step 2: Make it work (02-make-it-work.md): done
- **A. Honest posting queue.**
  - Each item has Copy post, Open LinkedIn (composer prefilled), Mark ready and Mark as posted.
  - Items past their planned time show "Due now", and the Dashboard shows "N due". There is an opt-in browser reminder.
  - Migration 011 adds content, platform, posted_at and perf_entries.pending.
- **B. Results quick entry.** Mark as posted creates a "Waiting for numbers" entry. A validated sheet logs the numbers and updates the play, forecast and insights.
- **C. Hardening.**
  - Protected pages wait for the session.
  - Record offers "Paste or type instead" (also when the mic is denied or unsupported), stops cleanly on mic errors and keeps captured text, and shows Retry when a save fails.
  - Transform rejects near-empty input, trims sources over 60,000 characters, and offers Try again and Retry.
  - A new `friendlyError` helper means no raw errors anywhere.
- **D.** Layout rechecked.
- **E.** `npm run e2e` runs the full loop: 16 of 16 checks pass with and without the migrations.

### Step 3: Audit (03-audit.md): done
The full report is in `design/audit-report.md`. It has 18 findings: 1 blocker, 6 major and 11 minor. The blocker, all six majors and six minors are fixed.
- **Blocker.** An unused server function let anyone overwrite profiles with the service-role key. It is deleted.
- **Paid API calls.** The AI server functions now require a signed-in session, and payload sizes are checked.
- **Migrations.** Migration 009 is idempotent.
- **Accessibility.** Missing labels, icon-only buttons and Escape-to-close are fixed.
- **Sweep.** At 4 sizes there is no overflow, no console errors, no off-rule fonts, no black active states and no large white surfaces.

### Step 4: Guided demo (04-demo-mode.md): done
- **Entry points.**
  - `/demo` starts a fresh demo directly. It needs no signup, no access code and no database.
  - "Try the demo" sits next to the access code on `/access`, and next to "Try SPECTR now" on `/welcome`.
- **Sandbox.**
  - In demo mode, the Supabase client is swapped for an in-memory stand-in (`src/demo/client.ts`). It is seeded from `buildDemoSeed(new Date())` in `src/demo/seed` and held in this tab's sessionStorage. The real pages render unchanged, and **nothing is written to Supabase**: the tour test confirms zero Supabase requests.
  - Generation uses the prewritten outputs: TOUR_PLAY for the tour play and SEED_GENERATIONS for the others.
  - "Try your own topic" makes up to 3 live calls per visit when the server allows it, and otherwise silently uses cached output.
  - "Use sample recording" streams the scripted take into the live transcript while the orb runs.
- **Disabled in demo** (shown with a tooltip):
  - Settings save and Delete account
  - deleting workspaces
  - Open LinkedIn
  - due reminders
  - Log out becomes Exit demo.
- **Tour.**
  - Nine numbered steps (21 cards) covering:
    - the plan card
    - the full plan
    - a play
    - Record with sample recording
    - Transform
    - Distribute (Copy post, Mark as posted)
    - Results (pending entries, format intelligence, experiments)
    - Apply an insight and watch the pillar share change
    - the recap
  - The page is dimmed with a spotlight. Only the highlighted element and the card take clicks.
  - Steps advance on Next or when you do the action. Keyboard: arrow keys, Enter, and Escape to pause.
  - Leaving the step's page shows a "Resume tour" chip.
- **Chrome.**
  - A slim banner reads "Demo mode. Nothing here is saved." with Replay tour, Exit demo, and "Built by Debojeet Dam" linking to https://debodam.com.
  - The closing card uses `recruiter.config.ts`: "See what else I've built", "Replay the tour" and "Exit demo".
- **Tested.** `npm run e2e:demo` clicks through the whole tour with real mouse events at 1440x900 and 1280x720, with a screenshot per step. Both sizes pass:
  - no overlap
  - no stuck steps
  - no error toasts
  - no Supabase calls
  - the real app's saved state is unchanged after Exit demo

## 2. What to do first in the morning
1. **Run the SQL.** Open the Supabase dashboard, go to SQL Editor, then New query. Paste all of `design/RUN-IN-SUPABASE.sql` and run it. It combines migrations 002 to 011 (production was missing some of the older tables, such as `queue_items`). It is safe to run twice and runs in one transaction, so a failure changes nothing. Until then, growth data lives on the device with a small note.
2. **Try the demo** at http://localhost:5173/demo (start the server with `npm run dev`). It takes about 4 minutes.
3. **Make two decisions** from `design/audit-report.md` (bottom section):
   - Should the access code move server side?
   - Please confirm in the Supabase dashboard that RLS covers the `companies` table and the logo storage bucket.
4. **Deploy, if you want live AI.** Make sure `ANTHROPIC_API_KEY` is set on the server. To allow the demo's "Try your own topic" live calls, also set `DEMO_LIVE_GENERATION=true`. It is off by default, so the demo uses cached output.
5. **Review and push** `ui/rework` when you are happy. Nothing new was pushed.

## 3. Decisions made on your behalf
- **4: in-memory client for the sandbox.** The demo swaps in an in-memory stand-in for the Supabase client instead of mocking each hook. That way the real components and data paths run unchanged in the demo, and the real app has one switch point (`src/lib/supabase.ts`) that is inert unless `/demo` set the tab's flag.
- **4: demo lives in sessionStorage.** The demo is per tab. Exit demo clears it and reloads, so no demo state reaches the real app. The real app's saved state is never written while in the demo, and the tour test checks this.
- **4: seed adjustments for consistency** (the brief allowed adding missing data "in the same style"):
  - Pillar shares are now 40, 20, 20, 20 (the seed had 35, 25, 20, 20), so the open insight "raise customer wins from 20 to 25 percent" matches the plan it changes.
  - The "due today" post's time is set to just before the moment the demo opens, so it always reads as due.
  - The insight Apply actions are mapped onto the app's format.
- **4: live generation is opt-in.** The demo's live "Try your own topic" needs `DEMO_LIVE_GENERATION=true` on the server, and only accepts short topics. Without it, a public link could spend Anthropic credits. The 3-per-session cap is client side.
- **4: the forecast follows results, not the plan.** In the tour, the forecast moves when results are logged. Applying an insight changes the plan (pillar share and history), and the tour copy says so.
- **4: Dashboard impressions use rolling 7-day windows.** Calendar weeks showed "0, down 100%" every Monday and Tuesday, in the real app too.
- **3: deleted unused server code.** `src/lib/auth-fn.ts` and `src/lib/transcribe-fn.ts` were unused, and both exposed paid or privileged calls with no auth.
- **3: left the client-side access code unchanged.** It needs your call.
- **1b: placement of the Growth plan card.** It sits where the "AI suggested" line was, the only spot that fits without scrolling at 1280x720.
- **1b: real data on the Dashboard.** Cards that showed placeholder numbers now read real data, with empty states.
- **1b: a separate Strategy step.** The Strategy fields went into a new Setup step. Only focus and at least one format are required.
- **1b: building screen timing.** The building screen stays up for at least 2.4 seconds so its steps are readable.
- **1: user_id on the new tables.** The growth tables also carry user_id, so RLS matches the existing tables (owner only, and the workspace must be theirs).
- **1: Prettier on src.** I ran the project's own Prettier config over `src` so lint can pass. It had never been applied.

## 4. Blocked or untested
- **Live Claude calls.** There is no ANTHROPIC_API_KEY locally, so live plan generation, Transform, insight phrasing and the demo's live topic were not exercised. Every AI path has a tested fallback.
- **Live speech.** Live speech recognition with a real microphone was not exercised. A stand-in recognizer, the paste fallback and the demo's sample recording were tested.
- **Migrations against a real database.** Supabase migrations cannot be run from here. The app was tested against a mocked Supabase, both before and after the migrations.
- **Playwright.** It is not installed in the repo. The e2e scripts drive headless Chrome directly over the DevTools protocol instead, with the same coverage and no new dependency.

## 5. Known issues
- **Pillars card spacing.** At 1280x720 the tour card can sit close to the pillars spotlight, because that section fills the row. It no longer overlaps.
- **Raw Markdown in Transform.** Transform shows generated Markdown as raw text (`# Heading`). This is existing behavior in the real app. A Markdown renderer would be a separate change.
- **The main client chunk is 747 kB** (220 kB gzipped).
- **Access code.** The access code is client side. See audit-report.md.
- **E2E requirements.** The e2e scripts need the dev server on port 5173 and Google Chrome at the default macOS path. Override them with `E2E_BASE` and `CHROME_PATH`.

## 6. How to run
```bash
npm install
npm run dev                  # app on http://localhost:5173
```
- Landing page: http://localhost:5173/welcome
- Guided demo: http://localhost:5173/demo
- Real app: http://localhost:5173/access (code required), then login, workspace, Dashboard

Checks:
```bash
npx tsc --noEmit -p .        # typecheck
npm run lint                 # 0 errors
npm run build
npm run e2e                  # full loop, database without the growth migrations
npm run e2e:migrated         # full loop, database with migrations 009 to 011
npm run e2e:demo             # whole guided tour at 1440x900 and 1280x720
```
Screenshots from the e2e scripts go to `design/e2e/`, which is git-ignored.

### Where to edit the demo
- **Seed data:** `src/demo/seed/*.ts`. The originals are in `design/demo-seed`, and the app uses the copy in `src/demo/seed`. Seed-to-table mapping, pillar shares and insight actions are in `src/demo/data.ts`.
- **Tour steps and copy:** `src/demo/tour.ts`
- **Closing card text and links:** `src/demo/seed/recruiter.config.ts`
- **Banner, tour engine and closing card:** `src/demo/DemoLayer.tsx`. Its styles are the `.demo-*` rules at the end of `src/styles.css`.
- **Prewritten outputs and the live topic cap:** `src/demo/generate.ts`
