// Measures animation smoothness in headless Chrome (needs the dev server and Google Chrome).
//   node scripts/perf/measure.mjs [label]      writes design/perf/<label>.json and prints a summary
// Scenarios: the landing page carousel, the guided tour from start to the closing card, and Record with the
// sample take playing (orb and live transcript).
// Per scenario: frame intervals from requestAnimationFrame (share under 20 ms, frames over 33 ms counted as
// dropped), long tasks (over 50 ms) and long animation frames from PerformanceObserver.
// Note: the dev server serves unbundled modules, so numbers include dev overhead; compare before and after on
// the same machine.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { launch } from "../e2e/harness.mjs";

const label = process.argv[2] || "run";
// Optional: a screen size (WxH) and "tour" to record only the guided tour.
const [W, H] = (process.argv[3] || "1440x900").split("x").map(Number);
const tourOnly = process.argv[4] === "tour";
const outDir = path.resolve("design/perf");
fs.mkdirSync(outDir, { recursive: true });

const PROBE = `(() => {
  if (window.__perf) return;
  const p = (window.__perf = { frames: [], long: [], loaf: [], on: false, last: 0 });
  const tick = (t) => { if (p.on && p.last) p.frames.push(t - p.last); p.last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try { new PerformanceObserver((l) => { if (p.on) for (const e of l.getEntries()) p.long.push(e.duration); }).observe({ type: 'longtask', buffered: false }); } catch {}
  try { new PerformanceObserver((l) => { if (p.on) for (const e of l.getEntries()) p.loaf.push(e.duration); }).observe({ type: 'long-animation-frame', buffered: false }); } catch {}
})()`;

const summarize = (name, d) => {
  const f = d.frames.filter((x) => x > 0 && x < 1000);
  const under20 = f.filter((x) => x < 20).length;
  const sorted = [...f].sort((a, b) => a - b);
  return {
    scenario: name,
    frames: f.length,
    under20ms: f.length ? +((under20 / f.length) * 100).toFixed(1) : 0,
    dropped: f.filter((x) => x > 33.4).length,
    p95ms: f.length ? +sorted[Math.floor(sorted.length * 0.95)].toFixed(1) : 0,
    worstFrameMs: f.length ? +sorted[sorted.length - 1].toFixed(1) : 0,
    longTasks: d.long.length,
    worstLongTaskMs: d.long.length ? +Math.max(...d.long).toFixed(0) : 0,
    longAnimationFrames: d.loaf.length,
  };
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spectr-perf-"));
const h = await launch({ out: tmp, width: W, height: H, port: 9660 + (W % 31) });
await h.send("Page.addScriptToEvaluateOnNewDocument", { source: PROBE });
const start = () =>
  h.ev(
    `(window.__perf.on = true, window.__perf.frames = [], window.__perf.long = [], window.__perf.loaf = [], window.__perf.last = 0, 1)`,
  );
const stop = () =>
  h.ev(
    `(window.__perf.on = false, { frames: window.__perf.frames, long: window.__perf.long, loaf: window.__perf.loaf })`,
  );
const mouse = async (sel) => {
  const box =
    await h.ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null;
    const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!box) return false;
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
    await h.send("Input.dispatchMouseEvent", {
      type,
      x: box.x,
      y: box.y,
      button: "left",
      clickCount: 1,
    });
  return true;
};

const results = [];
try {
  if (!tourOnly) {
    // 1. Landing: two full carousel cycles plus a pill click.
    await h.go("/welcome", 3000);
    await start();
    await h.sleep(9000);
    await mouse(".ld-pill:nth-child(3)");
    await h.sleep(1500);
    results.push(summarize("landing", await stop()));
  }
  // 2. Guided tour, start to the closing card. Frames are only counted while the tour is moving between steps.
  await h.go("/demo", 4500);
  const tour = { frames: [], long: [], loaf: [] };
  const visited = [];
  for (let n = 0; n < 40; n++) {
    if (await h.ev(`!!document.querySelector('.demo-end')`)) break;
    let c = null;
    for (let t = 0; t < 40 && !c; t++) {
      c = await h.ev(
        `(() => { const c = document.querySelector('.demo-card'); return c ? { id: c.dataset.step, advance: c.dataset.advance, click: c.dataset.click } : null; })()`,
      );
      if (!c) await h.sleep(200);
    }
    if (!c) {
      console.log("note: no tour card after", visited.at(-1));
      break;
    }
    visited.push(c.id);
    await h.sleep(500);
    if (c.id === "listening") {
      await h.ev(`(() => { const s = document.documentElement.dataset.sample; return s; })()`);
      for (let k = 0; k < 300; k++) {
        if (await h.ev(`document.documentElement.dataset.sample !== 'playing'`)) break;
        await h.sleep(250);
      }
      continue;
    }
    await start();
    if (c.advance === "button") await mouse(".demo-card .gh-btn--primary:not([disabled])");
    else if (c.advance === "click") await mouse(c.click);
    await h.sleep(1600);
    const d = await stop();
    if (d.long.length || d.loaf.some((x) => x > 50))
      tour.where = [
        ...(tour.where ?? []),
        `${c.id}: long ${d.long.map(Math.round)} loaf ${d.loaf.map(Math.round)}`,
      ];
    tour.frames.push(...d.frames);
    tour.long.push(...d.long);
    tour.loaf.push(...d.loaf);
  }
  results.push(summarize(`tour transitions ${W}x${H}`, tour));
  const closed = await h.ev(`!!document.querySelector('.demo-end')`);
  if (!closed) console.log("note: the tour did not reach the closing card:", visited.join(" > "));
  if (tour.where) console.log("tour long tasks at:", tour.where.join(" | "));

  if (!tourOnly) {
    // 3. Record: the orb and live transcript while the sample take plays.
    await h.ev(
      `sessionStorage.setItem('spectr-demo-tour', JSON.stringify({ i: 0, status: 'skipped' }))`,
    );
    await h.go("/record?play=demo-play-sixweek", 3000);
    await mouse('[data-tour="sample-recording"]');
    await h.sleep(800);
    await start();
    await h.sleep(10000);
    results.push(summarize("record orb and transcript", await stop()));
  }
} finally {
  await h.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify(results, null, 2));
console.table(results);
