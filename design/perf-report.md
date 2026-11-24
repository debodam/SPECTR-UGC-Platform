# Animation performance report (09)

## How it was measured
`node scripts/perf/measure.mjs <label>` drives headless Chrome at 1440x900 through three scenarios:
- **Landing:** about 10 seconds of the `/welcome` carousel, plus a pill click.
- **Tour transitions:** the whole guided tour from Welcome to the closing card. Frames are counted for 1.6 seconds after every step change.
- **Record:** 10 seconds of the orb and live transcript while the sample take plays.

What it records:
- **Frame intervals,** from requestAnimationFrame. A frame over 33 ms counts as dropped.
- **Long tasks,** from PerformanceObserver: anything over 50 ms.
- **Long animation frames.**

Raw numbers are in `design/perf/*.json`. **Before** was measured on the dev server before any change. **After** was measured on the dev server and on a production build (`vite preview`).

Targets: no long tasks over 50 ms during animations, and 95% of frames under 20 ms.

## Results

| Scenario | Frames under 20 ms | Dropped (>33 ms) | p95 frame | Worst frame | Long tasks (worst) |
|---|---|---|---|---|---|
| Landing, before (dev) | 100% | 0 | 16.7 ms | 16.8 ms | 0 |
| Landing, after (production) | 100% | 0 | 16.7 ms | 16.8 ms | 0 |
| Tour, before (dev) | 99.8% | 1 | 16.8 ms | 133 ms | 2 (143 ms) |
| Tour, after (dev) | 99.8% | 1 | 16.8 ms | 100 ms | 2 (118 ms) |
| Tour, after (production) | 99.8% | 3 | 16.8 ms | 100 ms | 1 (119 ms, see below) |
| Record, before (dev) | 100% | 0 | 16.8 ms | 16.8 ms | 0 |
| Record, after (production) | 100% | 0 | 16.8 ms | 16.8 ms | 0 |

The 95% target is met everywhere, with 99.8% or better.

### Long tasks found and fixed
1. **"Use sample recording": 128 ms.** The audio element and Web Audio graph were built on the click. They are now prepared in idle time once Record has settled, so the click only starts playback.
2. **"Mark as posted": 55 ms.** The demo sandbox serialized all its tables to sessionStorage on every write. Writes are now coalesced into idle time and flushed on page hide.
3. **Same-page tour steps.** They now measure their target after 60 ms instead of 320 ms, so the next card arrives sooner.

### The one that remains
Opening Record from a play shows one 119 ms task in the headless run. It is the `AudioContext` constructor for the prepared sample audio.
- **Why it's this slow:** headless Chrome runs with a muted, fake audio device, and setting that up is slow. In a normal Chrome window the same constructor took **13 ms** (measured in the browser pane).
- **When it runs:** once per visit, 0.9 s after the page has settled, in idle time. It is not during a transition.
- **Animations are unaffected:** every animation on that screen is a compositor animation (transform and opacity), so a main-thread task does not stop them.

### Caveat
Headless Chrome renders without a GPU, so it shows main-thread jank well but understates the cost of `backdrop-filter`, which is GPU work. The blur changes below reduce GPU load on real machines more than these numbers can show. A manual check on a real laptop with the Performance panel open is worth doing once after deploy.

## What changed
- **One motion scale.**
  - `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` and `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)`.
  - Durations: `--dur-1` 150 ms, `--dur-2` 250 ms, `--dur-3` 400 ms, `--dur-4` 600 ms.
  - Every transition in `src/styles.css` and the short one-shot animations (page entrance, content entrance, shake, word reveal) use them.
  - Only the long looping orb and shimmer animations keep their own timing.
- **Transform and opacity only.**
  - Progress bars (growth plan card, Growth page, tour card) animate `scaleX` instead of `width`.
  - The tour ring moves with `translate3d` instead of `left` and `top`.
  - The tour card's wrapper glides with a transform.
  - Hover effects no longer animate `box-shadow`.
- **Blur budget.**
  - Every remaining blurred layer uses at most 14px. The 18 to 20px dialogs, the tour card, the building screen and the closing card were brought down to 14px.
  - Glass inside glass (`.sx-glass .sx-glass`, and the Record transcript cards inside the logs panel) uses a plain fill instead of a second blur.
  - Blurred elements never animate themselves:
    - Dashboard cards fade in a light overlay on hover instead of lifting.
    - The tour card sits still inside a moving wrapper, and fades and slides 8 px in on each step.
- **Tour.**
  - The previous spotlight stays on screen until the next step's target is measured, then the cut-out and ring glide to it (400 ms). The dim never flashes.
- **Orb.**
  - Hover is tracked with pointer events instead of being checked every frame.
  - The level custom property is only written when it changes.
  - Animation playback rates are only updated when the speed changes.
  - Every looping animation pauses while the tab is hidden (`html.is-hidden`).
  - The orb's layers are CSS animations of transform and opacity, so they stay on the compositor.
- **Reduced motion.**
  - Durations collapse to 150 ms and looping animations stop.
  - The tour card, ring, progress bars, buttons and orb only fade.
- **Layout shift.**
  - Landing images have explicit sizes.
  - The tour card only appears once its position is known.
  - The live transcript box has a fixed minimum height.
  - Skeletons were already in place for Transform and the growth plan card.

## 11: demo polish (tour from step 1 to the closing card)
Measured with `node scripts/perf/measure.mjs <label> <WxH> tour` on the dev server, headless Chrome. Frames are counted for 1.6 s after every step change.

| Size | Frames under 20 ms | Dropped (>33 ms) | Worst frame | Long tasks over 50 ms (worst) |
|---|---|---|---|---|
| 1440x900, before | 99.7% | 2 | 233 ms | 2 (256 ms) |
| 1440x900, after | 99.7% | 2 | 150 ms | 3 (173 ms) |
| 390x844, before | 99.8% | 2 | 417 ms | 2 (164 ms) |
| 390x844, after | 99.9% | 3 | 150 ms | 2 (179 ms) |

The target of at least 95% of frames under 20 ms is met at both sizes. The worst frame dropped from 233 and 417 ms to 150 ms. The 417 ms frame at 390 came from the "plan updated" step and is gone.

The remaining long tasks are in three places:
- **Opening Record from a play.** This is mostly the one-time AudioContext setup in headless Chrome (13 ms in a real browser; see 09 above), plus the Record page's first render.
- **"Mark as posted".** About 50 ms, which is right at the threshold.
- **A few transitions with one 50 to 55 ms long animation frame.** These come from React rendering the next page during route changes on the dev server.

What changed:
- **The spotlight glides in every browser.** `useGlidingSpotlight` (`src/demo/useGlidingSpotlight.ts`) replaces the CSS `transition: d`, which only works in Chrome, and the ring's width and height transitions, which were layout work.
  - It runs a requestAnimationFrame tween over 420 ms with an ease-out quartic curve, and writes the path `d` and each ring's transform, width and height straight to the DOM. React does not re-render per frame.
  - It glides only when the step changes. Within a step it follows the target at once.
  - The first appearance and reduced motion snap.
  - A timer lands the spotlight on its target even if animation frames are paused.
  - Checked in headless Chrome: going from Pillars to Cadence, the ring passed through 23 intermediate positions over about 400 ms.
- **The card never shows at a stale position.** On each new step it is measured and placed while hidden (`.is-placing`: hidden, no transition), then shown on the next frame. A timer is the fallback. Measured: the card first appeared at exactly its final position.
- **Entrances.**
  - The tour's dim layer fades in over 300 ms.
  - The closing card's backdrop fades in, and the card lifts in from 12px down at 0.98 scale (400 ms, shared ease-out).
  - The Resume chip fades in.
  - The blurred layers (the backdrop scrim and the card) sit still inside animating wrappers.
- **Live transcript.** The box has a fixed height (150 px) and scrolls itself to the newest words, so the logs below it never shift. Looping animations still pause when the tab is hidden.
- **Demo bar.** Verified at 360, 390, 600, 820 and 1440 wide: no sideways scroll, and every button stays inside the bar (`npm run e2e:demo-bar`, screenshots in `design/e2e/demo-bar/`).
