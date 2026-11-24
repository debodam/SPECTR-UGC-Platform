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
