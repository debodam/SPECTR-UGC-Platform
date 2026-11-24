# Do the whole SPECTR redesign, start to finish

You are restyling the SPECTR app to match the designs in /design. Work autonomously from start to finish. Do not stop to ask me questions or wait for approval between screens. Make sensible decisions yourself and list them at the end.

## Rules
- UI only. Do not change routes, data, state, API calls, auth, Supabase or any functionality.
- Work on the current branch (ui/rework). Make one git commit per screen with a clear message. Never push.
- The /design/source HTML files are the exact spec for spacing, colors, radii, shadows and blur. The PNGs in /design/screens are the visual target. /design/DESIGN.md has the tokens and the font rule. If they disagree, source HTML wins.
- No em dashes anywhere in UI copy.

## Steps
1. Read /design/DESIGN.md, every file in /design/source and every PNG in /design/screens. Then read the current app (src/styles.css, src/routes, src/components).
2. Foundation: replace the old dark theme, Inter and Archivo fonts in src/styles.css with the design tokens and the global font rule from DESIGN.md. Build shared components first (page gradient background, glass card, left rail, header, buttons, inputs, tabs, status pills) so every screen reuses them.
3. Restyle every screen in this order, including all its empty, loading, error and step states: login and sign up, workspaces, setup, dashboard, record, transform, track, distribute, settings, access code, landing. Map screens to routes using the table in DESIGN.md.
4. Proposed items: build all of them (Settings tabs, Track status pills, Distribute date picker, Record first log expanded). They were approved.
5. Verify yourself. Run the dev server, open every route in a headless browser (Playwright), screenshot it at 1440x960, and compare to the matching PNG in /design/screens. Fix visible differences. Repeat until each screen is a close match.
6. Final audit: search the codebase for any font-family outside the global rule, any button, input, select or textarea that does not inherit the font, any black active state, and any large white surface. Fix all of them.
7. Make sure `bun run build` (or npm run build) passes and lint has no new errors.

## When done
Reply with: a short list of screens done, any decisions you made, anything you could not match and why.
