// Full growth loop, end to end, with a screenshot at every step.
// Needs the dev server (npm run dev) and Google Chrome. Supabase is mocked in memory; nothing real is touched.
//   node scripts/e2e/full-loop.mjs              (database without the growth migrations)
//   node scripts/e2e/full-loop.mjs migrated     (database with migrations 009 to 011 applied)
// Screenshots land in design/e2e/<mode>/.
import fs from "node:fs";
import path from "node:path";
import { launch } from "./harness.mjs";

const migrated = process.argv[2] === "migrated";
const out = path.resolve("design/e2e", migrated ? "migrated" : "unmigrated");
fs.mkdirSync(out, { recursive: true });
const h = await launch({ out, migrated, port: 9351 });
const R = { mode: migrated ? "migrated" : "unmigrated", steps: [] };
const step = (name, ok, detail) => R.steps.push({ step: name, ok: !!ok, detail });
const text = (sel) => h.ev(`document.querySelector(${JSON.stringify(sel)})?.innerText ?? null`);
const setVal = (sel, v) =>
  h.ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const p = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(p, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); })()`);

try {
  // 1. Dashboard builds a growth plan.
  await h.go("/dashboard", 6000);
  const plan = await text(".gp-card");
  step("Dashboard shows a growth plan", plan && !/Could not/.test(plan), plan?.slice(0, 120));
  await h.shot("01-dashboard.png");

  // 2. Growth plan page.
  await h.go("/growth", 2500);
  const plays = await h.ev(`document.querySelectorAll('.gh-play').length`);
  step("Growth plan lists plays", plays > 0, `${plays} plays`);
  await h.shot("02-growth.png");

  // 3. Start the first play: lands on Record or Transform with the play linked.
  await h.click(".gh-play .gh-btn--primary", 2500);
  const playUrl = await h.ev("location.pathname + location.search");
  const playId = new URLSearchParams(playUrl.split("?")[1] || "").get("play");
  step("Starting a play links it", !!playId, playUrl);
  await h.go(`/record?play=${playId}`, 2500);
  await h.shot("03-record.png");

  // 4. Record with the stand-in recognizer, then save.
  await h.click(".mo", 1500);
  await h.click(".mo", 1200);
  const transcript = await h.ev(`document.body.innerText.includes('HR leaders kept burning out')`);
  step("Recording produces a transcript", transcript);
  await h.click("text=Save", 1500);
  step("Transcript saved", h.db.transcripts.length > 0, `${h.db.transcripts.length} rows`);
  await h.shot("04-record-saved.png");

  // 5. Paste fallback.
  await h.go(`/record?play=${playId}`, 2000);
  await h.click("text=Paste or type instead", 500);
  await h.click(".gx-dialog .gh-btn--ghost", 300);
  const typedErr = await text(".gx-dialog .ds-err");
  step("Paste dialog validates empty text", typedErr === "Add some text first", typedErr);
  await setVal(
    "#rc-typed",
    "Notes from a call: HR teams lose a week to manual approvals every quarter.",
  );
  await h.shot("05-paste.png");
  await h.click(".gx-dialog .gh-btn--primary", 2500);
  const tfUrl = await h.ev("location.pathname");
  step("Paste dialog hands off to Transform", tfUrl === "/transform", tfUrl);

  // 6. Transform. Without an API key the error must be calm and offer a retry.
  const src = await h.ev(
    `document.querySelector('textarea[placeholder^="Paste your transcript"]')?.value?.slice(0, 30)`,
  );
  step("Transform is prefilled", !!src, src);
  await h.click("text=Generate", 8000);
  const tfErr = await text(".tf-err");
  const tfOut = await h.ev(`document.querySelectorAll('[data-tf-output]').length`);
  step(
    "Transform returns output or a friendly error",
    tfOut > 0 || (tfErr && !/ANTHROPIC_API_KEY|\.env|undefined|stack|Error:/.test(tfErr)),
    tfErr || "output shown",
  );
  await h.shot("06-transform.png");

  // 7. Distribute: queue a post due a minute ago, copy it, mark it posted.
  await h.send("Browser.grantPermissions", {
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
    origin: process.env.E2E_BASE || "http://localhost:5173",
  });
  await h.go(`/distribute?play=${playId}`, 2500);
  if (!(await h.ev(`!!document.querySelector('#ds-title')`)))
    await h.click("text=Add to queue", 500);
  const past = new Date(Date.now() - 60_000);
  await setVal("#ds-title", "Why approvals stall HR teams");
  await setVal(
    "#ds-content",
    "HR teams lose a week each quarter to manual approvals. Here is the fix we use.",
  );
  await setVal("#ds-date", past.toISOString().slice(0, 10));
  await setVal("#ds-time", past.toTimeString().slice(0, 5));
  await h.click(".ds-form .gh-btn--primary", 1500);
  const badge = await text(".ds-item .ds-badge");
  step("Queued post is due", /due/i.test(badge || ""), badge);
  // A real mouse click, so the page gets the user activation the clipboard needs.
  const box = await h.ev(
    `(() => { const b = [...document.querySelectorAll('.ds-actions button')].find(e => e.innerText.startsWith('Copy post')); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
  );
  for (const type of ["mousePressed", "mouseReleased"])
    await h.send("Input.dispatchMouseEvent", {
      type,
      x: box.x,
      y: box.y,
      button: "left",
      clickCount: 1,
    });
  await h.sleep(500);
  const copied = await h.ev(`[...document.querySelectorAll('.ds-actions button')][0]?.innerText`);
  step("Copy post works", copied === "Copied", copied);
  await h.shot("07-distribute.png");
  await h.click("text=Mark as posted", 1800);
  step("Mark as posted moves it", !!(await text(".ds-posted-row")));

  // 8. Results: the pending entry, validation, then logging numbers.
  await h.go("/results", 2500);
  const pending = await h.ev(`document.querySelectorAll('.rs-pending-row').length`);
  step("Results shows a pending entry", pending > 0, `${pending} pending`);
  await h.click("text=Log numbers", 600);
  await h.click("text=Save results", 400);
  const errs = await h.ev(`[...document.querySelectorAll('.gx-dialog .ds-err')].length`);
  step("Result sheet validates", errs >= 2, `${errs} field errors`);
  await setVal("#rs-imp", "2400");
  await setVal("#rs-eng", "5.1");
  await setVal("#rs-fol", "31");
  await h.click("text=Save results", 2500);
  step("Numbers logged", !!(await text(".tr-row")));
  await h.shot("08-results.png");

  // 9. Back on the Dashboard.
  await h.go("/dashboard", 3000);
  await h.shot("09-dashboard-after.png");
  step("No uncaught errors", h.consoleErrors.length === 0, h.consoleErrors.join(" / ") || "none");
} catch (e) {
  step("Run finished", false, String(e));
  await h.shot("fail.png");
} finally {
  await h.close();
  const failed = R.steps.filter((s) => !s.ok);
  for (const s of R.steps)
    console.log(`${s.ok ? "PASS" : "FAIL"}  ${s.step}${s.detail ? `  (${s.detail})` : ""}`);
  console.log(`\n${R.steps.length - failed.length}/${R.steps.length} passed. Screenshots: ${out}`);
  process.exitCode = failed.length ? 1 : 0;
}
