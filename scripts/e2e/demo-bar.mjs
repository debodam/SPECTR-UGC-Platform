// Checks that the demo banner fits at narrow and wide screens: nothing scrolls inside it and every child stays
// inside its box. Screenshots land in design/e2e/demo-bar/.
//   node scripts/e2e/demo-bar.mjs        (needs the dev server and Google Chrome)
import fs from "node:fs";
import path from "node:path";
import { launch } from "./harness.mjs";

const out = path.resolve("design/e2e/demo-bar");
fs.mkdirSync(out, { recursive: true });
const widths = [360, 390, 600, 820, 1440];
let failures = 0;

for (const width of widths) {
  const height = width < 700 ? 844 : 900;
  const h = await launch({ out, width, height, port: 9750 + (width % 47) });
  const issues = [];
  try {
    await h.go("/demo", 4500);
    const r = await h.ev(`(() => {
      const bar = document.querySelector('.demo-bar'); if (!bar) return null;
      const b = bar.getBoundingClientRect();
      const kids = [...bar.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; });
      const outside = kids.filter(e => { const r = e.getBoundingClientRect();
        return r.left < b.left - 0.5 || r.right > b.right + 0.5 || r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5; })
        .map(e => (e.tagName + '.' + String(e.className || '')).slice(0, 40));
      return { fits: bar.scrollWidth <= bar.clientWidth, docFits: document.documentElement.scrollWidth <= innerWidth,
        outside, height: Math.round(b.height), buttons: [...bar.querySelectorAll('button, a')].length };
    })()`);
    if (!r) issues.push("no demo bar");
    else {
      if (!r.fits) issues.push("the bar scrolls sideways");
      if (!r.docFits) issues.push("the page scrolls sideways");
      if (r.outside.length) issues.push("outside the bar: " + r.outside.join(", "));
    }
    await h.shot(`${width}.png`);
  } catch (e) {
    issues.push(String(e));
  } finally {
    await h.close();
  }
  if (issues.length) {
    failures++;
    console.log(`${width}px: FAIL ${issues.join(" / ")}`);
  } else console.log(`${width}px: PASS`);
}
process.exitCode = failures ? 1 : 0;
