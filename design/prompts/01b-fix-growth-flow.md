# Step 1b: Correct the growth flow (run this if step 1 already ran, or instead of the Stage 2 and 3 parts of step 1)

Work autonomously, no questions. One commit per stage on the current branch, never push. UI follows /design/DESIGN.md and /design/source. No em dashes in copy.

## What was wrong
The growth plan was hanging off a random "Build my growth plan" button on the home screen, and the original Dashboard was replaced by a "Growth home". That is the wrong flow. The correct flow:
Onboarding (Setup) > final button builds the plan > Dashboard (the original design, kept) with a growth plan card > full Growth Plan page.

## Stage 1: Restore the original Dashboard
- Bring back the original Dashboard exactly as designed in /design/source/Dashboard.dc.html and /design/screens/04-dashboard*.png (hero mic orb, existing sections, empty, loading and recording states). If code for it was removed or replaced in step 1, restore it from git history (git log, git show) and re-apply the new design styling. Rename nothing about it: the nav item is still "Dashboard" with the home icon.
- Remove the "Build my growth plan" button and any "Growth home" screen from the Dashboard. Delete dead code.

## Stage 2: Growth plan card on the Dashboard
Add one glass card to the Dashboard in the existing design language, placed where it fits best without crowding the orb (read the design source and choose a spot, for example beside or below the orb). Contents:
- Title "Growth plan" and the north star metric.
- Progress bar to the goal and a one line forecast built from real Results data ("At your current pace you reach 61% of your follower target by Jan 31"). If there is no data yet, show a starter line instead.
- This week's top 3 plays: title, format chip, status chip. Clicking a play opens Record with that play prefilled and linked, as built in step 1.
- A primary button "View full growth plan" that goes to /growth.
- States: loading skeleton while the plan is being generated for the first time, error with retry, empty (no plan yet) which silently triggers generation without a button.
If a workspace finished setup before plans existed, generate the plan automatically the first time the Dashboard loads and show the loading state. Never show a "build" button on the Dashboard.

## Stage 3: Growth Plan page (/growth)
New page in the glass design language, reachable from the card and from a new rail item (compass or target icon, label "Growth plan") placed right under Dashboard. Update the rail so all items fit and the active state is always #0a66c2. Sections:
1. Goal and forecast: north star, progress, forecast with the assumption shown.
2. Pillars: 3 to 4 cards with share of content.
3. Weekly cadence: posts, articles and video scripts per week.
4. This week's plays: all plays with hook, rationale, format, status and Start play.
5. Experiments: running and concluded, with the compare view.
6. Insights: list with an Apply action for recommendations.
7. Plan history: versions with what changed.
8. A secondary "Regenerate plan" button with a confirmation (explain that plays and cadence are rebuilt from current goals and results). Also offer regeneration after Settings changes to audience, goals or targets.
Include empty, loading and error states.

## Stage 4: Onboarding builds the plan
Rework the Setup flow so it ends with the plan being built:
- The final review step's primary button is "Build my growth plan" (replace "Launch" or equivalent). It saves the workspace, then calls plan generation.
- The existing launching state becomes the "building your plan" screen: animated steps in the glass style ("Reading your goals", "Studying your audience", "Choosing your content pillars", "Drafting this week's plays"). Never show a blank screen, always show progress.
- When generation succeeds, route to the Dashboard. If the AI call fails, use the deterministic fallback plan, still go to the Dashboard, and show a small notice that the plan can be refined on the Growth Plan page. Never block the user.
- Keep the error state for a genuine save failure with retry.

## Stage 5: Collect everything the plan needs in Setup
First read the current Setup steps and the plan generator input, then add only what is missing, as clean fields in the existing glass style. Expected additions (skip any that already exist):
- Growth focus: one select (Grow followers, Generate leads, Hire talent, Build investor credibility, Launch a product).
- Weekly time commitment: select (1 to 2 hours, 3 to 5 hours, 6 plus hours). Drives cadence.
- Formats you will make: multi select chips (Posts, Articles, Video scripts). The plan only includes selected formats.
- Topics you want to be known for: short text or chips (3 to 5 topics). Feeds the pillars.
- Voice: select (Direct, Warm, Analytical, Bold).
- Optional: inspiration accounts or competitors to avoid sounding like.
Put them on the Goals or Audience step or a new fifth "Strategy" step, whichever keeps the flow short. Keep required fields minimal, mark the rest Optional, validate inline. Update the step indicator, the review step (show every new field), and the progress copy. Add a Supabase migration storing them (for example a growth_prefs jsonb column on workspaces, RLS unchanged), update the store type, and pass them into plan generation so the plan clearly reflects them (cadence from time commitment, formats from selection, pillars from topics, hooks in the chosen voice).

## Stage 6: Keep demo and seed consistent
- The demo (step 4) must now follow this flow: Dashboard shows the growth plan card, "View full growth plan" opens /growth, onboarding is skipped in demo because the seeded workspace is already complete.
- Add the new Setup fields to /design/demo-seed/company.ts (growth_prefs: focus "Grow followers", 3 to 5 hours, all three formats, topics "customer onboarding, time to first value, customer retention, founder lessons", voice "Direct").

## Stage 7: Verify
Run the app with Playwright: complete Setup on a fresh workspace > Build my growth plan > building screen > lands on Dashboard with the card > View full growth plan > Start a play > Record. Also verify an old workspace without a plan auto generates on first Dashboard load, and that the Dashboard is visually identical to the approved design apart from the new card. Screenshots at 1440x900 and 1280x720. No page level scroll on Dashboard. Typecheck, lint and build must pass.

## Final report
What changed, migrations I must run, decisions made, anything incomplete.
