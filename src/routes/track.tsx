import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useApp, type PerfEntry, type Format } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";

export const Route = createFileRoute("/track")({ component: TrackPage });

const FORMATS: Format[] = ["Article", "Post", "Video Script"];
const SOURCES = ["Transcript", "Notes", "Draft"] as const;
const COLS = "84px 1.5fr 110px 100px 92px 66px 82px 1.2fr 76px";

// --- DB conversions ---

function fromRow(row: Record<string, unknown>): PerfEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    title: row.title as string,
    format: row.format as Format,
    source: row.source as PerfEntry["source"],
    impressions: Number(row.impressions ?? 0),
    engagementRate: Number(row.engagement_rate ?? 0),
    followersGained: Number(row.followers_gained ?? 0),
    notes: (row.notes as string) || "",
  };
}

function toRow(e: PerfEntry, companyId: string, userId: string) {
  return {
    id: e.id, company_id: companyId, user_id: userId,
    date: e.date, title: e.title, format: e.format, source: e.source,
    impressions: e.impressions, engagement_rate: e.engagementRate,
    followers_gained: e.followersGained, notes: e.notes,
  };
}

function blank(): Partial<PerfEntry> {
  return { date: new Date().toISOString().slice(0, 10), title: "", format: "Article", source: "Transcript", impressions: 0, engagementRate: 0, followersGained: 0, notes: "" };
}

function avg(xs: number[]) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }

function sumByFormat(entries: PerfEntry[]) {
  const r: Record<Format, { imp: number; eng: number; count: number }> = {
    Article: { imp: 0, eng: 0, count: 0 },
    Post: { imp: 0, eng: 0, count: 0 },
    "Video Script": { imp: 0, eng: 0, count: 0 },
  };
  for (const e of entries) {
    if (e.format in r) { r[e.format].imp += e.impressions; r[e.format].eng += e.engagementRate; r[e.format].count += 1; }
  }
  return r;
}

// --- Nav ---

const NAV_ITEMS: { label: string; to: string; d1: string; d2: string; active?: boolean }[] = [
  { label: "Home", to: "/", d1: "M4 11l8-7 8 7", d2: "M6 10v10h12V10" },
  { label: "Transform", to: "/transform", d1: "M12 4l1.8 4.6L18.5 10l-4.7 1.4L12 16l-1.8-4.6L5.5 10l4.7-1.4z", d2: "M18 16v4M16 18h4" },
  { label: "Record", to: "/record", d1: "M9 4h6v8a3 3 0 0 1-6 0z", d2: "M6 11a6 6 0 0 0 12 0M12 17v3" },
  { label: "Track", to: "/track", d1: "M5 20V11M11 20V5M17 20v-7", d2: "M3 20h18", active: true },
  { label: "Distribute", to: "/distribute", d1: "M5 6h14v14H5z", d2: "M5 10h14M9 3v4M15 3v4" },
  { label: "Settings", to: "/settings", d1: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", d2: "M19 12l2-1-1-3-2.3.5-1.4-1.4.5-2.3-3-1-1 2h-2l-1-2-3 1 .5 2.3-1.4 1.4L3 8l-1 3 2 1v2l-2 1 1 3 2.3-.5 1.4 1.4-.5 2.3 3 1 1-2h2l1 2 3-1-.5-2.3 1.4-1.4L21 16l1-3-2-1z" },
];

// --- Shared glass card style ---
const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.4)",
  backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" as any,
  boxShadow: "0 10px 30px rgba(6,42,92,0.14)",
};

// --- Trend chart ---

function TrendChart({ entries, baseline }: { entries: PerfEntry[]; baseline: number }) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return (
      <div style={{ flex: 1, position: "relative", marginTop: 12 }}>
        <svg width="100%" height="100%" viewBox="0 0 430 190" preserveAspectRatio="none" style={{ position: "absolute", left: 0, top: 0 }}>
          <g stroke="rgba(255,255,255,0.22)" strokeWidth="1">
            <line x1="0" y1="20" x2="430" y2="20" /><line x1="0" y1="70" x2="430" y2="70" />
            <line x1="0" y1="120" x2="430" y2="120" /><line x1="0" y1="170" x2="430" y2="170" />
          </g>
        </svg>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "rgba(255,255,255,0.9)", textAlign: "center" }}>
          Log entries to see your follower trend.
        </div>
      </div>
    );
  }
  let acc = baseline;
  const pts = sorted.map((e) => { acc += e.followersGained; return acc; });
  const max = Math.max(...pts, baseline + 1);
  const min = Math.min(...pts, baseline);
  const W = 430, H = 190;
  const xs = pts.map((_, i) => 10 + (i / Math.max(1, pts.length - 1)) * (W - 20));
  const ys = pts.map((p) => H - 20 - ((p - min) / Math.max(1, max - min)) * (H - 40));
  const pathD = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const fillD = pathD + ` L${xs[xs.length - 1]},${H} L${xs[0]},${H}Z`;
  return (
    <div style={{ flex: 1, position: "relative", marginTop: 12 }}>
      <svg width="100%" height="100%" viewBox="0 0 430 190" preserveAspectRatio="none" style={{ position: "absolute", left: 0, top: 0 }}>
        <g stroke="rgba(255,255,255,0.22)" strokeWidth="1">
          <line x1="0" y1="20" x2="430" y2="20" /><line x1="0" y1="70" x2="430" y2="70" />
          <line x1="0" y1="120" x2="430" y2="120" /><line x1="0" y1="170" x2="430" y2="170" />
        </g>
        <path d={fillD} fill="rgba(255,255,255,0.14)" />
        <path d={pathD} fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// --- Main page ---

function TrackPage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const ws = state.workspace;
  const companyId = ws.companyId;
  const userId = state.user?.id;

  const [entries, setEntries] = useState<PerfEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  useEffect(() => {
    if (!companyId) { setLoadingEntries(false); return; }
    setLoadingEntries(true);
    supabase.from("perf_entries").select("*").eq("company_id", companyId).order("date", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Failed to load entries");
        else setEntries((data ?? []).map(fromRow));
        setLoadingEntries(false);
      });
  }, [companyId]);

  const currentFollowers = Number(ws.baseline.followers || 0) + entries.reduce((s, e) => s + e.followersGained, 0);

  const kpis = [
    { name: "Followers", current: currentFollowers, target: Number(ws.targets.followers || 0) },
    { name: "Weekly impressions", current: avg(entries.map(e => e.impressions)), target: Number(ws.targets.weeklyImpressions || 0) },
    { name: "Avg engagement rate", current: avg(entries.map(e => e.engagementRate)), target: Number(ws.targets.engagementRate || 0), suffix: "%" },
    { name: "Monthly profile visitors", current: Number(ws.baseline.monthlyVisitors || 0), target: Number(ws.targets.monthlyVisitors || 0) },
    { name: "Weekly page searches", current: Number(ws.baseline.weeklyPageSearches || 0), target: Number(ws.targets.weeklyPageSearches || 0) },
  ];

  const totals = useMemo(() => sumByFormat(entries), [entries]);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PerfEntry>>(blank());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!companyId || !userId) { toast.error("No active company"); return; }
    setSaving(true);
    const entry: PerfEntry = {
      id: editingId ?? crypto.randomUUID(),
      date: draft.date || new Date().toISOString().slice(0, 10),
      title: draft.title || "Untitled",
      format: (draft.format as Format) || "Article",
      source: (draft.source as PerfEntry["source"]) || "Transcript",
      impressions: Number(draft.impressions ?? 0),
      engagementRate: Number(draft.engagementRate ?? 0),
      followersGained: Number(draft.followersGained ?? 0),
      notes: draft.notes || "",
    };
    const { error } = await supabase.from("perf_entries").upsert(toRow(entry, companyId, userId));
    setSaving(false);
    if (error) { toast.error("Failed to save entry"); return; }
    setEntries(prev => [entry, ...prev.filter(e => e.id !== entry.id)].sort((a, b) => b.date.localeCompare(a.date)));
    setAdding(false); setEditingId(null); setDraft(blank()); toast.success("Entry saved");
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("perf_entries").delete().eq("id", id);
    if (error) { toast.error("Failed to delete entry"); return; }
    setEntries(prev => prev.filter(e => e.id !== id)); toast("Entry deleted");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const userName = state.user?.name ?? "";
  const userInitials = userName.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "U";
  const companyInitial = (ws.companyName || "C")[0].toUpperCase();

  const inStyle: React.CSSProperties = {
    height: 36, width: "100%", boxSizing: "border-box", padding: "0 10px",
    border: 0, borderRadius: 12, background: "rgba(255,255,255,0.18)",
    color: "#ffffff", fontFamily: "inherit", fontSize: 14,
  };

  const totalImpressionsForShare = FORMATS.reduce((s, f) => s + totals[f].imp, 0);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg,#b9d6f8 0%,#4d92e0 48%,#0a4a94 100%)",
      fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',Inter,'Segoe UI',sans-serif",
      color: "#ffffff",
    }}>
      <div style={{
        position: "relative", width: 1360, height: 880, borderRadius: 44, overflow: "hidden",
        background: "radial-gradient(700px 520px at 28% 52%,rgba(160,205,255,0.45),rgba(160,205,255,0) 70%),linear-gradient(150deg,#5b9be4 0%,#3a82dc 42%,#1a56a8 100%)",
        boxShadow: "0 0 0 6px rgba(255,255,255,0.92),0 50px 120px rgba(3,30,70,0.38)",
      }}>

        {/* Left rail */}
        <aside style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 88, boxSizing: "border-box", borderRight: "1px solid rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", alignItems: "center", padding: "26px 0" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24"><polygon points="12,3 21,21 12,21" fill="#0a66c2"/><polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55"/></svg>
          </div>
          <nav style={{ marginTop: "auto", marginBottom: "auto", padding: 8, borderRadius: 32, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.3)", display: "flex", flexDirection: "column", gap: 6 }}>
            {NAV_ITEMS.map((n) => (
              <button key={n.label} type="button" aria-label={n.label} title={n.label} onClick={() => navigate({ to: n.to as string })}
                style={{ width: 44, height: 44, borderRadius: "50%", border: 0, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", background: n.active ? "#0a66c2" : "transparent", color: n.active ? "#ffffff" : "rgba(255,255,255,0.9)", boxShadow: n.active ? "0 8px 20px rgba(6,42,92,0.35)" : "none" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={n.d1} /><path d={n.d2} />
                </svg>
              </button>
            ))}
          </nav>
          <button type="button" aria-label="Log out" title="Log out" onClick={handleLogout}
            style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/><path d="M16 8l4 4-4 4"/><path d="M20 12H9"/></svg>
          </button>
        </aside>

        {/* Header */}
        <header style={{ position: "absolute", left: 88, right: 0, top: 0, height: 88, boxSizing: "border-box", padding: "0 40px", borderBottom: "1px solid rgba(255,255,255,0.28)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: "-0.01em", lineHeight: 1.1 }}>Track</div>
            <div style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.9)" }}>Measure what is working. Double down on what performs.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" style={{ height: 44, padding: "0 14px 0 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)", color: "#ffffff", fontFamily: "inherit", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#ffffff", color: "#0a66c2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{companyInitial}</span>
              <span>{ws.companyName || "Company"}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 9l5-5 5 5"/><path d="M7 15l5 5 5-5"/></svg>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 5px 0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 17h12l-1.5-2V11a4.5 4.5 0 0 0-9 0v4z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(145deg,#ffffff,#b9d6f8)", color: "#0a4a94", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, marginLeft: 6 }}>{userInitials}</div>
            </div>
          </div>
        </header>

        {/* KPI row */}
        <div style={{ position: "absolute", left: 128, top: 112, width: 1192, display: "flex", gap: 14 }}>
          {kpis.map((k) => {
            const pct = k.target ? Math.min(100, (k.current / k.target) * 100) : 0;
            const gap = k.target ? Math.abs(k.current - k.target) / k.target : 1;
            const onTrack = k.target && gap <= 0.1;
            const val = k.suffix
              ? (Math.round(k.current * 10) / 10).toFixed(1) + k.suffix
              : Math.round(k.current).toLocaleString();
            const targetLabel = k.target ? (k.suffix ? k.target + k.suffix : k.target.toLocaleString()) : "-";
            return (
              <div key={k.name} style={{ flex: 1, minWidth: 0, height: 124, boxSizing: "border-box", padding: "16px 18px", borderRadius: 22, ...glassCard }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.92)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.name}</div>
                <div style={{ marginTop: 6, fontSize: 32, fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{val}</div>
                <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "rgba(255,255,255,0.85)" }}>
                  <span>Target {targetLabel}</span>
                  <span style={{ height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center", flexShrink: 0, background: onTrack ? "#ecfdf3" : "#fef3f2", color: onTrack ? "#067647" : "#b42318" }}>
                    {onTrack ? "On track" : "Behind"}
                  </span>
                </div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: "#ffffff", width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Content performance log */}
        <div style={{ position: "absolute", left: 128, top: 250, width: 1192, height: 300, boxSizing: "border-box", padding: "20px 24px", borderRadius: 26, ...glassCard, display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, height: 44 }}>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>Content performance log</div>
            {entries.length > 0 && (
              <span style={{ minWidth: 24, height: 24, padding: "0 8px", boxSizing: "border-box", borderRadius: 12, background: "#ffffff", color: "#0a66c2", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {entries.length}
              </span>
            )}
            <button type="button" onClick={() => { setAdding(true); setDraft(blank()); }}
              style={{ marginLeft: "auto", height: 44, padding: "0 18px", borderRadius: 12, border: 0, background: "#ffffff", color: "#0a66c2", fontFamily: "inherit", fontSize: 15, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", boxShadow: "0 10px 24px rgba(6,42,92,0.22)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Add entry
            </button>
          </div>

          {/* Column headers */}
          <div style={{ flexShrink: 0, marginTop: 6, display: "grid", gridTemplateColumns: COLS, gap: 12, padding: "0 12px", height: 30, alignItems: "center", fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
            {["Date", "Title", "Format", "Source", "Impressions", "Eng %", "Followers", "Notes", ""].map(h => <span key={h}>{h}</span>)}
          </div>

          {/* Inline add row */}
          {adding && (
            <AddRow
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              onCancel={() => { setAdding(false); setDraft(blank()); }}
              saving={saving}
              inStyle={inStyle}
            />
          )}

          {/* Data rows or empty state */}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {loadingEntries ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "rgba(255,255,255,0.85)" }}>Loading entries...</div>
            ) : entries.length === 0 && !adding ? (
              <div style={{ flex: 1, marginTop: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 18, border: "1.5px dashed rgba(255,255,255,0.5)" }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>No entries yet</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.9)" }}>Log your first piece of content to start tracking what works.</div>
              </div>
            ) : (
              entries.map((e) =>
                editingId === e.id ? (
                  <AddRow key={e.id} draft={draft} setDraft={setDraft} onSave={save} onCancel={() => { setEditingId(null); setDraft(blank()); }} saving={saving} inStyle={inStyle} />
                ) : (
                  <div key={e.id} className="tr-row" style={{ flexShrink: 0, display: "grid", gridTemplateColumns: COLS, gap: 12, padding: "0 12px", height: 46, alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.22)", fontSize: 14 }}>
                    <span style={{ color: "rgba(255,255,255,0.9)" }}>{e.date.slice(5).replace("-", " ")}</span>
                    <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</span>
                    <span>
                      <span style={{ height: 24, padding: "0 10px", borderRadius: 999, background: "rgba(255,255,255,0.24)", fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>{e.format}</span>
                    </span>
                    <span>{e.source}</span>
                    <span>{e.impressions.toLocaleString()}</span>
                    <span>{e.engagementRate}%</span>
                    <span>{e.followersGained > 0 ? `+${e.followersGained}` : e.followersGained}</span>
                    <span style={{ color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.notes}</span>
                    <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => { setEditingId(e.id); setDraft(e); }}
                        style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                      </button>
                      <button type="button" onClick={() => del(e.id)}
                        style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </span>
                  </div>
                )
              )
            )}
          </div>
        </div>

        {/* Format intelligence */}
        <div style={{ position: "absolute", left: 128, top: 564, width: 700 }}>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>Format intelligence</div>
          <div style={{ marginTop: 12, display: "flex", gap: 14 }}>
            {FORMATS.map((f) => {
              const t = totals[f];
              const pct = totalImpressionsForShare ? Math.round((t.imp / totalImpressionsForShare) * 100) : 0;
              const avgImp = t.count ? Math.round(t.imp / t.count).toLocaleString() : "-";
              const avgEng = t.count ? `${(t.eng / t.count).toFixed(1)}%` : "-";
              return (
                <div key={f} style={{ flex: 1, minWidth: 0, height: 226, boxSizing: "border-box", padding: 18, borderRadius: 22, ...glassCard }}>
                  <span style={{ height: 26, padding: "0 12px", borderRadius: 999, background: "#ffffff", color: "#0a66c2", fontSize: 12.5, fontWeight: 700, display: "inline-flex", alignItems: "center" }}>{f}</span>
                  <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14, fontSize: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "rgba(255,255,255,0.88)" }}>Avg impressions</span><span style={{ fontWeight: 600 }}>{avgImp}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "rgba(255,255,255,0.88)" }}>Avg engagement</span><span style={{ fontWeight: 600 }}>{avgEng}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "rgba(255,255,255,0.88)" }}>Entries logged</span><span style={{ fontWeight: 600 }}>{t.count}</span></div>
                  </div>
                  <div style={{ marginTop: 20, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, background: "#ffffff", width: `${pct}%` }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12.5, color: "rgba(255,255,255,0.85)" }}>
                    {t.count ? `${pct}% of your reach` : "No entries yet"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly trend */}
        <div style={{ position: "absolute", left: 842, top: 564, width: 478, height: 284, boxSizing: "border-box", padding: "20px 24px", borderRadius: 26, ...glassCard, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>Weekly trend, followers</div>
            <span style={{ marginLeft: "auto", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Last 6 weeks</span>
          </div>
          <TrendChart entries={entries} baseline={Number(ws.baseline.followers || 0)} />
        </div>

      </div>
    </div>
  );
}

// --- Inline add/edit row ---

function AddRow({
  draft, setDraft, onSave, onCancel, saving, inStyle,
}: {
  draft: Partial<PerfEntry>;
  setDraft: (d: Partial<PerfEntry>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  inStyle: React.CSSProperties;
}) {
  const [rawImp, setRawImp] = useState(draft.impressions ? String(draft.impressions) : "");
  const [rawEng, setRawEng] = useState(draft.engagementRate ? String(draft.engagementRate) : "");
  const [rawFol, setRawFol] = useState(draft.followersGained ? String(draft.followersGained) : "");

  return (
    <div style={{ flexShrink: 0, display: "grid", gridTemplateColumns: COLS, gap: 12, padding: "0 12px", height: 52, alignItems: "center", borderRadius: 14, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.4)", marginTop: 4 }}>
      <input className="tf-in" type="text" value={draft.date || ""} onChange={e => setDraft({ ...draft, date: e.target.value })} style={inStyle} />
      <input className="tf-in" type="text" placeholder="Title" value={draft.title || ""} onChange={e => setDraft({ ...draft, title: e.target.value })} style={inStyle} />
      <select className="tf-in" value={draft.format || "Article"} onChange={e => setDraft({ ...draft, format: e.target.value as Format })}
        style={{ ...inStyle, appearance: "none" as any }}>
        {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <select className="tf-in" value={draft.source || "Transcript"} onChange={e => setDraft({ ...draft, source: e.target.value as PerfEntry["source"] })}
        style={{ ...inStyle, appearance: "none" as any }}>
        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <input className="tf-in" type="text" placeholder="0" value={rawImp}
        onChange={e => { setRawImp(e.target.value); setDraft({ ...draft, impressions: e.target.value === "" ? 0 : Number(e.target.value) }); }} style={inStyle} />
      <input className="tf-in" type="text" placeholder="0" value={rawEng}
        onChange={e => { setRawEng(e.target.value); setDraft({ ...draft, engagementRate: e.target.value === "" ? 0 : Number(e.target.value) }); }} style={inStyle} />
      <input className="tf-in" type="text" placeholder="0" value={rawFol}
        onChange={e => { setRawFol(e.target.value); setDraft({ ...draft, followersGained: e.target.value === "" ? 0 : Number(e.target.value) }); }} style={inStyle} />
      <input className="tf-in" type="text" placeholder="Add a note" value={draft.notes || ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} style={inStyle} />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button type="button" aria-label="Save entry" onClick={onSave} disabled={saving}
          style={{ width: 34, height: 34, borderRadius: "50%", border: 0, background: "#ffffff", color: "#0a66c2", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: saving ? 0.7 : 1 }}>
          <Check size={17} />
        </button>
        <button type="button" aria-label="Cancel" onClick={onCancel}
          style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "#ffffff", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
