// Headless Chrome + CDP harness with a fake local session and an in-memory Supabase REST mock.
// Nothing reaches the real Supabase project: every *.supabase.co request is answered here.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const GROWTH = ["growth_plans", "plays", "experiments", "insights"];
const LINK_COLS = ["play_id", "variant"];

export async function launch({
  out,
  port = 9340,
  migrated = false,
  width = 1440,
  height = 900,
  seed = {},
  storePatch = {},
}) {
  const profile = fs.mkdtempSync(path.join(out, "chrome-"));
  const chrome = spawn(
    process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let t;
  for (let i = 0; i < 60; i++) {
    try {
      t = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      break;
    } catch {
      await sleep(200);
    }
  }
  const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method) listeners.forEach((l) => l(m));
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const ev = async (expr) => {
    const r = await send("Runtime.evaluate", {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.result?.exceptionDetails)
      throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };

  // ── in-memory DB ──
  const db = {
    companies: [{ id: "c0000000-0000-0000-0000-000000000001", name: "Vivordo", logo_url: null }],
    workspaces: [
      {
        id: "w0000000-0000-0000-0000-000000000001",
        company_id: "c0000000-0000-0000-0000-000000000001",
        user_id: "00000000-0000-0000-0000-000000000001",
      },
    ],
    perf_entries: [],
    queue_items: [],
    transcripts: [],
    generations: [],
    saved_contexts: [],
    profiles: [],
    growth_plans: [],
    plays: [],
    experiments: [],
    insights: [],
    ...seed,
  };
  const log = [];
  const failWrites = new Set(); // tables whose writes return a 500, for failure-path tests

  function matchFilters(row, params) {
    for (const [k, v] of params) {
      if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
      const [op, ...rest] = v.split(".");
      const val = rest.join(".");
      const cell = row[k];
      if (op === "eq" && String(cell) !== val) return false;
      if (op === "in") {
        const list = val
          .replace(/^\(|\)$/g, "")
          .split(",")
          .map((s) => s.replace(/^"|"$/g, ""));
        if (!list.includes(String(cell))) return false;
      }
    }
    return true;
  }
  function handle(method, url, body, headers) {
    const u = new URL(url);
    const m = u.pathname.match(/\/rest\/v1\/([a-z_]+)/);
    if (!m) return { status: 200, body: "{}" };
    const table = m[1];
    log.push(`${method} ${table}`);
    if (!migrated && GROWTH.includes(table))
      return {
        status: 404,
        body: JSON.stringify({
          code: "PGRST205",
          message: `Could not find the table 'public.${table}' in the schema cache`,
        }),
      };
    db[table] = db[table] || [];
    const params = [...u.searchParams.entries()];
    const wantsObject = (headers.Accept || headers.accept || "").includes("vnd.pgrst.object");
    const rows = () => db[table].filter((r) => matchFilters(r, params));
    const reply = (list) => {
      if (wantsObject)
        return list.length
          ? { status: 200, body: JSON.stringify(list[0]) }
          : { status: 406, body: JSON.stringify({ code: "PGRST116", message: "no rows" }) };
      return { status: 200, body: JSON.stringify(list) };
    };
    if (method === "GET" || method === "HEAD") {
      let list = rows();
      const order = u.searchParams.get("order");
      if (order) {
        const [col, dir] = order.split(",")[0].split(".");
        list = [...list].sort(
          (a, b) => String(a[col]).localeCompare(String(b[col])) * (dir === "desc" ? -1 : 1),
        );
      }
      const lim = Number(u.searchParams.get("limit") || 0);
      if (lim) list = list.slice(0, lim);
      return reply(list);
    }
    if (failWrites.has(table))
      return { status: 500, body: JSON.stringify({ code: "XX000", message: "simulated failure" }) };
    const payload = body ? JSON.parse(body) : {};
    const items = Array.isArray(payload) ? payload : [payload];
    if (!migrated && !GROWTH.includes(table)) {
      const bad = items.find((it) => LINK_COLS.some((c) => c in it));
      if (bad) {
        const c = LINK_COLS.find((c) => c in bad);
        return {
          status: 400,
          body: JSON.stringify({
            code: "PGRST204",
            message: `Could not find the '${c}' column of '${table}' in the schema cache`,
          }),
        };
      }
    }
    if (method === "POST") {
      const upsert = (headers.Prefer || headers.prefer || "").includes("merge-duplicates");
      const out = items.map((it) => {
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...it };
        if (upsert) {
          const i = db[table].findIndex((r) => r.id === row.id);
          if (i >= 0) {
            db[table][i] = { ...db[table][i], ...row };
            return db[table][i];
          }
        }
        db[table].push(row);
        return row;
      });
      return reply(out);
    }
    if (method === "PATCH") {
      const hit = rows();
      hit.forEach((r) => Object.assign(r, payload));
      return reply(hit);
    }
    if (method === "DELETE") {
      const hit = new Set(rows());
      db[table] = db[table].filter((r) => !hit.has(r));
      return reply([...hit]);
    }
    return { status: 200, body: "[]" };
  }

  listeners.push(async (m) => {
    if (m.method !== "Fetch.requestPaused") return;
    const p = m.params;
    if (p.request.method === "OPTIONS") {
      await send("Fetch.fulfillRequest", {
        requestId: p.requestId,
        responseCode: 204,
        responseHeaders: [
          { name: "Access-Control-Allow-Origin", value: "*" },
          { name: "Access-Control-Allow-Headers", value: "*" },
          { name: "Access-Control-Allow-Methods", value: "*" },
        ],
      });
      return;
    }
    const r = handle(p.request.method, p.request.url, p.request.postData, p.request.headers || {});
    await send("Fetch.fulfillRequest", {
      requestId: p.requestId,
      responseCode: r.status,
      responseHeaders: [
        { name: "Content-Type", value: "application/json" },
        { name: "Access-Control-Allow-Origin", value: "*" },
        { name: "Access-Control-Expose-Headers", value: "*" },
      ],
      body: Buffer.from(r.body).toString("base64"),
    });
  });

  await send("Page.enable");
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "*supabase.co*", requestStage: "Request" }],
  });
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 500,
  });

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-0000-0000-000000000001", exp, role: "authenticated" })}.test`;
  const session = {
    access_token: jwt,
    refresh_token: "test",
    token_type: "bearer",
    expires_in: 86400,
    expires_at: exp,
    user: {
      id: "00000000-0000-0000-0000-000000000001",
      aud: "authenticated",
      role: "authenticated",
      email: "demo@example.test",
      user_metadata: { name: "Debo Dam" },
      app_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
  const store = {
    workspace: {
      companyId: "c0000000-0000-0000-0000-000000000001",
      companyName: "Vivordo",
      industry: "Wellness",
      companyDescription: "Corporate wellness programs that cut burnout for mid-size teams.",
      goalDescription: "Become the go-to wellness voice for HR leaders",
      audience: {
        jobTitles: "HR Director, People Ops Lead",
        seniority: "Director",
        companySize: "51-200",
        description: "",
      },
      baseline: {
        followers: "54",
        weeklyImpressions: "0",
        engagementRate: "",
        followerGrowth: "",
        monthlyVisitors: "48",
        weeklyPageSearches: "44",
      },
      targets: {
        followers: "245",
        weeklyImpressions: "324",
        engagementRate: "4",
        followerGrowth: "",
        monthlyVisitors: "123",
        weeklyPageSearches: "122",
      },
    },
    setupComplete: true,
    setupStep: 5,
    entries: [],
    queue: [],
    ...storePatch,
  };
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
    // Stand-in speech recognizer: "hears" one sentence, then ends when stopped.
    window.webkitSpeechRecognition = window.SpeechRecognition = class {
      start() { setTimeout(() => { this.onstart?.(); this.onaudiostart?.(); }, 50);
        setTimeout(() => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "We started Vivordo because HR leaders kept burning out before their teams did." }], { isFinal: true })] }), 400); }
      stop() { setTimeout(() => this.onend?.(), 30); }
      abort() { this.stop(); }
    };
    if (!sessionStorage.getItem('__seeded')) {
      localStorage.setItem('sb-guaxvpritsajidqdsmpr-auth-token', ${JSON.stringify(JSON.stringify(session))});
      localStorage.setItem('spectr-state-v1', ${JSON.stringify(JSON.stringify(store))});
      localStorage.setItem('spectr-access-verified', 'true');
      sessionStorage.setItem('__seeded', '1');
    }`,
  });

  const shot = async (name, full = false) => {
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full });
    fs.writeFileSync(path.join(out, name), Buffer.from(r.result.data, "base64"));
  };
  const go = async (p, wait = 1800) => {
    await send("Page.navigate", { url: (process.env.E2E_BASE || "http://localhost:5173") + p });
    await sleep(wait);
  };
  const click = async (selectorOrText, wait = 800) => {
    const ok = await ev(`(() => {
      const q = ${JSON.stringify(selectorOrText)};
      let el = q.startsWith('text=') ? [...document.querySelectorAll('button, a, [role=button]')].find(e => e.innerText.trim().startsWith(q.slice(5))) : document.querySelector(q);
      if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`);
    if (!ok) throw new Error("click target not found: " + selectorOrText);
    await sleep(wait);
  };
  const type = async (selector, text) => {
    await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus();
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(text)});
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  };
  const close = async () => {
    ws.close();
    chrome.kill();
    await sleep(400);
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {}
  };
  const consoleErrors = [];
  await send("Runtime.enable");
  listeners.push((m) => {
    if (m.method === "Runtime.exceptionThrown")
      consoleErrors.push(m.params.exceptionDetails?.exception?.description?.slice(0, 200));
  });
  return { send, ev, shot, go, click, type, sleep, close, db, log, consoleErrors, failWrites };
}
