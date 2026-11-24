import { useEffect, useState } from "react";
/**
 * Demo mode switch. The demo is per browser tab (sessionStorage) and is only ever turned on by /demo.
 * The real app never sets this flag, so none of the demo paths run for real users.
 */
const FLAG = "spectr-demo";

export const DEMO_KEYS = {
  db: "spectr-demo-db",
  state: "spectr-demo-state",
  tour: "spectr-demo-tour",
  /** Id of this demo run: the stored sandbox must carry the same id, or it is stale and gets reseeded. */
  run: "spectr-demo-run",
} as const;

export const DEMO_TIP = "Disabled in demo";

/**
 * Where the SPECTR logo links. In the demo it stays inside the app (the Dashboard); only Exit demo leads back to
 * the landing page. Read after mount so the server render and the first client render agree.
 */
export function useHomeLink(): "/" | "/dashboard" {
  const [demo, setDemo] = useState(false);
  useEffect(() => setDemo(isDemo()), []);
  return demo ? "/dashboard" : "/";
}

export function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

function clearDemoKeys() {
  for (const k of Object.values(DEMO_KEYS)) sessionStorage.removeItem(k);
  sessionStorage.removeItem("pendingTranscript");
}

/** Starts a fresh demo: wipes any previous demo data in this tab. */
export function startDemo() {
  clearDemoKeys();
  sessionStorage.setItem(FLAG, "1");
  sessionStorage.setItem(
    DEMO_KEYS.run,
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  );
  installDemoGuard();
  demoEvent("demo started");
}

export const DEMO_BLOCKED = "Not available in demo";

/** Thrown when something in the demo tries to reach the AI or the database. */
export class DemoBlockedError extends Error {
  constructor() {
    super(DEMO_BLOCKED);
    this.name = "DemoBlockedError";
  }
}

let lastNotice = 0;
/** A calm note, at most once every few seconds, when the demo stops a call. */
export function noteDemoBlocked() {
  if (typeof window === "undefined" || Date.now() - lastNotice < 4000) return;
  lastNotice = Date.now();
  void import("sonner").then(({ toast }) =>
    toast.message(DEMO_BLOCKED, {
      description: "The demo runs on sample data, so nothing is sent anywhere.",
    }),
  );
}

/** Server functions (all AI calls go through them), Anthropic and Supabase. */
const BLOCKED_URL = [/\/_serverFn\//i, /anthropic\.com/i, /\.supabase\.(co|in)\b/i];

/**
 * The single network guard for demo mode. Once installed, any request to the app's server functions,
 * Anthropic or Supabase fails before it leaves the browser, so the demo cannot spend tokens or touch the backend
 * even if some code path forgets to check isDemo(). Blocked URLs are recorded for the e2e checks.
 */
export function installDemoGuard() {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    __spectrDemoGuard?: boolean;
    __spectrDemoBlocked?: string[];
    fetch: typeof fetch;
  };
  if (w.__spectrDemoGuard) return;
  w.__spectrDemoGuard = true;
  w.__spectrDemoBlocked = [];
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (isDemo() && BLOCKED_URL.some((r) => r.test(url))) {
      w.__spectrDemoBlocked!.push(url);
      demoEvent("blocked request", { url });
      noteDemoBlocked();
      return Promise.reject(new DemoBlockedError());
    }
    return original(input, init);
  };
  const send = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    const u = String(url);
    if (isDemo() && BLOCKED_URL.some((r) => r.test(u))) {
      w.__spectrDemoBlocked!.push(u);
      noteDemoBlocked();
      throw new DemoBlockedError();
    }
    return (send as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;
}

/** Leaves the demo and returns to the landing page with a full reload, so no demo state survives. */
export function exitDemo(to = "/") {
  demoEvent("demo exited");
  clearDemoKeys();
  sessionStorage.removeItem(FLAG);
  window.location.assign(to);
}

/** Lightweight local event log. Nothing is sent anywhere. */
export function demoEvent(name: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __spectrDemoLog?: { at: string; name: string }[] };
  (w.__spectrDemoLog ??= []).push({ at: new Date().toISOString(), name, ...data });
  console.info(`[demo] ${name}`, data ?? "");
}
