# Audit report (step 3)

Run on the ui/rework branch against the dev server. Supabase was mocked in memory in both states (before and after migrations 009 to 011). No Anthropic key was available, so AI paths were exercised through their fallbacks and error states.

## How it was tested
- **Route sweep.** Every route at 1440x900, 1280x720, 1920x1080 and 390x844, signed in. Each page was checked automatically for:
  - horizontal overflow
  - console exceptions
  - unnamed buttons and unlabeled inputs
  - computed fonts outside the global stack
  - black backgrounds on active controls
  - white surfaces larger than 18% of the viewport
  - em dashes in visible text
  - raw database or JavaScript errors in visible text
  - touch targets under 24px on mobile
- **Signed out.** Every route checked while signed out, plus the login form's empty-submit validation.
- **Full loop:** `npm run e2e` and `npm run e2e:migrated`. 16 checks covering:
  - Dashboard plan, Growth page, start a play
  - Record and save, paste fallback
  - Transform
  - Queue a due post, copy, mark posted
  - Pending result, sheet validation, log numbers
  - Back to the Dashboard
- **Failure paths:**
  - mic denied
  - no speech support
  - database write failure on save
  - Transform while offline
  - near-empty Transform input
  - Transform without an API key
- **Static and code checks:**
  - typecheck, lint and build
  - grep for em dashes and font-family declarations
  - client bundle scanned for the service-role key
  - RLS statements on every migration table
  - server functions reviewed for auth and input checks
  - animation loops reviewed for per-frame React renders
  - bundle sizes

## Findings and fixes

| # | Severity | Area | Finding | Status |
|---|---|---|---|---|
| 1 | Blocker | Security | `createProfileFn` (src/lib/auth-fn.ts) used the service-role key to upsert any profile from a caller-supplied user id and email, with no auth check. Anyone could overwrite profiles. | Fixed. It was unused, so the file is deleted. |
| 2 | Major | Security | `transformContent`, `generateGrowthPlan` and `phraseInsights` accepted unauthenticated calls, so anyone could spend Anthropic credits. | Fixed. The client sends the Supabase access token and the server verifies it (src/lib/server-auth.ts) before any paid call. Payloads are also size-checked. |
| 3 | Major | Security | `transcribeAudio` (OpenAI Whisper) was unauthenticated and unused. | Fixed. File deleted. |
| 4 | Major | Database | Migration 009 used bare `create policy`, so re-running it failed. RUN-ALL requires idempotent migrations. | Fixed. Added `drop policy if exists` before each policy. |
| 5 | Major | Copy and errors | Raw database and API messages reached the UI in about a dozen places (toasts, the error page, Setup, Companies, the LinkedIn upload). | Fixed. A `friendlyError` helper maps errors to calm sentences. Details stay in the console. |
| 6 | Major | Functional | Record had no way forward when the mic was denied or speech was unsupported. "No microphone" and network recognition errors were silently ignored. | Fixed. Added the "Paste or type instead" dialog and clean stops that keep captured text (step 2). |
| 7 | Major | Functional | Transform API errors showed raw text with no retry. Very long sources went to the model unbounded. | Fixed. Calm error with Try again, Retry on Regenerate and Refine, a 60,000 character cap on client and server, and a notice when text is trimmed. |
| 8 | Minor | Accessibility | Transform's three textareas and Settings' Company name and Industry inputs had no accessible names. | Fixed. |
| 9 | Minor | Accessibility | On mobile, the "Regenerate plan" and "Remind me when due" buttons became icon-only with no name. | Fixed. aria-label added. |
| 10 | Minor | Accessibility | Several dialogs did not close on Escape: the Record paste dialog, Growth regenerate confirm, Transform history and New company. | Fixed with a shared `useEscape` hook. |
| 11 | Minor | Copy | Em dashes in the LinkedIn upload helper text and in code comments. | Fixed. The only remaining em dashes are inside the prompt that tells the model not to use them, and the regexes that strip them. |
| 12 | Minor | Code | The error page linked to /transform instead of the Dashboard. | Fixed. |
| 13 | Minor | Security | The access code is hardcoded in the client (src/routes/access.tsx) and can be bypassed in localStorage. It is a soft gate only, since Supabase auth and RLS protect the data. | Left as is. Needs your decision (see below). |
| 14 | Minor | Database | The `companies` table and the logo storage bucket are not created by any migration, so their RLS could not be verified from the repo. | Left. Check them in the Supabase dashboard. |
| 15 | Minor | Performance | The main client chunk is 747 kB (220 kB gzipped). xlsx (LinkedIn upload) and jspdf are already split into their own chunks. | Left. Acceptable for an app shell; route-level splitting could come later. |
| 16 | Minor | Code | 11 lint warnings: 10 are react-refresh notices on files that export helpers next to components, 1 is an exhaustive-deps warning in companies.tsx. None are errors. | Left. Behavior is correct, and changing the deps risks a refetch loop. |
| 17 | Minor | Layout | On 390px, the Distribute cadence planner scrolls sideways inside its card. | Left. It is intentional and contained, with no page overflow. |
| 18 | Minor | Mobile | The footer email link on /welcome is a small touch target at 390px. | Left. Cosmetic. |

## Checks that passed with no findings
- **Fonts.** Every button, input, heading and text node uses the global stack at all four sizes. The only `font-family` declarations are the global rule, the shell and `inherit`.
- **Colors.** No black active states and no large white surfaces on any route at any size.
- **Layout.** No horizontal page overflow on any route at any size.
- **Console.** No exceptions on any route, signed in or out.
- **Routing.**
  - Every protected route sends a signed-out visitor to /access.
  - The access code leads on to /login.
  - Setup redirects to the Dashboard once complete.
  - The 404 page renders.
- **Validation.** Inline validation works on login, Distribute, the result sheet and the paste dialog.
- **Orb.** The orb has an aria-label per state. Its animation writes a CSS variable each frame, never React state.
- **Secrets.** The service-role and Anthropic keys are only read in server functions. The built client bundle does not contain the service-role key. `.env` is not tracked.
- **RLS.** Every table created by the migrations has RLS enabled with owner-only policies.

## Needs your decision
1. **Access code.** Move the check server side (for example, a server function that compares against an env var and sets an httpOnly cookie), or keep it as a client-only soft gate. I left it unchanged because it changes how you hand out access.
2. **Companies table and logo bucket.** Please confirm in the Supabase dashboard that RLS limits `companies` and the logo bucket to their owner.
