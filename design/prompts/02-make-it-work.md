# Step 2: Make every part of the loop actually work

Work autonomously, no questions. One commit per fix group on the current branch, never push. Follow /design/DESIGN.md for any UI.

## Context
This is a portfolio and interview project. Scheduling on LinkedIn is not possible with their API restrictions, so Distribute must not pretend to publish. It becomes an honest "Ready to post" workflow that still feels real and satisfying. Reliability and polish matter more than scale.

## A. Distribute without the LinkedIn API
- Rename the concept to a posting queue. Each item has: content, platform, planned date and time, status (draft, ready, posted).
- Calendar and queue keep their design. A planned time creates a "due" state when it arrives (visual badge in Distribute and on Dashboard, plus a browser notification if the user allowed it).
- Actions on each item: Copy post (clipboard, with a "Copied" confirmation), Open LinkedIn composer (opens https://www.linkedin.com/feed/?shareActive=true&text= with the URL encoded text, works for text posts), Mark as posted (sets status and timestamp, then prompts to log results later).
- Remove or hide any wording, buttons or code that claim automatic publishing or scheduling on LinkedIn. Make the copy honest and still confident, for example "Your post is ready. Copy it or open LinkedIn to post."
- After Mark as posted, create a pending Results entry so the user is nudged to add numbers in 24 to 48 hours.

## B. Results without platform APIs
- Make logging numbers fast: a quick entry sheet with impressions, engagement rate, followers gained and a notes field, opened from the pending entry. Prefill title, format and source from the content. Validate inputs.
- All Results charts, forecasts and format intelligence must come from these logged numbers.

## C. Wire and harden the whole loop
Walk the full flow and fix anything broken: Login/Signup > Access code > Workspaces > Setup > Dashboard > Record > Transform > Distribute > Results > Settings.
- Auth and routing: protected routes, redirects after login, access code gating, session expiry, sign out.
- Workspaces: create, switch, delete with confirmation, and all data scoped by workspace (check every query and RLS policy).
- Record: microphone denied, no speech recognition support, tab in background, long recordings, save failure, retry. Add a "Paste or type instead" fallback so the flow never dead ends.
- Transform: loading, streaming or progress, API error, retry, empty transcript, very long transcript, regenerate and refine, history.
- Every async action has loading, success and error UI in the glass design. No raw errors, no console errors, no unhandled promise rejections.
- Forms validate with clear inline messages. Buttons disable while submitting.
- Settings: audience, goals, targets and account changes persist and update the Growth plan inputs (offer to regenerate the plan after changes).

## D. Layout and polish
- No page level scrollbars on Record and Dashboard: content area fits 100dvh, orb size uses clamp with dvh, glow layers are absolutely positioned. Long pages scroll only inside the content area with a thin translucent scrollbar.
- Record orb: Siri style living light core with no icon and no SVG lines, driven by live mic level via Web Audio on the existing stream. Respect prefers-reduced-motion.
- Global font rule applied, every button, input and select inherits it.

## E. Verify
Write a Playwright script that runs the full loop on a test workspace and screenshots each step. Run it, fix failures, run again until clean. Typecheck, lint and build must pass.

## Final report
What was fixed, what changed in Distribute and Results, decisions made, anything that still needs my input.
