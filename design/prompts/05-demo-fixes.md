# Step 5: Demo fixes (voice transcript, tour bugs, markdown, zero token spend)

Work autonomously, no questions, no stopping. One commit per stage on the current branch, never push. Follow /design/DESIGN.md. No em dashes in copy. Update /design/MORNING-REPORT.md at the end with what changed.

## A. Real AI voice with a live transcript (Record, sample recording)
The current sample recording streams text in choppy chunks with no audio. Replace it with a spoken take that is transcribed live, word by word.
1. Generate the audio on this Mac with the built in `say` command, using the best natural voice available (try `say -v '?'` and prefer Ava (Premium), Samantha or Zoe in that order). Write the script text from TOUR_PLAY.sampleRecording chunks joined into one paragraph. Output to public/demo/sample-recording.m4a (for example: say -v Ava -o public/demo/sample-recording.m4a --data-format=aac "TEXT"). Check the duration with afinfo. Commit the audio file. If `say` is unavailable, fall back to speechSynthesis in the browser (see 4).
2. Word timings: compute a start time for every word, proportional to word length (syllable estimate) across the real audio duration, with extra pause weight after commas and full stops. Store the result in src/demo/seed as sampleRecordingTimings.json so it is not recomputed at runtime. Verify by playing the file and checking the transcript stays within about 300 ms of the voice at the start, middle and end. Adjust weights until it feels in sync.
3. Playback and display: on "Use sample recording", play the audio (this happens after a click, so autoplay is allowed) and reveal the transcript one word at a time using the audio element's currentTime (requestAnimationFrame, not timers), so pauses, seeks and tab throttling cannot desync it. Newest word or two render slightly dimmer for about 250 ms then settle, to feel like live recognition. Smooth, no bursts. Keep the blinking caret at the end.
4. Fallbacks: if the audio fails to load or play, use window.speechSynthesis with boundary events and the best en-US voice. If boundary events do not fire within 1.5 seconds, reveal words by estimated timing. If sound is blocked or muted, still reveal at a natural pace (about 150 words per minute). Never throw.
5. Orb: drive the orb from the real audio level using a Web Audio AnalyserNode on the audio element (createMediaElementSource) so it reacts to the voice. For the speechSynthesis fallback, pulse on word boundaries with a smoothed random envelope.
6. Small "Sound on" indicator with a mute toggle near the transcript. Mute keeps the transcript running.
7. Timer shows elapsed audio time. Recording ends exactly when the audio ends.

## B. Tell the user to click Stop
After the sample recording ends (or the user stops it), the tour currently does not say what to do. Fix the Record steps:
- While the audio plays: card says "Listening. Watch your words appear." with Next disabled until playback ends (Skip and Back still work).
- When it ends: spotlight the Stop button with "That is the whole take. Click Stop to save it." The step advances when Stop is clicked. Stopping saves the transcript, links it to the play, and moves on to Transform.
- If the user clicks Stop early, accept it and continue with the partial text.

## C. Live transcript box matches the design
The live transcript panel is a large white card with black text, which breaks the design (white is an accent only). Restyle it as a glass card: rgba(255,255,255,0.16) background, 1px rgba(255,255,255,0.4) border, 14px blur, white text, red recording dot, translucent timer, SF Pro stack. Apply to the real app too. No white surfaces larger than a small tile.

## D. Render Markdown in generated content
Transform shows raw Markdown (# headings, ## subheads, **bold**, lists). Render it properly everywhere generated content is shown (Transform tabs, history, queue previews, demo): headings, bold, italics, bullet and numbered lists, line breaks, links. Use a small safe renderer (react-markdown with no raw HTML, or marked plus sanitization). Style it in the glass theme with good spacing (title 28px weight 300, subheads 20px weight 600, body 16px line height 1.6). Copy, DOCX and PDF must still use the clean content (copy gives the Markdown or plain text without symbols, your choice, keep it consistent).

## E. Tour positioning bugs
Fix the tour engine (src/demo/DemoLayer.tsx):
- The tour card must always sit fully inside the viewport with a 16px margin. In one screenshot the card ran off the right edge with its Next button clipped. Clamp horizontally and vertically.
- Choose placement automatically (right, left, bottom, top) by scoring free space, and flip if the card would cover the highlighted element or important neighboring UI (for example it covered the Content instructions field on the Generate step and sat on the Articles panel at the pillars step). If nothing fits, dock the card at the bottom center.
- Before measuring, scroll the target into view with block center and a margin that accounts for the demo banner (about 44px) and a 24px bottom padding. The Generate button was sitting on the bottom edge and the Pillars spotlight was clipped on the left. If the target is larger than the viewport, spotlight the visible part only.
- Re-measure on resize, scroll, route transition end, font load and any animation (ResizeObserver plus a few animation frames after each step change) so the spotlight never lags or clips.
- Verify with an automated check for all 21 cards at 1280x720, 1440x900, 1536x864 and 1920x1080: card rect inside the viewport, card rect does not overlap the target rect, target fully visible (or visible part highlighted), no horizontal page scroll. Fail the e2e if any card fails.

## F. Skip tour and zero token spend
Decision: skipping the tour lets people explore the demo freely, but the demo must be physically unable to spend tokens or touch the backend.
1. Remove the "Try your own topic" feature and the DEMO_LIVE_GENERATION path completely, client and server. Demo generation, refinement, regeneration and plan generation always use prewritten outputs from src/demo/seed. For any pasted text or topic the user enters, return the closest cached output for the chosen format and show a small friendly note: "Demo uses sample outputs. The full product writes from your own text."
2. In demo mode, block every outbound call to the app's AI server functions and Anthropic at the client boundary (a single guard), and show a calm "Not available in demo" note if something tries. Add a unit test or e2e assertion that a full tour plus free exploration makes zero requests to AI endpoints and zero to Supabase.
3. On the server, make every AI endpoint reject requests with no authenticated session (already required) and also reject any request carrying the demo header or flag, so a modified client still cannot spend tokens through the demo. Keep rate limiting per IP on the AI endpoints as a second layer (simple in memory or edge limit is fine).
4. Skip tour: show a one line confirm ("Explore on your own? Generation uses sample outputs.") then enter free explore. Keep the demo banner, keep a "Resume tour" chip, and keep the Replay tour and Exit demo buttons. The closing card is also reachable from the banner ("Finish demo").
5. Browser speech recognition on Record (free, no tokens) may stay available in free explore, with the paste fallback.

## G. Verify
Update npm run e2e:demo to cover everything above: play the sample recording and assert the transcript advances word by word in sync with audio time, assert the Stop step appears and works, assert Markdown renders (no literal # or ## in the DOM), assert the tour card positions at all four sizes, assert zero AI and Supabase requests including after Skip tour. Take screenshots of the Record, Transform and Distribute steps at 1280x720. Typecheck, lint and build must pass.

## H. Pages are cut off in demo mode (every page except Results)
In demo mode the slim banner (about 44px) sits above an app that is sized to 100dvh, so the whole app is pushed down and the bottom of each page is clipped (Transform's Generate button sat on the bottom edge, the rail's logout icon was cut off, and content below the fold is unreachable on pages that do not scroll internally). Results works only because it scrolls inside its content area. Fix it at the layout level, not per page:
1. Put the banner in the layout flow instead of stacking it on top: the demo wrapper becomes a flex column of 100dvh, banner at its natural height (flex none), the app below it with flex 1 and min-height 0. Alternatively set a CSS variable --demo-banner-h (44px when demo is active, 0px otherwise) on the root and make every full height element use calc(100dvh - var(--demo-banner-h)) instead of 100dvh. Pick one approach and apply it everywhere the app uses 100dvh, 100vh or h-screen (app shell, rail, content areas, orb sizing clamps, setup, login pages, modals and sheets, tour overlay).
2. The rail, header and content area must all fit the remaining space exactly. Content scrolls only inside its own area, with the thin translucent scrollbar. No page level scrollbar and nothing clipped at the bottom.
3. The left rail's logout (Exit demo) button must be fully visible at 1280x720.
4. The tour overlay and spotlight measure from the same coordinate space, so spotlight positions stay correct with the banner present.
5. Check every route in demo mode: Dashboard, Growth plan, Transform (form and result), Record, Results, Distribute, Settings, Welcome and the closing card. At 1280x720, 1440x900, 1536x864 and 1920x1080: assert document scrollHeight equals clientHeight, the last visible element in each page is fully inside the viewport, and any overflowing content is reachable by scrolling inside the content area. Add these assertions to npm run e2e:demo and take a bottom-of-page screenshot for each route at 1280x720.
6. Verify the real app (no banner) is unchanged and still fits exactly.
