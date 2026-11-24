# 08: One screen landing page for recruiters

Read this whole file, then do everything in it without asking me anything. No em dashes anywhere in code or copy. Match the existing blue and white glass design system in `design/DESIGN.md` (SF Pro stack, titles weight 300, buttons and inputs inherit font, white only as accent).

## Goal
The public landing page (the one with "Turn expertise into content. Automatically.") is only for recruiters. Replace it with a single screen that fits one viewport with NO scrollbar on desktop, and shows the product instead of describing it.

## Layout (desktop, 1024px and wider)
- Root container is `height: 100dvh; overflow: hidden`. Nothing below the fold. Delete the "Everything you need to go from idea to published" section and everything under it, and the tagline under the logo.
- Top bar: SPECTR logo and wordmark on the left. On the right a small text link "Built by Debojeet Dam" that opens https://debodam.com in a new tab (rel noopener).
- Two columns, vertically centered:
  - Left (about 42%): headline "Turn expertise into content. Automatically." at about 56px, weight 300, left aligned. One subline under it, one sentence: "Record it, transform it, publish it. SPECTR turns raw knowledge into articles, posts and video scripts." Then two buttons, then a tiny trust line.
  - Right (about 58%): a large product screenshot inside a frosted glass browser frame (rounded 16px, border rgba(255,255,255,0.4), glass fill rgba(255,255,255,0.16), blur 14, soft blue glow behind it). Under the frame, four small pill tabs.
- Buttons (56px tall, pill, inherit font, text on one line):
  - Primary white: **Try the demo** goes to `/demo`.
  - Secondary glass outline: **Open app** goes to the existing real entry flow (the one that asks for the access code). Keep that behavior exactly as it is today.
- Trust line under the buttons, small, 70 percent white: "2 min guided tour. No signup. Fake data, nothing saved." Use periods or commas, no middle dots.

## Screenshot carousel
- Four shots: Dashboard with growth plan card, Record with live transcript, Transform with the three outputs, Growth plan page. Pill labels: Dashboard, Record, Transform, Growth.
- Auto-advance every 4 seconds with a 400ms crossfade. Clicking a pill shows that shot and pauses auto-advance permanently for that visit. Active pill is white fill with blue text, inactive is glass.
- Images are real captures of the demo (Fastbreak AI data). Generate them with Playwright against the running dev server at `/demo`: viewport 1440x900, deviceScaleFactor 2, hide the demo banner and tour overlay for the capture, crop to the app area. Save as optimized WebP at about 1600px wide into `public/landing/` (`dashboard.webp`, `record.webp`, `transform.webp`, `growth.webp`), each under 250 KB. Add a script `npm run shots:landing` that regenerates them so they never go stale.
- Set explicit width and height on the images to avoid layout shift. Preload the first image. Lazy load the other three after first paint.
- Respect `prefers-reduced-motion`: show the first shot only, no auto-advance, no crossfade, pills still work.

## Mobile (under 1024px)
Stack vertically: top bar, headline (about 40px), subline, buttons full width, then a smaller screenshot with the pills. Scrolling a little on phones is fine, but both buttons must be visible without scrolling on a 390x844 screen. Hide the subline on screens shorter than 700px tall if needed to achieve that.

## Quality bar
- Visible keyboard focus on every button and pill. Pills are real buttons with `aria-pressed`. Images have descriptive alt text.
- Desktop must not scroll at 1280x720, 1440x900 and 1920x1080. Check all three with Playwright (`document.documentElement.scrollHeight <= window.innerHeight`) and add that check to the e2e suite.
- Do not touch the app, demo or auth logic. Only the landing route and its assets.
- Run typecheck, lint, build and the full e2e suite. Screenshot the landing page at the three desktop sizes and one phone size and look at them yourself before finishing. Fix anything cramped or cut off.
- Append a short "08 landing" note to `design/MORNING-REPORT.md` and commit on `ui/rework`.
