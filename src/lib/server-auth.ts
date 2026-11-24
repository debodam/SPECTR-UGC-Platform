import { createClient } from "@supabase/supabase-js";

/**
 * Server only. Confirms a request comes from a signed-in user before it spends paid API calls.
 * The token is the caller's Supabase access token; it is checked against Supabase Auth.
 */
export async function isSignedIn(token: unknown): Promise<boolean> {
  if (typeof token !== "string" || token.length < 20 || token.length > 8000) return false;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  try {
    const client = createClient(url, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.getUser(token);
    return !error && !!data.user;
  } catch {
    return false;
  }
}

/** Rejects payloads that are not plain objects or are far larger than any real request. */
export function checkPayload<T>(v: unknown, maxChars = 400_000): T {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Invalid request");
  if (JSON.stringify(v).length > maxChars) throw new Error("Request too large");
  return v as T;
}

const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;

/**
 * Server only. The first check on every AI endpoint:
 * - refuses any request that says it comes from the demo (a body flag or the x-spectr-demo header), so a modified
 *   demo client still cannot spend tokens;
 * - limits each IP to `perMinute` AI calls, in memory, as a second layer behind sign-in.
 * Returns a reason to refuse, or null to continue.
 */
export async function aiGate(data: unknown, perMinute = 20): Promise<string | null> {
  if (data && typeof data === "object" && "demo" in data) return "Not available in demo";
  try {
    const { getRequestHeader, getRequestIP } = await import("@tanstack/react-start/server");
    if (getRequestHeader("x-spectr-demo")) return "Not available in demo";
    const ip = getRequestIP({ xForwardedFor: true }) || "unknown";
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= perMinute) return "Too many requests (429). Wait a minute and try again.";
    recent.push(now);
    if (hits.size > 5000) hits.clear();
    hits.set(ip, recent);
  } catch {
    /* no request context (tests): sign-in is still required */
  }
  return null;
}
