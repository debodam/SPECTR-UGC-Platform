/**
 * In-memory stand-in for the Supabase client, used only in demo mode. It supports the query builder calls the app
 * makes (select, insert, update, upsert, delete, eq, in, order, limit, single, maybeSingle) over the seeded tables,
 * persists to sessionStorage, and never makes a network request.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDemoTables, type DemoRow, type DemoTables } from "./data";
import { demoSeed } from "./data";
import { DEMO_KEYS, DEMO_TIP } from "./mode";

/** Bump when the seed or the table shapes change, so an older stored sandbox is never reused. */
const DB_VERSION = 3;

let tables: DemoTables | null = null;
let tablesRun = "";

const currentRun = () => sessionStorage.getItem(DEMO_KEYS.run) || "";

/**
 * The sandbox for this demo run. A stored copy is only reused if it has the same version and run id; anything
 * else (an earlier visit, an older build) is replaced by a fresh copy of the seed.
 */
function db(): DemoTables {
  const run = currentRun();
  if (tables && tablesRun === run) return tables;
  tables = null;
  try {
    const raw = sessionStorage.getItem(DEMO_KEYS.db);
    const stored = raw
      ? (JSON.parse(raw) as { v?: number; run?: string; tables?: DemoTables })
      : null;
    if (stored?.v === DB_VERSION && stored.run === run && stored.tables) tables = stored.tables;
  } catch {
    tables = null;
  }
  tablesRun = run;
  if (!tables) {
    tables = buildDemoTables(new Date());
    persist();
  }
  return tables;
}

/** One row of the sandbox, read directly (the tour uses it to follow what the visitor has done). */
export function demoRow(table: string, id: string): DemoRow | undefined {
  try {
    return db()[table]?.find((r) => r.id === id);
  } catch {
    return undefined;
  }
}

function writeNow() {
  flushQueued = false;
  try {
    sessionStorage.setItem(DEMO_KEYS.db, JSON.stringify({ v: DB_VERSION, run: tablesRun, tables }));
  } catch {
    /* storage full or blocked: the demo keeps working in memory */
  }
}

let flushQueued = false;
/**
 * Saves the sandbox to this tab's sessionStorage. Writes are coalesced into idle time, so a click that changes
 * several rows serializes the tables once, after the frame, instead of on every change. Leaving the page
 * flushes immediately.
 */
function persist() {
  if (flushQueued) return;
  flushQueued = true;
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  };
  if (w.requestIdleCallback) w.requestIdleCallback(writeNow, { timeout: 400 });
  else window.setTimeout(writeNow, 50);
}
if (typeof window !== "undefined")
  window.addEventListener("pagehide", () => {
    if (flushQueued) writeNow();
  });

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;

type Op = "select" | "insert" | "update" | "upsert" | "delete";
type Result = {
  data: unknown;
  error: { message: string; code?: string } | null;
  count: null;
  status: number;
};

const pick = (row: DemoRow, cols: string) => {
  if (!cols || cols.trim() === "*") return { ...row };
  const out: DemoRow = {};
  for (const c of cols
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean))
    out[c] = row[c] ?? null;
  return out;
};

class Query implements PromiseLike<Result> {
  private op: Op = "select";
  private cols = "*";
  private returning = false;
  private filters: ((r: DemoRow) => boolean)[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private max = 0;
  private mode: "many" | "single" | "maybe" = "many";
  private payload: DemoRow[] | DemoRow = [];
  private conflict = "id";

  constructor(private table: string) {}

  select(cols = "*") {
    if (this.op === "select") this.cols = cols;
    else {
      this.returning = true;
      this.cols = cols;
    }
    return this;
  }
  insert(rows: DemoRow | DemoRow[]) {
    this.op = "insert";
    this.payload = rows;
    return this;
  }
  upsert(rows: DemoRow | DemoRow[], opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = rows;
    if (opts?.onConflict) this.conflict = opts.onConflict;
    return this;
  }
  update(patch: DemoRow) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, v: unknown) {
    this.filters.push((r) => r[col] === v || String(r[col]) === String(v));
    return this;
  }
  neq(col: string, v: unknown) {
    this.filters.push((r) => r[col] !== v);
    return this;
  }
  in(col: string, list: unknown[]) {
    this.filters.push((r) => list.map(String).includes(String(r[col])));
    return this;
  }
  is(col: string, v: unknown) {
    this.filters.push((r) => (r[col] ?? null) === v);
    return this;
  }
  gte(col: string, v: unknown) {
    this.filters.push((r) => String(r[col]) >= String(v));
    return this;
  }
  lte(col: string, v: unknown) {
    this.filters.push((r) => String(r[col]) <= String(v));
    return this;
  }
  match(obj: DemoRow) {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  private rows() {
    const t = db();
    return (t[this.table] ??= []);
  }

  private shape(list: DemoRow[]): Result {
    let out = list;
    for (const o of [...this.orders].reverse())
      out = [...out].sort((a, b) => {
        const x = a[o.col] as string | number,
          y = b[o.col] as string | number;
        const c =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x ?? "").localeCompare(String(y ?? ""));
        return o.asc ? c : -c;
      });
    if (this.max) out = out.slice(0, this.max);
    out = out.map((r) => pick(r, this.cols));
    if (this.mode === "many") return { data: out, error: null, count: null, status: 200 };
    if (!out.length)
      return this.mode === "maybe"
        ? { data: null, error: null, count: null, status: 200 }
        : {
            data: null,
            error: { message: "No rows found", code: "PGRST116" },
            count: null,
            status: 406,
          };
    return { data: out[0], error: null, count: null, status: 200 };
  }

  private run(): Result {
    const all = this.rows();
    const hit = (r: DemoRow) => this.filters.every((f) => f(r));
    const now = new Date().toISOString();
    if (this.op === "select") return this.shape(all.filter(hit));
    if (this.op === "insert" || this.op === "upsert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const keys = this.conflict.split(",").map((s) => s.trim());
      const written = items.map((it) => {
        if (this.op === "upsert") {
          const existing = all.find((r) =>
            keys.every((k) => it[k] !== undefined && r[k] === it[k]),
          );
          if (existing) return Object.assign(existing, it);
        }
        const row: DemoRow = { id: uuid(), created_at: now, ...it };
        all.push(row);
        return row;
      });
      persist();
      return this.returning || this.mode !== "many"
        ? this.shape(written)
        : { data: null, error: null, count: null, status: 201 };
    }
    if (this.op === "update") {
      const list = all.filter(hit);
      for (const r of list) Object.assign(r, this.payload);
      persist();
      return this.returning
        ? this.shape(list)
        : { data: null, error: null, count: null, status: 204 };
    }
    const gone = all.filter(hit);
    const t = db();
    t[this.table] = all.filter((r) => !hit(r));
    persist();
    return this.returning
      ? this.shape(gone)
      : { data: null, error: null, count: null, status: 204 };
  }

  then<A = Result, B = never>(
    onOk?: ((v: Result) => A | PromiseLike<A>) | null,
    onErr?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    let result: Result;
    try {
      result = this.run();
    } catch (e) {
      result = {
        data: null,
        error: { message: e instanceof Error ? e.message : "Demo error" },
        count: null,
        status: 500,
      };
    }
    return Promise.resolve(result).then(onOk, onErr);
  }
}

function demoSession() {
  const u = demoSeed().user;
  const exp = Math.floor(Date.now() / 1000) + 86400;
  return {
    access_token: "demo",
    refresh_token: "demo",
    token_type: "bearer",
    expires_in: 86400,
    expires_at: exp,
    user: {
      id: u.id,
      aud: "authenticated",
      role: "authenticated",
      email: u.email,
      user_metadata: { name: u.name },
      app_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

const disabled = async () => ({
  data: { user: null, session: null },
  error: { message: DEMO_TIP },
});

export function createDemoClient(): SupabaseClient {
  const client = {
    from: (table: string) => new Query(table),
    auth: {
      getSession: async () => ({ data: { session: demoSession() }, error: null }),
      getUser: async () => ({ data: { user: demoSession().user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
      signInWithPassword: disabled,
      signUp: disabled,
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: DEMO_TIP } }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        remove: async () => ({ data: null, error: null }),
      }),
    },
  };
  return client as unknown as SupabaseClient;
}
