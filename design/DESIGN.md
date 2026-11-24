# SPECTR Design System

Designs live in `/design/screens` (PNG) and `/design/source` (HTML/CSS, exact values). When a PNG and this file disagree, the source HTML wins. UI changes only: do not change routes, data, state, API calls or functionality.

## Look
Blue, white and black only. A vivid SPECTR blue gradient page, frosted glass surfaces, white used as an accent only (primary buttons, small tiles), never as a large surface. The dashboard is the reference for glass and for type.

## Tokens
- Primary: `#0a66c2`
- Page background: `linear-gradient(160deg, #b9d6f8 0%, #4d92e0 48%, #0a4a94 100%)`
- Glass card: `background rgba(255,255,255,0.16)`, `border 1px solid rgba(255,255,255,0.4)`, `backdrop-filter blur(14px)`
- Translucent field: `background rgba(255,255,255,0.18)`
- Shell: 1360x880 frame, radius 44, 6px white ring. Left rail 88px wide, header 88px tall
- Primary action button: white background, `#0a66c2` text
- Active and selected states (tabs, segments, nav item, chips): always `#0a66c2`, never black
- Status: done `#067647` on `#ecfdf3`, in progress primary blue, attention amber, failed `#b42318` on `#fef3f2`, neutral grey

## Typography (must be identical everywhere)
Font stack, used for everything:
`-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Inter, 'Segoe UI', sans-serif`

- Page and screen titles: weight 300
- Section headings: weight 600
- Body: weight 400
- Labels and small caps-free labels: weight 600
- Buttons, inputs, selects, textareas and options must set `font-family: inherit`. Browsers default these to Arial, which was the bug in the design pass. Apply one global rule:
  `html, body, button, input, textarea, select, option { font-family: <stack>; }`
- Remove the current Inter-only and Archivo display fonts from `src/styles.css` (`--font-sans`, `--font-display`). Do not leave any other `font-family` in the codebase.

## States
Every screen has an interactive frame plus empty, loading and error or success frames. Build all of them, not only the happy path.

## Proposed items (optional, decide per item)
These were added by the designer and change behavior slightly. Build only the ones I approve:
- Settings: split into tabs (Audience, Goals, Targets, Account)
- Track: Behind / On track status pills on KPI cards
- Distribute: date picker on Add
- Record: logs list defaults to first item expanded

## Screen to route map
| Design | Route file |
|---|---|
| 01 login (+ sign up, loading, error) | `src/routes/login.tsx`, `src/routes/signup.tsx` |
| 02 workspaces | workspace picker (find current file) |
| 03 setup (8 frames) | `src/routes/setup.tsx` |
| 04 dashboard | `src/routes/index.tsx` or dashboard route |
| 05 record | `src/routes/record.tsx` |
| 06 transform (6 frames) | `src/routes/transform.tsx` |
| 07 track | `src/routes/track.tsx` |
| 08 distribute | `src/routes/distribute.tsx` |
| 09 settings (5 frames) | `src/routes/settings.tsx` |
| 10 access code | `src/routes/access.tsx` |
| 11 landing | landing page at root route |

## Screenshot files
`screens/NN-name.png` is the main interactive frame. Extra files `NN-name-StateName.png` are the empty, loading, error and step states.
