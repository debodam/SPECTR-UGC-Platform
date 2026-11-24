// Runs the whole guided demo tour like a visitor, with real mouse clicks, and screenshots every step.
//   node scripts/e2e/demo-tour.mjs            (1440x900 and 1280x720)
// Needs the dev server (npm run dev) and Google Chrome. Screenshots land in design/e2e/demo-<size>/.
// It also checks that the demo never calls Supabase and leaves the real app's saved state untouched.
import fs from "node:fs";
import path from "node:path";
import { launch } from "./harness.mjs";

const sizes = process.argv[2]
  ? [process.argv[2].split("x").map(Number)]
  : [
      [1440, 900],
      [1280, 720],
    ];
let failures = 0;

for (const [width, height] of sizes) {
  const out = path.resolve("design/e2e", `demo-${width}x${height}`);
  fs.mkdirSync(out, { recursive: true });
  const h = await launch({ out, width, height, port: 9400 + (width % 97) });
  const issues = [];
  const seen = [];
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
  const card = () =>
    h.ev(`(() => { const c = document.querySelector('.demo-card'); if (!c) return null;
      const r = c.getBoundingClientRect();
      const rings = [...document.querySelectorAll('.demo-ring')].map(e => e.getBoundingClientRect());
      const overlap = rings.some(g => r.left < g.right - 4 && r.right > g.left + 4 && r.top < g.bottom - 4 && r.bottom > g.top + 4);
      const off = r.left < 0 || r.top < 40 || r.right > innerWidth || r.bottom > innerHeight;
      return { id: c.dataset.step, advance: c.dataset.advance, click: c.dataset.click,
        title: c.querySelector('.demo-card-title')?.innerText, step: c.querySelector('.demo-card-step')?.innerText,
        overlap, off, rings: rings.length }; })()`);

  try {
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
      await h.sleep(600);
      c = await card();
      seen.push(c.id);
      if (c.overlap) issues.push(`${c.id}: card overlaps the spotlight`);
      if (c.off) issues.push(`${c.id}: card is off screen`);
      await h.shot(`${String(n + 1).padStart(2, "0")}-${c.id}.png`);
      if (c.advance === "button") await mouse(".demo-card .gh-btn--primary");
      else if (c.advance === "click") await mouse(c.click);
      else {
        // The sample take streams for about 12 seconds; then stop it with the orb.
        await h.sleep(12500);
        await h.shot(`${String(n + 1).padStart(2, "0")}-${c.id}-streamed.png`);
        await mouse(".mo");
      }
      await h.sleep(c.advance === "click" ? 1800 : 900);
    }
    const end = await h.ev(`document.querySelector('.demo-end')?.innerText`);
    if (!end) issues.push("closing card never appeared");
    await h.shot("99-closing.png");
    const links = await h.ev(
      `[...document.querySelectorAll('.demo-end a, .demo-bar a')].map(a => a.href)`,
    );
    if (!links.every((l) => l.startsWith("https://debodam.com")))
      issues.push("closing links: " + links);
    if (h.log.length) issues.push(`demo called Supabase: ${[...new Set(h.log)].join(", ")}`);
    if (h.consoleErrors.length) issues.push("console errors: " + h.consoleErrors.join(" / "));
    const toastErr = await h.ev(
      `[...document.querySelectorAll('[data-sonner-toast][data-type=error]')].map(t => t.innerText)`,
    );
    if (toastErr.length) issues.push("error toasts: " + toastErr.join(" / "));
    // Exit and confirm the real app is untouched.
    await mouse(".demo-end-row .gh-btn:last-child");
    await h.sleep(2500);
    const after = await h.ev(
      `({ path: location.pathname, demo: sessionStorage.getItem('spectr-demo'), state: localStorage.getItem('spectr-state-v1'), bar: !!document.querySelector('.demo-bar') })`,
    );
    if (after.demo || after.bar) issues.push("demo flag or banner survived Exit demo");
    if (after.state !== realStateBefore)
      issues.push("real app saved state changed during the demo");
    if (after.path !== "/welcome") issues.push("Exit demo landed on " + after.path);
  } catch (e) {
    issues.push(String(e));
    await h.shot("fail.png");
  } finally {
    await h.close();
  }
  console.log(`\n${width}x${height}: ${seen.length} steps: ${seen.join(" > ")}`);
  if (issues.length) {
    failures++;
    issues.forEach((i) => console.log("  FAIL " + i));
  } else console.log("  PASS: full tour, closing card, no Supabase calls, real state untouched");
}
process.exitCode = failures ? 1 : 0;
