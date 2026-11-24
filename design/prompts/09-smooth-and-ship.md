# 09: Smooth every animation, then get ready to deploy on Vercel from main

Read this whole file, then do everything in it without asking me anything. No em dashes anywhere. Do not push to any remote. Do not change app behavior except where stated.

## Part A: Smooth animations
Goal: everything feels like a premium Apple style product, 60fps, no jank, no layout jumps.
1. Audit every animation and transition in `src/` (CSS, Tailwind, framer or motion, JS timers, the orb, the tour spotlight and card, the landing carousel crossfade, page and route transitions, button and card hovers, the live transcript reveal, the growth plan building screen, toasts, modals).
2. Fix, in this order:
   - Animate only `transform` and `opacity`. Replace animations of `width`, `height`, `top`, `left`, `margin`, `box-shadow` and `filter` with transform based versions where possible. Add `will-change` only on elements that actually animate, and remove it after.
   - Heavy `backdrop-filter` blur on many layers is the main jank source for glass UI. Cap simultaneous blurred layers, use blur 14 only on the main cards, use a cheaper fill on nested glass, and never animate an element that has a backdrop blur. Animate a wrapper instead.
   - One shared easing and duration scale as CSS variables: `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`, `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)`, durations 150 / 250 / 400 / 600 ms. Replace ad hoc values with these.
   - Route changes and the tour spotlight must glide: spotlight moves between targets with a transform based transition (no teleporting), the tour card fades and slides 8px, and the background dim never flashes.
   - The orb: render on a single canvas or a few GPU composited layers, `requestAnimationFrame` driven, pause when the tab is hidden, no React state updates per frame, no layout reads in the loop.
   - Remove layout shift: reserve space for images and async content, use skeletons that match final layout, no content popping in and pushing things down.
   - Respect `prefers-reduced-motion` everywhere with a calm fallback (opacity only).
3. Measure it. With Playwright and Chrome tracing (or the Performance API, long animation frames, and frame timing), record the landing page, the tour from start to the closing card, and the Record screen with the orb. Report dropped frames and long tasks before and after in `design/perf-report.md`. Target: no long tasks over 50ms during animations, and 95 percent of frames under 20ms on the dev machine.
4. Fix any regressions the e2e suite finds.

## Part B: Vercel readiness
1. Inspect the build setup (TanStack Start, Vite). Make `npm run build` produce a Vercel deployable output. If a Vercel preset is needed (for example Nitro with the `vercel` preset), add it, add a minimal `vercel.json` only if required, and confirm a local `vercel build` or an equivalent production build and start works. Do not add paid services.
2. Server side secrets: confirm the Anthropic key and any Supabase service key are only read on the server and never bundled into client code (grep the built client output for key patterns and for `ANTHROPIC`). Confirm the demo guard still rejects demo requests server side so the demo can never spend tokens in production.
3. Write `design/DEPLOY.md` with exact steps for me, in plain language:
   - Every environment variable the app needs, which are public and which are secret, with where to find each value. Include a ready to paste `.env.example` (no real values).
   - Supabase: confirm migrations 001 to 011 plus anything in `design/RUN-IN-SUPABASE.sql` have been applied, and list what to double check (RLS, access code table).
   - Vercel: import the repo, framework preset, build and output settings, set the Production branch to `main`, add the env vars, redeploy. Add the custom domain steps for tryspectr.online.
   - Post deploy smoke test checklist: landing has no scroll, Try the demo works end to end and the closing card links to https://debodam.com, Open app asks for the access code, a real sign in and one real generation works, `/demo` spends zero tokens.
4. Add a `/api/health` style check only if the framework makes it trivial. Add `robots` and basic social meta (title, description, og image using `public/landing/dashboard.webp`) to the landing page.
5. Add a GitHub Actions workflow only if none exists: typecheck, lint, build and e2e on pull requests. Keep it fast.

## Part C: Get ui/rework ready for main
1. Run typecheck, lint, build and the full e2e suites (`npm run e2e`, `e2e:migrated` if the database is reachable, `e2e:demo`). Everything must pass. Do not skip or delete tests.
2. Final grep for leftovers: `rampwise|cobalt|console.log|TODO|FIXME|debugger` in `src` and report anything real. Remove stray debug code.
3. Rebase or merge the latest `main` into `ui/rework` locally and resolve conflicts carefully. Re-run the checks above.
4. Do NOT push and do NOT merge into `main` yourself. Instead write the exact commands for me at the bottom of `design/DEPLOY.md` under "Ship it": the push of `ui/rework`, opening the pull request, merging it into `main`, and what Vercel will do next.
5. Append a "09 smooth and ship" section to `design/MORNING-REPORT.md` with the before and after perf numbers, anything that still needs my attention, and the first thing I should click after the deploy.
6. Commit on `ui/rework`.
