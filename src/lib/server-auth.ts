/**
 * Server only. Supabase is called over plain REST here, never through supabase-js: creating a supabase-js client
 * on the server opens its realtime WebSocket, which throws on Node 20 (Vercel's runtime has no native WebSocket).
 */
const supabaseUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = () => process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

/** The signed-in user's id for a Supabase access token, or null when the token is missing or invalid. */
export async function userIdFor(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 8000) return null;
  const url = supabaseUrl();
  const anon = anonKey();
  if (!url || !anon) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return user.id ?? null;
  } catch {
    return null;
  }
}

/** Confirms a request comes from a signed-in user before it spends paid API calls. */
export async function isSignedIn(token: unknown): Promise<boolean> {
  return (await userIdFor(token)) !== null;
}

/** Deletes an auth user with the service role key (their rows cascade). */
export async function deleteAuthUser(
  userId: string,
  serviceRoleKey: string,
): Promise<string | null> {
  const url = supabaseUrl();
  if (!url) return "SUPABASE_URL is not configured on the server.";
  try {
    const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string };
    return body.msg || body.message || `Delete failed (${res.status})`;
  } catch (e) {
    return e instanceof Error ? e.message : "Delete failed";
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
