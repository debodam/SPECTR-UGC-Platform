# Morning report (overnight run)

Status: in progress. This file is updated after every step.

## 1. What was completed, step by step

### Step 1: Growth Engine (design/prompts/01-growth-engine.md): done
Commits a6b664d to 93d1c33 on ui/rework (one per stage).
- Data model: migration `supabase/migrations/009_growth_engine.sql` (growth_plans, plays, experiments, insights, play_id links). Shared types in `src/lib/growth-types.ts`, single data layer `src/lib/growth-repo.ts` that falls back to localStorage until the migration is run.
- Plan generation: Claude with zod validation, deterministic fallback (`src/lib/growth-plan.ts`).
- Plays wired through Record, Transform, Distribute, Results. Experiments and insights with real computed numbers.
- Typecheck, lint (0 errors) and build pass. Headless walkthrough Setup > ... > Results passes.

### Step 1b: Fix growth flow (01b-fix-growth-flow.md): done
Commits 4dd7ddd, dad974c, dbfb902.
- Original Dashboard restored (orb, impressions, 12-week goal, Distribute, Ready to publish, See ideas), now fed by real Results, queue and drafts instead of placeholder numbers. Nav item is Dashboard again.
- Growth plan card on the Dashboard under the orb: north star, progress, forecast line, top 3 plays (open Record linked), View full growth plan. Plans auto-generate on first load; no build button. Fits 1280x720 and 1440x900 with no scroll.
- Full Growth Plan page at /growth with a new rail item: goal and forecast, pillar cards, weekly cadence by format, plays, experiments with compare, insights with Apply, plan history, Regenerate with confirmation. Settings offers regeneration after audience, goals or targets change.
- Setup: new Strategy step (focus, weekly time, formats, topics, voice, accounts to avoid). Final button "Build my growth plan" with an animated building screen, fallback notice, and a real save-failure state with retry. Migration 010 adds workspaces.growth_prefs.
- Rail and header are now shared components (src/components/spectr/AppChrome.tsx).
### Step 2: Make it work (02-make-it-work.md): done
Commits 85e40df and the "Make it work C to E" commit.
- A. Honest posting queue on Distribute. Nothing claims to auto-publish. Each item has Copy post, Open in LinkedIn (composer prefilled with the text), Mark ready and Mark as posted. Items past their planned time show "Due now", the Dashboard tile shows "N due", and there is an opt-in browser notification. Migration 011 adds content, platform, posted_at and perf_entries.pending.
- B. Mark as posted creates a pending Results entry ("Waiting for numbers"). A quick sheet takes impressions, rate and followers with inline validation, then updates the play, forecast and insights.
- C. Hardening:
  - Protected pages (Transform, Record, Results, Distribute, Settings) now wait for the session and redirect to /login or /companies instead of flashing.
  - Record has a "Paste or type instead" fallback, offered under the orb and when the mic is denied or the browser has no speech support. It can save to logs or go straight to Transform, linked to the play. Recognition errors that used to be ignored (no microphone, network) now stop cleanly and keep what was captured. A failed save shows Retry.
  - Transform rejects near-empty input, trims sources over 60,000 characters with a notice (the server trims too), shows a calm error with Try again, and offers Retry on failed Regenerate or Refine. Copy uses a fallback when the clipboard is blocked.
  - A new `friendlyError` helper replaces raw database and API messages across Transform, Results, Distribute, Growth, Settings, Setup, Companies, the experiment dialog, LinkedIn upload and the error page.
- D. The layout and polish work was mostly done before this run. Rechecked at 1440x900 and 1280x720.
- E. `npm run e2e` (and `npm run e2e:migrated`) drives the full loop in headless Chrome against a mocked Supabase: Dashboard plan, Growth page, start a play, record, save, paste fallback, Transform, queue a due post, copy, mark posted, pending result, validation, log numbers, back to the Dashboard. 16 of 16 checks pass in both modes. Screenshots go to design/e2e (git-ignored).
### Step 3: Audit (03-audit.md): done
Full report in design/audit-report.md. 18 findings: 1 blocker, 6 major, 11 minor. The blocker, every major and 6 minors are fixed. The rest are logged with reasons.
- Blocker: an unused server function let anyone overwrite profiles with the service-role key. Deleted.
- AI server functions now require a signed-in session token, so strangers cannot spend Anthropic credits. Payload sizes are checked.
- Migration 009 is now idempotent (drop policy if exists).
- Raw errors replaced with friendly messages app-wide. Missing labels, icon-only buttons and Escape-to-close dialogs fixed.
- Sweep at 1440x900, 1280x720, 1920x1080 and 390x844: no overflow, console errors, wrong fonts, black active states or large white surfaces.
### Step 4: Demo mode: pending

## 2. What to do first in the morning
(written at the end of the run)

## 3. Decisions made on your behalf
- 3: deleted src/lib/auth-fn.ts and src/lib/transcribe-fn.ts. Both were unused, and both exposed paid or privileged calls with no auth.
- 3: left the client-side access code unchanged. See audit-report.md, "Needs your decision".
- 1b: the Growth plan card sits where the Dashboard's "AI suggested" line was, under the orb. That line was growth guidance and the spot is the only place a card fits without a scroll at 1280x720. The suggestion copy now lives in the card's forecast and the See ideas helper text.
- 1b: Dashboard cards that showed placeholder numbers (a hardcoded sparkline, 0% goal, empty week) now read real data, with empty states when there is none.
- 1b: Strategy fields went into a new fifth Setup step rather than crowding Goals or Audience. Only focus and at least one format are required.
- 1b: the building screen stays up for at least 2.4 seconds so its four steps are visible even when the fallback plan builds instantly.
- Step 1: the brief asked for workspace_id on the new tables. Added user_id too so RLS matches the existing tables exactly (owner only, and the workspace must belong to the owner).
- Step 1: kept growth data working before the migration is applied by storing it in localStorage per company, with a small on-screen note.
- Step 1: formatted `src` with the project's own Prettier config so lint can pass (it had never been applied; 2,600 formatting errors).

## 4. Blocked or untested
- No ANTHROPIC_API_KEY in the local environment, so live Claude calls (plan generation, Transform, insight phrasing) could not be exercised. Every AI path has a fallback that was tested.
- Live speech recognition and a real microphone were not exercised. A stand-in recognizer was used, plus the paste fallback.
- Supabase migrations cannot be run from here. Tested against a mocked Supabase in both the before-migration and after-migration states.

## 5. Known issues
- The e2e script needs the dev server running on port 5173 and Google Chrome at the default macOS path (override with CHROME_PATH and E2E_BASE).

## 6. How to run
(written at the end of the run)
