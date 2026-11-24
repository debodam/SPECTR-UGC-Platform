// Checks the one screen landing page (/welcome).
//   node scripts/e2e/landing.mjs     (needs the dev server and Google Chrome)
// Desktop (1280x720, 1440x900, 1920x1080): no scrolling, every part inside the viewport, the four shots load,
// pills switch shots and stop the slideshow, links point where they should.
// Phone (390x844): both buttons visible without scrolling.
// Screenshots land in design/e2e/landing/.
import fs from "node:fs";
import path from "node:path";
import { launch } from "./harness.mjs";

const out = path.resolve("design/e2e/landing");
fs.mkdirSync(out, { recursive: true });
const sizes = [
  [1280, 720],
  [1440, 900],
  [1920, 1080],
  [390, 844],
];
let failures = 0;

for (const [width, height] of sizes) {
  const tag = `${width}x${height}`;
  const phone = width < 1024;
  const h = await launch({ out, width, height, port: 9700 + (width % 89) });
  const issues = [];
  try {
    await h.go("/welcome", 3000);
    await h.sleep(800);
    const r = await h.ev(`(() => {
      const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
      const ld = document.querySelector('.ld');
      return {
        docScroll: document.documentElement.scrollHeight <= window.innerHeight,
        ldScroll: ld ? ld.scrollHeight <= ld.clientHeight : false,
        vh: innerHeight, vw: innerWidth,
        title: document.querySelector('.ld-title')?.innerText,
        demo: box('.ld-btn--primary'), app: box('.ld-btn--ghost'), frame: box('.ld-frame'), pills: box('.ld-pills'),
        demoHref: document.querySelector('.ld-btn--primary')?.getAttribute('href'),
        credit: [document.querySelector('.ld-credit')?.href, document.querySelector('.ld-credit')?.target, document.querySelector('.ld-credit')?.rel],
        imgs: [...document.querySelectorAll('.ld-shot')].map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, w: i.getAttribute('width'), h: i.getAttribute('height'), alt: !!i.alt })),
        pressed: [...document.querySelectorAll('.ld-pill')].map(p => p.getAttribute('aria-pressed')),
        oldSections: /Everything you need|Ready to transform/.test(document.body.innerText),
        dashes: /\\u2014/.test(document.body.innerText),
      }; })()`);
    if (r.title !== "Turn expertise into content. Automatically.")
      issues.push("headline: " + r.title);
    if (r.demoHref !== "/demo") issues.push("Try the demo links to " + r.demoHref);
    if (
      !r.credit[0]?.startsWith("https://debodam.com") ||
      r.credit[1] !== "_blank" ||
      !/noopener/.test(r.credit[2])
    )
      issues.push("credit link: " + r.credit.join(" "));
    if (r.oldSections) issues.push("old landing sections are still there");
    if (r.dashes) issues.push("em dash in the copy");
    if (r.pressed.length !== 4 || r.pressed[0] !== "true") issues.push("pills: " + r.pressed);
    const inView = (b) =>
      b && b.top >= 0 && b.bottom <= r.vh + 0.5 && b.left >= 0 && b.right <= r.vw + 0.5;
    if (phone) {
      if (!inView(r.demo) || !inView(r.app))
        issues.push("buttons not both visible without scrolling");
    } else {
      if (!r.docScroll || !r.ldScroll) issues.push("the page scrolls");
      for (const [k, b] of Object.entries({ buttons: r.app, frame: r.frame, pills: r.pills }))
        if (!inView(b)) issues.push(`${k} not fully inside the viewport`);
    }
    await h.shot(`${tag}.png`);

    // All four shots load after first paint, at their declared size.
    await h.sleep(1500);
    const imgs = await h.ev(
      `[...document.querySelectorAll('.ld-shot')].map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, w: i.getAttribute('width'), alt: !!i.alt }))`,
    );
    if (imgs.length !== 4 || !imgs.every((i) => i.ok && i.w === "1600" && i.alt))
      issues.push("screenshots did not all load: " + JSON.stringify(imgs));

    if (!phone) {
      // Auto-advance, then a pill click switches and pauses for good.
      await h.sleep(3200);
      const moved = await h.ev(`document.querySelector('.ld-pill.is-on')?.innerText`);
      if (moved === "Dashboard") issues.push("slideshow did not advance");
      await h.click(".ld-pill:nth-child(3)", 600);
      const picked = await h.ev(
        `[document.querySelector('.ld-pill.is-on')?.innerText, document.querySelector('.ld-shot.is-on')?.getAttribute('src')]`,
      );
      if (picked[0] !== "Transform" || !picked[1]?.includes("transform"))
        issues.push("pill did not switch: " + picked);
      await h.sleep(4600);
      const stayed = await h.ev(`document.querySelector('.ld-pill.is-on')?.innerText`);
      if (stayed !== "Transform") issues.push("slideshow kept going after a pill click");
    }
  } catch (e) {
    issues.push(String(e));
  } finally {
    await h.close();
  }
  if (issues.length) {
    failures++;
    console.log(`${tag}: FAIL`);
    issues.forEach((i) => console.log("  " + i));
  } else console.log(`${tag}: PASS`);
}
process.exitCode = failures ? 1 : 0;
