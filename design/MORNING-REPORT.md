# Morning report (overnight run)

Status: **complete.** All four briefs in RUN-ALL.md ran in order, then step 5 (05-demo-fixes.md). Every stage is committed on `ui/rework`. Nothing was pushed: the branch was pushed once earlier at your request, and none of the later commits have been.

Tonight's commits, oldest first:

| Commit | What |
|---|---|
| a6b664d to 93d1c33 | Growth Engine, stages 1 to 6 |
| 4dd7ddd, dad974c, dbfb902 | Growth flow fix |
| 85e40df, c624139 | Make it work |
| 46cef06 | Audit |
| 721a922 | Demo mode |
| b7d32af | Combined Supabase SQL covers migrations 002 to 011 |
| f11cb4c | 5H: demo banner in the layout |
| ec0b156 | 5F: zero token spend, Skip tour |
| f161db7 | 5D: Markdown rendering |
| 39c3adc | 5A, 5B, 5C: spoken sample, Stop step, glass transcript |
| (last) | 5E, 5G: tour positioning and the extended demo test |

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
  - Generation always uses sample outputs (see step 5).
  - "Use sample recording" plays a spoken take with a live transcript (see step 5).
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

### Step 5: Demo fixes (05-demo-fixes.md): done
- **A. Spoken sample recording.**
  - The take is real audio: `public/demo/sample-recording.m4a`, 42.7 seconds, voice Samantha. Ava (Premium) and Zoe are not installed on this Mac.
  - Word timings come from Apple's speech engine, which reports the audio frame where each word starts while it renders the file. They are stored in `src/demo/seed/sampleRecordingTimings.json`.
  - I also computed the syllable-weighted estimate the brief describes. It drifted up to about 0.5 seconds mid take, so the engine timings are used instead.
  - Check: every sentence start lands within 132 ms of where the waveform comes out of a pause.
  - Rebuild with `python3 scripts/demo/make-sample-recording.py`.
  - Playback (`src/demo/sample-player.ts`):
    - Words are revealed from `audio.currentTime` in a requestAnimationFrame loop.
    - New words fade in from dim over 250 ms, and the caret blinks at the end.
    - The orb follows the real audio level through an AnalyserNode on the audio element.
    - A "Sound on" toggle mutes through a gain node, so the transcript and orb keep going.
    - The timer shows audio time.
  - Fallbacks: speechSynthesis with word boundary events, then the recorded timings on a clock if no boundary arrives within 1.5 s, then the same clock when sound is blocked. Nothing throws.
  - Tested: the e2e samples the transcript every 200 ms against the audio clock. Worst drift was 16 ms (budget 300 ms), in audio mode.
- **B. Stop step.**
  - While the take plays, the card reads "Listening. Watch your words appear." with Next disabled.
  - When the take ends, the Stop button is spotlit: "That is the whole take. Click Stop to save it."
  - Stop saves the transcript, links it to the play and opens Transform with it.
  - Stopping early is accepted and keeps the partial text.
  - Record now has a visible Stop button in the real app too.
- **C. Glass transcript cards.** The live transcript and the new transcript card use:
  - a 0.16 white glass background with a 0.4 border and 14px blur
  - white text and a red recording dot
  - a translucent timer and the SF Pro font stack
  This applies in the real app as well.
- **D. Markdown.**
  - A small renderer in `src/lib/markdown.ts` builds React elements. There is no HTML string, so raw HTML in the source shows as text, and only http, https and mailto links become links.
  - It renders the Transform tabs, posts, video script scenes and queue previews. History and Dashboard titles use clean plain text.
  - Styles: title 28px weight 300, subheads 20px weight 600, body 16px with 1.6 line height.
  - Copy, Open LinkedIn, DOCX and PDF all use clean plain text with no Markdown symbols: bullets become "•" and numbered items keep their numbers.
- **E. Tour positioning.**
  - The card is clamped inside the viewport with a 16px margin, below the banner.
  - Placement scores right, left, bottom and top beside the spotlight, then viewport corners, then docks at the bottom center.
  - Covering the target is ruled out. Covering a step's "avoid" elements (Content instructions and Source text on Generate, Weekly cadence on Pillars, the caption on Stop) costs extra.
  - Targets are scrolled to the middle of the space between the banner and a 24px bottom margin, and the spotlight is clipped to the visible part.
  - The spotlight re-measures on resize, scroll, ResizeObserver, transition and animation end, font load, and a burst of frames after each step.
  - Demo toasts now sit at the top center, so they cannot cover a spotlit button.
- **F. Zero token spend.**
  - "Try your own topic" and `DEMO_LIVE_GENERATION` are gone.
  - Any text a visitor types gets the closest sample output for the format, plus the note "Demo uses sample outputs. The full product writes from your own text."
  - Three walls stop spending:
    - `callAI` in `src/lib/ai-client.ts` refuses in demo mode.
    - A network guard in demo mode blocks every request to server functions, Anthropic or Supabase before it leaves the browser.
    - The AI server functions refuse any request carrying a demo flag or the `x-spectr-demo` header, and rate limit each IP to 20 AI calls a minute, in memory, on top of the sign-in requirement.
  - Skip tour asks "Explore on your own? Generation uses sample outputs." and then leaves the visitor free. The banner keeps Replay tour and Exit demo and gains "Finish demo" (the closing card), and a Resume tour chip stays.
- **H. Layout under the banner.**
  - The banner height is a CSS variable, `--demo-banner-h`: 44px in the demo and 0 otherwise. `--app-h` is 100dvh minus that height.
  - These use it:
    - the app and auth shells, Setup, overlays and the Companies modals
    - the orb and landing sizes, which used dvh clamps
    - the tour, which reads the same variable
  - Dashboard and Record scroll inside their content area if they ever do not fit, instead of clipping.
  - The real app is unchanged because the variable is 0 there.
- **G. Tests.** `npm run e2e:demo` covers all of the above at 1280x720, 1440x900, 1536x864 and 1920x1080. See section 4.

## 2. What to do first in the morning
1. **Run the SQL.** Open the Supabase dashboard, go to SQL Editor, then New query. Paste all of `design/RUN-IN-SUPABASE.sql` and run it. It combines migrations 002 to 011 (production was missing some of the older tables, such as `queue_items`). It is safe to run twice and runs in one transaction, so a failure changes nothing. Until then, growth data lives on the device with a small note.
2. **Try the demo** at http://localhost:5173/demo (start the server with `npm run dev`). It takes about 4 minutes.
3. **Make two decisions** from `design/audit-report.md` (bottom section):
   - Should the access code move server side?
   - Please confirm in the Supabase dashboard that RLS covers the `companies` table and the logo storage bucket.
4. **Deploy, if you want live AI.** Make sure `ANTHROPIC_API_KEY` is set on the server. The demo never uses it, whatever the settings.
   - If you had set `DEMO_LIVE_GENERATION`, you can remove it. Nothing reads it any more.
   - Listen to the sample take on Record in the demo. To change the voice or the words, edit the chunks in `src/demo/seed/content.ts` and run `python3 scripts/demo/make-sample-recording.py`.
5. **Review and push** `ui/rework` when you are happy. Nothing new was pushed.

## 3. Decisions made on your behalf
- **4: in-memory client for the sandbox.** The demo swaps in an in-memory stand-in for the Supabase client instead of mocking each hook. That way the real components and data paths run unchanged in the demo, and the real app has one switch point (`src/lib/supabase.ts`) that is inert unless `/demo` set the tab's flag.
- **4: demo lives in sessionStorage.** The demo is per tab. Exit demo clears it and reloads, so no demo state reaches the real app. The real app's saved state is never written while in the demo, and the tour test checks this.
- **4: seed adjustments for consistency** (the brief allowed adding missing data "in the same style"):
  - Pillar shares are now 40, 20, 20, 20 (the seed had 35, 25, 20, 20), so the open insight "raise customer wins from 20 to 25 percent" matches the plan it changes.
  - The "due today" post's time is set to just before the moment the demo opens, so it always reads as due.
  - The insight Apply actions are mapped onto the app's format.
- **4: live generation is opt-in.** Superseded in step 5: the demo can no longer make live calls at all.
- **5: engine word timings instead of the estimate.** Apple's speech engine reports exactly when each word starts in the rendered audio. The syllable estimate was up to about 0.5 s off, so the engine timings are stored. The estimate is still computed and reported by the build script.
- **5: Samantha voice.** Ava (Premium) and Zoe are not installed here, so Samantha was used. Install Ava (Premium) in System Settings, Accessibility, Spoken Content, then rerun the script to switch.
- **5: tour copy says a 43 second take.** That matches the real audio. The seed's `durationSeconds: 58` is no longer used.
- **5: Stop moves straight to Transform.** The "Send it to Transform" card was folded into Stop, as the brief says Stop moves on to Transform. The tour still has 21 cards.
- **5: own Markdown renderer.** I wrote a renderer of about 150 lines rather than adding react-markdown. It covers exactly what the writer produces, and it is safe by construction because it never produces HTML strings.
- **5: plain text for Copy.** Copy, Open LinkedIn, DOCX and PDF all get clean text with no Markdown symbols.
- **5: CSS variable for the banner.** Of the two layout options in the brief, I chose the variable. It fixes every full height surface in one place and is a no-op in the real app.
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
- **Live Claude calls.** There is no ANTHROPIC_API_KEY locally, so live plan generation, Transform and insight phrasing were not exercised. Every AI path has a tested fallback.
- **Listening by ear.** Sync was measured against the audio clock and the waveform, not by a person listening. Please give the take a listen.
- **speechSynthesis fallback.** It was not exercised in the e2e: headless Chrome played the audio file, so the fallback never triggered. The code path never throws, and it ends in the clock reveal, which is the same path used when sound is blocked.
- **Server rate limit.** It is in memory per server instance. On Vercel each instance keeps its own count, so treat it as a second layer, not a hard cap.
- **Live speech.** Live speech recognition with a real microphone was not exercised. A stand-in recognizer, the paste fallback and the demo's sample recording were tested.
- **Migrations against a real database.** Supabase migrations cannot be run from here. The app was tested against a mocked Supabase, both before and after the migrations.
- **Playwright.** It is not installed in the repo. The e2e scripts drive headless Chrome directly over the DevTools protocol instead, with the same coverage and no new dependency.

## 5. Known issues
- **Pillars card spacing.** At 1280x720 the tour card can sit close to the pillars spotlight, because that section fills the row. It no longer overlaps.
- **Pillars card position.** At 1280x720 and 1440x900, the Pillars card sits in the top right corner, over the top of the Weekly cadence panel and the Regenerate button. No spot beside the pillars is free at those sizes.
- **Generate button near the bottom.** On Transform at 1280x720, the Generate button sits about 30px above the bottom edge. The form fits without scrolling, so it cannot be scrolled higher.
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
npm run e2e:demo             # tour, sample sync, Stop, Markdown, zero AI calls, layout, at 4 sizes (about 12 min)
npm run e2e:demo -- 1280x720 # one size
```
Screenshots from the e2e scripts go to `design/e2e/`, which is git-ignored.

### Where to edit the demo
- **Seed data:** `src/demo/seed/*.ts`. The originals are in `design/demo-seed`, and the app uses the copy in `src/demo/seed`. Seed-to-table mapping, pillar shares and insight actions are in `src/demo/data.ts`.
- **Tour steps and copy:** `src/demo/tour.ts`
- **Closing card text and links:** `src/demo/seed/recruiter.config.ts`
- **Banner, tour engine and closing card:** `src/demo/DemoLayer.tsx`. Its styles are the `.demo-*` rules at the end of `src/styles.css`.
- **Prewritten outputs and closest-match for typed text:** `src/demo/generate.ts`
- **Sample recording audio and timings:** `public/demo/sample-recording.m4a`, `src/demo/seed/sampleRecordingTimings.json`, rebuilt by `scripts/demo/make-sample-recording.py`
- **Where the tour card should keep clear:** the `avoid` list on each step in `src/demo/tour.ts`
