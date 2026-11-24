// Runs the guided demo like a visitor, with real mouse clicks, and checks it at four screen sizes.
//   node scripts/e2e/demo-tour.mjs              (1280x720, 1440x900, 1536x864 and 1920x1080)
//   node scripts/e2e/demo-tour.mjs 1280x720     (one size)
// Needs the dev server (npm run dev) and Google Chrome. Screenshots land in design/e2e/demo-<size>/.
//
// For every tour card: inside the viewport with a 16px margin, not covering its target, the target visible
// (or only its visible part highlighted), and no horizontal page scroll.
// Record: the spoken sample plays, the transcript advances word by word within 300 ms of the audio clock,
// the Stop step appears and Stop moves on to Transform. Transform: Markdown renders (no literal # or **).
// Network: zero requests to AI server functions, Anthropic or Supabase, during the tour, in free explore
// after Skip tour, and when generating from the visitor's own text.
// Layout: every route fits the space under the demo banner, nothing is clipped at the bottom, overflow
// scrolls inside the content area. The real app (no banner) still fits exactly.
import fs from "node:fs";
import path from "node:path";
import { launch } from "./harness.mjs";

const ALL = [
  [1280, 720],
  [1440, 900],
  [1536, 864],
  [1920, 1080],
];
// No argument: every layout size, then the stall scenarios. "WxH": that size only. "stall": the scenarios only.
const arg = process.argv[2];
const sizes = arg === "stall" ? [] : arg ? [arg.split("x").map(Number)] : ALL;
const runStall = !arg || arg === "stall";
const timings = JSON.parse(
  fs.readFileSync(path.resolve("src/demo/seed/sampleRecordingTimings.json"), "utf8"),
);
const STARTS = timings.words.map((w) => w.t / 1000);
const BLOCKED = /\/_serverFn\/|anthropic\.com|supabase\.(co|in)/i;
const ROUTES = [
  ["dashboard", "/"],
  ["growth", "/growth"],
  ["transform", "/transform"],
  ["record", "/record"],
  ["results", "/results"],
  ["distribute", "/distribute"],
  ["settings", "/settings"],
];
let failures = 0;

// Checks run inside the page.
const CARD_CHECK = `(() => {
  const c = document.querySelector('.demo-card'); if (!c) return null;
  const banner = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--demo-banner-h')) || 0;
  const r = c.getBoundingClientRect();
  const M = 16, tol = 1;
  const inside = r.left >= M - tol && r.top >= banner + M - tol && r.right <= innerWidth - M + tol && r.bottom <= innerHeight - M + tol;
  // The highlighted target is the ring minus its 10px padding.
  const rings = [...document.querySelectorAll('.demo-ring')].map(e => e.getBoundingClientRect())
    .map(g => ({ left: g.left + 10, top: g.top + 10, right: g.right - 10, bottom: g.bottom - 10, g }));
  const overlap = rings.some(g => r.left < g.right && r.right > g.left && r.top < g.bottom && r.bottom > g.top);
  const ringsOnScreen = rings.every(({ g }) => g.left >= 0 && g.top >= banner && g.right <= innerWidth && g.bottom <= innerHeight);
  const targets = (c.dataset.targets || '').split('||').filter(Boolean);
  const hidden = targets.filter(sel => {
    const el = document.querySelector(sel); if (!el) return false;
    const t = el.getBoundingClientRect();
    // Visible space: below the banner, inside the nearest scrolling ancestor.
    let sc = el.parentElement;
    while (sc && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight)) sc = sc.parentElement;
    const sr = sc ? sc.getBoundingClientRect() : { top: banner, bottom: innerHeight };
    const top = Math.max(banner, sr.top), bottom = Math.min(innerHeight, sr.bottom);
    const fits = t.height <= bottom - top;
    return fits && (t.top < top - 1 || t.bottom > bottom + 1);
  });
  const docScrollX = document.documentElement.scrollWidth > document.documentElement.clientWidth;
  const main = document.querySelector('.sx-main');
  const mainScrollX = main ? main.scrollWidth > main.clientWidth + 1 : false;
  return { id: c.dataset.step, advance: c.dataset.advance, click: c.dataset.click, placement: c.dataset.placement,
    inside, overlap, ringsOnScreen, hidden, scrollX: docScrollX || mainScrollX, rings: rings.length,
    rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] };
})()`;

const FIT_CHECK = `(() => {
  const doc = document.scrollingElement || document.documentElement;
  const banner = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--demo-banner-h')) || 0;
  const shell = document.querySelector('.sx-shell, .au-shell, .su-shell');
  const sr = shell?.getBoundingClientRect();
  const area = document.querySelector('.sx-main, .lp-scroll') || shell;
  if (area) area.scrollTop = area.scrollHeight;
  const ar = area?.getBoundingClientRect();
  // Scroll every inner scroll area to its end too. Content inside one is checked against that area,
  // so the elements to check are the leaves outside inner scrollers plus the inner scrollers themselves.
  const scrolls = e => { const o = getComputedStyle(e).overflowY; return (o === 'auto' || o === 'scroll') && e !== area; };
  const inner = [...(area || document.body).querySelectorAll('*')].filter(scrolls);
  inner.forEach(e => { e.scrollTop = e.scrollHeight; });
  const leaves = [...(area || document.body).querySelectorAll('*')].filter(e => {
    if (e.children.length && !inner.includes(e)) return false;
    if (inner.some(sc => sc !== e && sc.contains(e))) return false;
    const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('.demo-bar, .demo-tour, .demo-resume, [data-sonner-toaster]');
  });
  const last = leaves.reduce((a, e) => (!a || e.getBoundingClientRect().bottom > a.getBoundingClientRect().bottom ? e : a), null);
  const lr = last?.getBoundingClientRect();
  const out = document.querySelector('.sx-rail-out')?.getBoundingClientRect();
  return {
    docFits: doc.scrollHeight === doc.clientHeight && doc.scrollWidth === doc.clientWidth,
    shellTop: sr ? Math.round(sr.top) : null, shellBottom: sr ? Math.round(sr.bottom) : null, banner, vh: innerHeight,
    lastBottom: lr ? Math.round(lr.bottom) : null, areaBottom: ar ? Math.round(ar.bottom) : null,
    lastTag: last ? last.tagName + '.' + (last.className?.baseVal ?? last.className ?? '').toString().slice(0, 40) : null,
    railOut: out ? out.top >= banner && out.bottom <= innerHeight : null,
  };
})()`;

for (const [width, height] of sizes) {
  const tag = `${width}x${height}`;
  const out = path.resolve("design/e2e", `demo-${tag}`);
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (f.endsWith(".png")) fs.rmSync(path.join(out, f));
  const h = await launch({ out, width, height, port: 9400 + (width % 97) + (height % 13) });
  const issues = [];
  const notes = [];
  const seen = [];
  const mark = () => h.requests.length;
  const aiCalls = (from) => h.requests.slice(from).filter((u) => BLOCKED.test(u));
  const realStateBefore = await (async () => {
    await h.go("/welcome", 1500);
    return h.ev(`localStorage.getItem('spectr-state-v1')`);
  })();
  await h.send("Browser.grantPermissions", {
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
    origin: process.env.E2E_BASE || "http://localhost:5173",
  });
  const mouse = async (sel) => {
    const box =
      await h.ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null;
      const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!box) throw new Error("not found: " + sel);
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
      await h.send("Input.dispatchMouseEvent", {
        type,
        x: box.x,
        y: box.y,
        button: "left",
        clickCount: 1,
      });
  };
  const card = () => h.ev(CARD_CHECK);
  const checkCard = (c) => {
    if (!c.inside) issues.push(`${c.id}: card not fully inside the viewport ${c.rect}`);
    if (c.overlap) issues.push(`${c.id}: card overlaps its target (${c.placement})`);
    if (!c.ringsOnScreen) issues.push(`${c.id}: spotlight runs off screen`);
    if (c.hidden.length) issues.push(`${c.id}: target not fully visible: ${c.hidden.join(", ")}`);
    if (c.scrollX) issues.push(`${c.id}: horizontal scroll`);
  };

  /** Plays the sample take and checks the transcript against the audio clock until it ends. */
  const checkSample = async () => {
    const samples = [];
    for (let k = 0; k < 260; k++) {
      const s =
        await h.ev(`(() => { const p = window.__spectrSample; const el = document.querySelector('.rc-live-text');
        return p ? { t: p.time(), mode: p.currentMode, words: Number(el?.dataset.words ?? -1),
          state: document.documentElement.dataset.sample } : null; })()`);
      if (s) samples.push(s);
      if (s?.state === "ended" || s?.state === "stopped") break;
      await h.sleep(200);
    }
    const modes = [...new Set(samples.map((s) => s.mode))];
    notes.push(`sample mode: ${modes.join(", ")}`);
    if (!modes.includes("audio")) issues.push("sample recording did not play the audio file");
    let worst = 0,
      jumps = 0;
    for (let k = 0; k < samples.length; k++) {
      const { t, words } = samples[k];
      if (words < 0 || samples[k].state !== "playing") continue;
      // The last shown word must have started, and the next one must not have, within 300 ms.
      const lastStart = words > 0 ? STARTS[words - 1] : 0;
      const nextStart = words < STARTS.length ? STARTS[words] : Infinity;
      const err = Math.max(0, lastStart - t, t - nextStart);
      worst = Math.max(worst, err);
      if (k && samples[k].words - samples[k - 1].words > 4) jumps++;
    }
    const playing = samples.filter((s) => s.state === "playing");
    notes.push(
      `sync: ${playing.length} samples over ${playing.at(-1)?.t.toFixed(1)}s, worst drift ${Math.round(worst * 1000)} ms`,
    );
    if (playing.length < 20) issues.push("too few transcript samples while the take played");
    if (worst > 0.3) issues.push(`transcript drifts ${Math.round(worst * 1000)} ms from the audio`);
    if (jumps) issues.push(`transcript jumped by more than 4 words ${jumps} times`);
    const final = samples.at(-1);
    if (final?.state !== "ended") issues.push("sample did not reach its end");
    if (final && final.words !== STARTS.length)
      issues.push(`transcript ended at ${final.words} words`);
  };

  const markdownCheck = (where) =>
    h
      .ev(
        `(() => { const els = [...document.querySelectorAll('.md')];
      const bad = els.map(e => e.innerText).filter(t => /(^|\\n)\\s*#{1,6}\\s|\\*\\*/.test(t));
      return { blocks: els.length, bad: bad.length, sample: bad[0]?.slice(0, 80) }; })()`,
      )
      .then((m) => {
        if (!m.blocks) issues.push(`${where}: no rendered Markdown found`);
        if (m.bad) issues.push(`${where}: literal Markdown in the DOM: ${m.sample}`);
      });

  try {
    // ── 1. The guided tour, start to finish ──
    const tourStart = mark();
    await h.go("/demo", 4500);
    for (let n = 0; n < 40; n++) {
      if (await h.ev(`!!document.querySelector('.demo-end')`)) break;
      let c = null;
      for (let t = 0; t < 40 && !c; t++) {
        c = await card();
        if (!c) await h.sleep(250);
      }
      if (!c) {
        issues.push(`no tour card after step ${seen.at(-1) ?? "start"}`);
        break;
      }
      await h.sleep(700);
      c = await card();
      seen.push(c.id);
      checkCard(c);
      const file = `${String(n + 1).padStart(2, "0")}-${c.id}.png`;
      await h.shot(file);
      if (c.id === "listening") {
        await checkSample();
        await h.sleep(600);
        await h.shot(`${String(n + 1).padStart(2, "0")}-${c.id}-ended.png`);
        continue; // the step advances by itself when the take ends
      }
      if (c.id === "stop") {
        if (!(await h.ev(`document.documentElement.dataset.sample === 'ended'`)))
          issues.push("Stop step showed before the take ended");
      }
      if (c.id === "changed") {
        // The tour says athlete wins moved from 20 to 25 percent: the plan must show exactly that.
        const share = await h.ev(
          `[...document.querySelectorAll('[data-tour="growth-pillars"] *')].find(e => e.children.length === 0 && /Athlete wins/.test(e.textContent))?.closest('div')?.parentElement?.innerText || document.querySelector('[data-tour="growth-pillars"]')?.innerText || ''`,
        );
        if (!/25%[\s\S]{0,40}Athlete wins|Athlete wins[\s\S]{0,40}25%/.test(share))
          issues.push("after Apply, athlete wins is not shown at 25%");
      }
      if (c.id === "output") await markdownCheck("Transform output");
      if (c.id === "queue") await markdownCheck("Distribute queue");
      if (c.advance === "button") await mouse(".demo-card .gh-btn--primary:not([disabled])");
      else if (c.advance === "click") await mouse(c.click);
      else await h.sleep(1500);
      await h.sleep(c.advance === "click" ? 1800 : 900);
      if (c.id === "stop") {
        await h.sleep(1200);
        const after = await h.ev(
          `({ path: location.pathname, step: document.querySelector('.demo-card')?.dataset.step, text: [...document.querySelectorAll('textarea')].some(t => t.value.startsWith('Okay so')) })`,
        );
        if (after.path !== "/transform") issues.push("Stop did not move on to Transform");
        if (!after.text) issues.push("the saved take did not reach Transform");
      }
    }
    if (!seen.includes("stop")) issues.push("the Stop step never appeared");
    if (seen.length !== 21) issues.push(`expected 21 tour cards, saw ${seen.length}`);
    const end = await h.ev(`document.querySelector('.demo-end')?.innerText`);
    if (!end) issues.push("closing card never appeared");
    await h.shot("99-closing.png");
    const links = await h.ev(
      `[...document.querySelectorAll('.demo-end a, .demo-bar a')].map(a => a.href)`,
    );
    if (!links.every((l) => l.startsWith("https://debodam.com")))
      issues.push("closing links: " + links);
    const tourCalls = aiCalls(tourStart);
    if (tourCalls.length) issues.push(`tour made AI or Supabase requests: ${tourCalls.join(", ")}`);

    // ── 2. Free explore after Skip tour: generate from the visitor's own text, regenerate, refine ──
    const exploreStart = mark();
    await h.go("/demo", 4000);
    await mouse(".demo-card-skip");
    await h.sleep(300);
    if (!(await h.ev(`!!document.querySelector('.demo-card-confirm')`)))
      issues.push("Skip tour did not ask to confirm");
    await mouse(".demo-card-confirm .gh-btn--primary");
    await h.sleep(500);
    const explore = await h.ev(
      `({ card: !!document.querySelector('.demo-card'), chip: !!document.querySelector('.demo-resume'), bar: [...document.querySelectorAll('.demo-bar button')].map(b => b.innerText.trim()) })`,
    );
    if (explore.card || !explore.chip) issues.push("Skip tour did not enter free explore");
    for (const b of ["Replay tour", "Finish demo", "Exit demo"])
      if (!explore.bar.includes(b)) issues.push(`banner is missing ${b}`);
    await h.go("/transform", 2500);
    await h.type(
      'textarea[aria-label="Source text"]',
      "Our support team cut first response time in half by routing tickets by product area.",
    );
    const genBtn = `[data-tour="generate"]`;
    await mouse(genBtn);
    await h.sleep(2600);
    await markdownCheck("Transform from own text");
    const note = await h.ev(
      `[...document.querySelectorAll('[data-sonner-toast]')].some(t => t.innerText.includes('Demo uses sample outputs'))`,
    );
    if (!note) issues.push("own text did not show the sample outputs note");
    await h.click("text=Regenerate", 2200);
    for (const p of ["/growth", "/results", "/distribute", "/record", "/settings", "/"])
      await h.go(p, 1800);
    const exploreCalls = aiCalls(exploreStart);
    if (exploreCalls.length)
      issues.push(`free explore made AI or Supabase requests: ${exploreCalls.join(", ")}`);
    const attempts = await h.ev(`window.__spectrDemoBlocked ?? []`);
    if (attempts.length) notes.push(`blocked before leaving the browser: ${attempts.join(", ")}`);

    // ── 3. Layout under the banner, every route ──
    await h.ev(
      `sessionStorage.setItem('spectr-demo-tour', JSON.stringify({ i: 0, status: 'skipped' }))`,
    );
    for (const [name, route] of ROUTES) {
      await h.go(route, 2200);
      const f = await h.ev(FIT_CHECK);
      await h.sleep(250);
      if (width === 1280) await h.shot(`bottom-${name}.png`);
      if (!f.docFits) issues.push(`${name}: the page itself scrolls`);
      if (f.shellTop !== null && (f.shellTop !== f.banner || f.shellBottom !== f.vh))
        issues.push(
          `${name}: shell spans ${f.shellTop} to ${f.shellBottom}, expected ${f.banner} to ${f.vh}`,
        );
      if (f.lastBottom !== null && f.lastBottom > Math.min(f.vh, f.areaBottom ?? f.vh) + 1)
        issues.push(
          `${name}: last element (${f.lastTag}) ends at ${f.lastBottom}, below ${f.areaBottom}`,
        );
      if (f.railOut === false) issues.push(`${name}: the rail's Exit demo button is clipped`);
    }
    // The landing page is outside the demo: the logo stays in the app and /welcome sends you back.
    await h.go("/", 2200);
    const logo = await h.ev(`document.querySelector('.sx-rail-logo')?.getAttribute('href')`);
    if (logo !== "/") issues.push(`rail logo links to ${logo} in the demo`);
    await h.go("/welcome", 2500);
    const landed = await h.ev(`location.pathname`);
    if (landed !== "/") issues.push(`/welcome in the demo stayed on ${landed}`);
    // Transform result view and the closing card.
    await h.go("/transform?play=demo-play-sixweek", 2500);
    await h.type(
      'textarea[aria-label="Source text"]',
      "Okay so here's my six week basketball training program.",
    );
    await mouse(`[data-tour="generate"]`);
    await h.sleep(2400);
    const tr = await h.ev(FIT_CHECK);
    if (width === 1280) await h.shot("bottom-transform-result.png");
    if (!tr.docFits) issues.push("transform result: the page itself scrolls");
    await mouse(".demo-bar-actions button:nth-child(2)");
    await h.sleep(600);
    const closing =
      await h.ev(`(() => { const e = document.querySelector('.demo-end'); if (!e) return null;
      const r = e.getBoundingClientRect(); return { inside: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth }; })()`);
    if (!closing) issues.push("Finish demo did not open the closing card");
    else if (!closing.inside) issues.push("closing card is clipped");
    if (width === 1280) await h.shot("bottom-closing.png");

    if (h.consoleErrors.length) issues.push("console errors: " + h.consoleErrors.join(" / "));
    const toastErr = await h.ev(
      `[...document.querySelectorAll('[data-sonner-toast][data-type=error]')].map(t => t.innerText)`,
    );
    if (toastErr.length) issues.push("error toasts: " + toastErr.join(" / "));

    // ── 4. Exit, then the real app (no banner) still fits exactly and its saved state is untouched ──
    await mouse(".demo-end-row .gh-btn:last-child");
    await h.sleep(2500);
    const after = await h.ev(
      `({ path: location.pathname, demo: sessionStorage.getItem('spectr-demo'), state: localStorage.getItem('spectr-state-v1'), bar: !!document.querySelector('.demo-bar') })`,
    );
    if (after.demo || after.bar) issues.push("demo flag or banner survived Exit demo");
    if (after.state !== realStateBefore)
      issues.push("real app saved state changed during the demo");
    if (after.path !== "/welcome") issues.push("Exit demo landed on " + after.path);
    for (const [name, route] of [
      ["real dashboard", "/"],
      ["real transform", "/transform"],
    ]) {
      await h.go(route, 2500);
      const f = await h.ev(FIT_CHECK);
      if (!f.docFits || f.banner !== 0 || f.shellTop !== 0 || f.shellBottom !== f.vh)
        issues.push(`${name}: does not fit exactly (${JSON.stringify(f)})`);
    }
  } catch (e) {
    issues.push(String(e));
    await h.shot("fail.png");
  } finally {
    await h.close();
  }
  console.log(`\n${tag}: ${seen.length} cards: ${seen.join(" > ")}`);
  notes.forEach((n) => console.log("  note " + n));
  if (issues.length) {
    failures++;
    issues.forEach((i) => console.log("  FAIL " + i));
  } else
    console.log(
      "  PASS: tour cards placed, sample in sync, Stop step, Markdown, zero AI and Supabase requests, layout fits",
    );
}

// ── Stall scenarios: the whole tour, first card to the closing card, the ways real visitors walk it ──
// A watchdog in the page records the longest time the dim was up with no tour card and no Resume chip.
const WATCHDOG = `(() => {
  if (window.__stallWatch) return; window.__stallWatch = true; window.__stallMax = 0; let since = null;
  setInterval(() => {
    const dim = document.querySelector('.demo-tour');
    const card = document.querySelector('.demo-card');
    const placing = card && card.closest('.is-placing');
    const ok = !dim || (card && !placing) || document.querySelector('.demo-resume') || document.querySelector('.demo-end');
    if (ok) since = null; else { since ??= Date.now(); window.__stallMax = Math.max(window.__stallMax, Date.now() - since); }
  }, 200);
})()`;

async function walk(h, mouse, { mode, blockNavOnce = false, reloadAt = [] }) {
  const issues = [];
  const seen = [];
  const reloaded = new Set();
  let stallMax = 0;
  const readStall = async () => {
    stallMax = Math.max(stallMax, (await h.ev(`window.__stallMax || 0`)) ?? 0);
  };
  const cardNow = () =>
    h.ev(`(() => { const c = document.querySelector('.demo-card'); if (!c || c.closest('.is-placing')) return null;
      return { id: c.dataset.step, advance: c.dataset.advance, click: c.dataset.click, off: c.dataset.offRoute === 'true',
        num: Number((c.querySelector('.demo-card-step')?.innerText.match(/Step (\\d+)/) || [])[1]) }; })()`);
  for (let n = 0; n < 90; n++) {
    if (await h.ev(`!!document.querySelector('.demo-end')`)) break;
    let c = null;
    for (let t = 0; t < 60 && !c; t++) {
      c = await cardNow();
      if (!c) {
        // A paused tour shows the Resume chip: carry on, as a visitor would.
        if (await h.ev(`!!document.querySelector('.demo-resume')`)) {
          issues.push(`the tour paused itself after ${seen.at(-1) ?? "start"}`);
          await mouse(".demo-resume");
        }
        if (await h.ev(`!!document.querySelector('.demo-end')`)) break;
        await h.sleep(200);
      }
    }
    if (await h.ev(`!!document.querySelector('.demo-end')`)) break;
    if (!c) {
      issues.push(`stuck after ${seen.at(-1) ?? "start"}: no card for 12 s`);
      break;
    }
    if (reloadAt.includes(c.num) && !reloaded.has(c.num)) {
      reloaded.add(c.num);
      await readStall();
      await h.send("Page.reload");
      await h.sleep(4500);
      continue;
    }
    if (seen.at(-1) !== c.id) seen.push(c.id);
    await h.sleep(mode === "slow" ? 2000 : mode === "fast" ? 0 : 600);
    if (c.id === "listening") {
      if (mode === "normal") {
        for (let k = 0; k < 320; k++) {
          if (await h.ev(`document.documentElement.dataset.sample !== 'playing'`)) break;
          await h.sleep(250);
        }
      } else await mouse('[data-tour="stop-recording"]'); // stopping early is allowed
    } else {
      if (c.id === "posted" && blockNavOnce)
        // Swallow the tour's first push to Results; the retry (or the fallback card) must still get through.
        await h.ev(`(() => { const orig = history.pushState; let done = false;
          history.pushState = function (s, t, u) { if (!done && String(u).includes('/results')) { done = true; window.__blockedNav = true; return; }
            return orig.apply(this, arguments); }; })()`);
      if (c.advance === "button") await mouse(".demo-card .gh-btn--primary:not([disabled])");
      else if (c.advance === "click") {
        for (let t = 0; t < 30; t++) {
          if (await h.ev(`!!document.querySelector(${JSON.stringify(c.click)})`)) break;
          await h.sleep(100);
        }
        await mouse(c.click);
      }
    }
    // Wait for the tour to move on (another card, the closing card, or no card while the next one loads).
    for (let t = 0; t < 50; t++) {
      const now = await cardNow();
      if (!now || now.id !== c.id || (await h.ev(`!!document.querySelector('.demo-end')`))) break;
      await h.sleep(200);
    }
  }
  await readStall();
  const end = await h.ev(
    `({ shown: !!document.querySelector('.demo-end'), links: [...document.querySelectorAll('.demo-end a, .demo-bar a')].map(a => a.href + ' ' + a.innerText.trim()), blocked: !!window.__blockedNav })`,
  );
  if (!end.shown) issues.push(`never reached the closing card (last: ${seen.at(-1)})`);
  if (!end.links.some((l) => l.startsWith("https://debodam.com") && /what else/i.test(l)))
    issues.push("closing card has no 'See what else I've built' link to debodam.com");
  if (
    !end.links.some((l) => l.startsWith("https://debodam.com") && /Built by Debojeet Dam/.test(l))
  )
    issues.push("no 'Built by Debojeet Dam' link");
  if (stallMax > 5000) issues.push(`dim with no card for ${(stallMax / 1000).toFixed(1)} s`);
  if (blockNavOnce && !end.blocked) issues.push("the navigation block never triggered");
  return { issues, seen, stallMax, blocked: end.blocked };
}

if (runStall) {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    const tag = `stall ${width}x${height}`;
    const out = path.resolve("design/e2e", `demo-stall-${width}x${height}`);
    fs.mkdirSync(out, { recursive: true });
    const h = await launch({ out, width, height, port: 9500 + (width % 53) });
    await h.send("Page.addScriptToEvaluateOnNewDocument", { source: WATCHDOG });
    const mouse = async (sel) => {
      const box =
        await h.ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null;
        el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (!box) throw new Error("not found: " + sel);
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
        await h.send("Input.dispatchMouseEvent", {
          type,
          x: box.x,
          y: box.y,
          button: "left",
          clickCount: 1,
        });
    };
    const issues = [];
    const start = h.requests.length;
    try {
      // 1. Normal walk, with the full sample take.
      await h.go("/demo", 4500);
      let r = await walk(h, mouse, { mode: "normal" });
      r.issues.forEach((i) => issues.push("normal: " + i));
      console.log(
        `${tag} normal: ${r.seen.length} cards, longest bare dim ${(r.stallMax / 1000).toFixed(1)} s`,
      );
      await h.shot("1-closing.png");
      // 2. Replay from the closing card, then a fast walk with the first push to Results swallowed.
      await mouse(".demo-end-row .gh-btn:first-child");
      await h.sleep(4500);
      const reset = await h.ev(`({ step: document.querySelector('.demo-card')?.dataset.step,
        tour: JSON.parse(sessionStorage.getItem('spectr-demo-tour') || '{}').i })`);
      if (reset.tour !== 0) issues.push(`Replay did not restart the tour (index ${reset.tour})`);
      r = await walk(h, mouse, { mode: "fast", blockNavOnce: true });
      r.issues.forEach((i) => issues.push("replay + fast + blocked nav: " + i));
      console.log(
        `${tag} replay fast: ${r.seen.length} cards, blocked nav recovered: ${r.blocked}, longest bare dim ${(r.stallMax / 1000).toFixed(1)} s`,
      );
      // The due post is back after Replay: the sandbox was reseeded (the fast walk marked it posted again).
      // 3. Fresh demo, slow visitor, reloading the page at steps 2, 6 and 8.
      await h.go("/demo", 4500);
      const due = await h.ev(
        `!!document.querySelector('[data-queue-id="demo-queue-9"]') || 'not on this page'`,
      );
      r = await walk(h, mouse, { mode: "slow", reloadAt: [2, 6, 8] });
      r.issues.forEach((i) => issues.push("slow + reloads: " + i));
      console.log(
        `${tag} slow with reloads: ${r.seen.length} cards, longest bare dim ${(r.stallMax / 1000).toFixed(1)} s (${due})`,
      );
      await h.shot("3-closing.png");
      const calls = h.requests.slice(start).filter((u) => BLOCKED.test(u));
      if (calls.length) issues.push(`AI or Supabase requests: ${[...new Set(calls)].join(", ")}`);
    } catch (e) {
      issues.push(String(e));
      await h.shot("fail.png");
    } finally {
      await h.close();
    }
    if (issues.length) {
      failures++;
      issues.forEach((i) => console.log(`  FAIL ${tag}: ${i}`));
    } else
      console.log(
        `  PASS ${tag}: normal, replay + fast + blocked navigation, slow + reloads, zero AI and Supabase requests`,
      );
  }
}
process.exitCode = failures ? 1 : 0;
