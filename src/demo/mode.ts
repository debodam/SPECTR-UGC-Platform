/**
 * Demo mode switch. The demo is per browser tab (sessionStorage) and is only ever turned on by /demo.
 * The real app never sets this flag, so none of the demo paths run for real users.
 */
const FLAG = "spectr-demo";

export const DEMO_KEYS = {
  db: "spectr-demo-db",
  state: "spectr-demo-state",
  tour: "spectr-demo-tour",
  live: "spectr-demo-live-count",
} as const;

export const DEMO_TIP = "Disabled in demo";

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
  demoEvent("demo started");
}

/** Leaves the demo and returns to the landing page with a full reload, so no demo state survives. */
export function exitDemo(to = "/welcome") {
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
