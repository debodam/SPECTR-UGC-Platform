// Regenerates the landing page screenshots from the live demo (Fastbreak AI data), so they never go stale.
//   npm run shots:landing      (needs the dev server: npm run dev, and Google Chrome)
// Each shot: 1440x900 viewport at deviceScaleFactor 2, demo banner and tour hidden, the app area captured as WebP
// at 1600px wide into public/landing/. Every file must stay under 250 KB.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { launch } from "../e2e/harness.mjs";

const OUT = path.resolve("public/landing");
const W = 1440,
  H = 900,
  TARGET_W = 1600,
  MAX_BYTES = 250 * 1024;
fs.mkdirSync(OUT, { recursive: true });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spectr-shots-"));
const h = await launch({ out: tmp, width: W, height: H, port: 9620 });
await h.send("Emulation.setDeviceMetricsOverride", {
  width: W,
  height: H,
  deviceScaleFactor: 2,
  mobile: false,
});

// Hide the demo chrome, and give the app the full window as if there were no banner.
const HIDE = `(() => { if (document.getElementById('shots-css')) return;
  const s = document.createElement('style'); s.id = 'shots-css';
  s.textContent = '.demo-bar, .demo-tour, .demo-resume, [data-sonner-toaster] { display: none !important; } html.demo-on { --demo-banner-h: 0px !important; } .spectr-page-in { animation: none !important; opacity: 1 !important; }';
  document.head.appendChild(s); })()`;
const go = async (p, wait = 2600) => {
  await h.go(p, wait);
  await h.ev(HIDE);
  await h.sleep(400);
};
const clickSel = async (sel) => {
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

/** Captures the whole app area as WebP at TARGET_W wide, lowering quality until it fits the size budget. */
const shoot = async (name) => {
  let quality = 86,
    bytes;
  for (;;) {
    const r = await h.send("Page.captureScreenshot", {
      format: "webp",
      quality,
      // Output width = width * scale * deviceScaleFactor. Rendering at the target scale keeps text crisp.
      clip: { x: 0, y: 0, width: W, height: H, scale: TARGET_W / (W * 2) },
    });
    bytes = Buffer.from(r.result.data, "base64");
    if (bytes.length <= MAX_BYTES || quality <= 50) break;
    quality -= 6;
  }
  fs.writeFileSync(path.join(OUT, `${name}.webp`), bytes);
  console.log(`${name}.webp  ${Math.round(bytes.length / 1024)} KB  quality ${quality}`);
  if (bytes.length > MAX_BYTES) throw new Error(`${name}.webp is over 250 KB`);
};

try {
  await h.go("/demo", 4500);
  await h.ev(
    `sessionStorage.setItem('spectr-demo-tour', JSON.stringify({ i: 0, status: 'skipped' }))`,
  );

  await go("/");
  await shoot("dashboard");

  await go("/growth");
  await shoot("growth");

  await go("/record?play=demo-play-sixweek");
  await clickSel('[data-tour="sample-recording"]');
  await h.sleep(9000); // let the live transcript fill a few lines
  await h.ev(HIDE);
  await shoot("record");

  await go("/transform?play=demo-play-sixweek");
  await h.type(
    'textarea[aria-label="Source text"]',
    "Okay so here's my six week basketball training program. Fourteen guards ran it, and the average vertical went up three and a half inches.",
  );
  await clickSel('[data-tour="generate"]');
  await h.sleep(2600);
  await h.ev(`document.querySelector('.sx-main')?.scrollTo(0, 0)`);
  await shoot("transform");
} finally {
  await h.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
