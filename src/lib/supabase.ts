import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "") as string;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "") as string;

// Lazy singleton — only created in the browser. Supabase's realtime client
// tries to open a WebSocket on initialization, which throws in Node.js 20
// (no native WebSocket). All Supabase calls are inside useEffect so this
// is safe: the client is never needed during SSR.
let _client: SupabaseClient | null = null;

/** The signed-in user's access token, sent to server functions that spend paid API calls. */
export async function accessToken(): Promise<string | undefined> {
  try {
    const { data } = await getClient().auth.getSession();
    return data.session?.access_token;
  } catch {
    return undefined;
  }
}

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
}

// Proxy that defers client creation until first property access.
// On the server, no property is ever accessed (useEffect doesn't run),
// so createClient is never called and WebSocket is never touched.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});

export default supabase;
