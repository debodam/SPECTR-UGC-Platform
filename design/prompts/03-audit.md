# Step 3: Full audit

Work autonomously. Fix what you find. Commit per fix group on the current branch. Never push.

1. Run the app and walk every route and every state at 1440x900, 1280x720, 1920x1080 and 390x844. Record findings in /design/audit-report.md with severity (blocker, major, minor).
2. Visual audit against /design/screens and /design/DESIGN.md: fonts (any font-family outside the global rule, any button or input not inheriting), colors (any black active states, any large white surfaces), spacing, glass styling, status colors, empty, loading and error states, copy (no em dashes anywhere).
3. Functional audit: run the full loop end to end with Playwright (Login > Access code > Workspace > Setup > Dashboard > Start play > Record > Transform > Distribute > Mark as posted > Log results > insight appears > plan updates). Test failure paths too (mic denied, API failure, empty inputs, offline).
4. Code audit: typecheck, lint, build, unused code, console errors and warnings, accessibility (labels, focus states, contrast on glass, keyboard navigation, aria on the orb button), performance (no per frame React renders, bundle size, image sizes), security (no secrets in the client, RLS on every table, server only API keys, input validation).
5. Fix every blocker and major issue. Fix minors that take under a few minutes.
6. Re-run everything and update /design/audit-report.md with: what was found, what was fixed, what remains and why.

Final report: summary of results and anything that needs my decision.
