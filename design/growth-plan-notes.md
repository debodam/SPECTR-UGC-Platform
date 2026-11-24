# Growth Engine plan notes

Loop: Goal > Strategy > This week's plays > Record > Transform > Distribute > Results > Strategy updates.

## What exists and gets reused
- Supabase tables scoped by `company_id` + `user_id`, RLS `auth.uid() = user_id`. `workspaces` has one row per company and user, with industry, audience, goal, baseline and targets.
- Server AI pattern: `createServerFn` + `@anthropic-ai/sdk` (`claude-sonnet-4-6`) in `src/lib/transform-fn.ts`, key from `ANTHROPIC_API_KEY`.
- Record saves `transcripts`, hands off to Transform via `sessionStorage.pendingTranscript`.
- Transform saves `generations`. Distribute saves `queue_items`. Track saves `perf_entries` and computes per-format totals.

## Data model (migration 009)
- `growth_plans`, `plays`, `experiments`, `insights`, each with `workspace_id` (FK workspaces) and `user_id` (RLS, same policy style as existing tables).
- Extra columns the loop needs: `growth_plans.north_star_key`, `growth_plans.history` (plan change log), `growth_plans.active`; `plays.pillar`, `plays.results`; nullable `play_id` on `transcripts`, `generations`, `queue_items`, `perf_entries`, plus `perf_entries.variant` (A or B) for experiments.
- Shared types and zod schemas in `src/lib/growth-types.ts`.

## Resilience
- `src/lib/growth-repo.ts` is the only data layer for growth objects. If the new tables or columns are missing (migration not run yet), it falls back to localStorage per company, so nothing breaks and the walkthrough still works. Writes that add `play_id` to existing tables retry without it.

## Plan generation
- `src/lib/growth-fn.ts` server function asks Claude for strict JSON, validated with zod. Any failure returns the deterministic plan from `src/lib/growth-plan.ts`, built from the same sector, audience, goal and targets, with the audience and sector inside every hook.
- Runs at the end of Setup and from "Regenerate plan" on Growth home.

## Growth home (replaces Dashboard at `/`)
- Goal and forecast: north star progress plus a linear projection from real Results data, with the assumption shown. Starter state with no data.
- This week's plays: cards with title, hook, rationale, format and status chips, Start play, Run as experiment.
- Latest experiment and latest insight. Orb Record entry kept.
- Nav: Growth, Transform, Record, Results, Distribute, Settings. `/track` redirects to `/results`.

## Loop wiring
- Start play opens `/record?play=ID`: banner plus guided prompts; save links the transcript and sets status recorded.
- Transform with a play: format preselected, hook shown; saved generation links to the play, status transformed.
- Distribute: add from a play carries its title and format, status scheduled.
- Results: an entry can be tied to a play (and variant), status measured, numbers attached to the play.

## Experiments and insights
- Experiment: two hooks on a play; Results compare view once both variants have numbers; declaring a winner writes the learning.
- Insights: numbers computed in `src/lib/growth-insights.ts` from Results data; Claude only phrases them (template fallback). Recommendations can be applied: they change cadence or pillar share and append to plan history.
