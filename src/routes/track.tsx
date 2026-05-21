import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { useApp, type PerfEntry, type Format } from "@/lib/spectr-store";
import { AppShell } from "@/components/spectr/AppShell";

export const Route = createFileRoute("/track")({ component: () => <AppShell><Track /></AppShell> });

const FORMATS: Format[] = ["Article", "Post", "Video Script", "Carousel"];
const SOURCES = ["Transcript", "Notes", "Draft"] as const;

function Track() {
  const { state, update } = useApp();
  const ws = state.workspace;

  const totals = useMemo(() => sumByFormat(state.entries), [state.entries]);
  const currentFollowers = Number(ws.baseline.followers || 0) + state.entries.reduce((s, e) => s + e.followersGained, 0);

  const kpis = [
    { name: "Followers", current: currentFollowers, target: Number(ws.targets.followers || 0) },
    { name: "Weekly Impressions", current: avg(state.entries.map((e) => e.impressions)), target: Number(ws.targets.weeklyImpressions || 0) },
    { name: "Avg Engagement Rate", current: avg(state.entries.map((e) => e.engagementRate)), target: Number(ws.targets.engagementRate || 0), suffix: "%" },
    { name: "Monthly Profile Visitors", current: Number(ws.baseline.monthlyVisitors || 0), target: Number(ws.targets.monthlyVisitors || 0) },
    { name: "Weekly Page Searches", current: Number(ws.baseline.weeklyPageSearches || 0), target: Number(ws.targets.weeklyPageSearches || 0) },
  ];

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PerfEntry>>(blank());

  const save = () => {
    const entry: PerfEntry = {
      id: editingId ?? crypto.randomUUID(),
      date: draft.date || new Date().toISOString().slice(0, 10),
      title: draft.title || "Untitled",
      format: (draft.format as Format) || "Article",
      source: (draft.source as any) || "Transcript",
      impressions: Number(draft.impressions || 0),
      engagementRate: Number(draft.engagementRate || 0),
      followersGained: Number(draft.followersGained || 0),
      notes: draft.notes || "",
    };
    const others = state.entries.filter((e) => e.id !== entry.id);
    update({ entries: [entry, ...others] });
    setAdding(false); setEditingId(null); setDraft(blank());
    toast.success("Entry saved");
  };

  const del = (id: string) => {
    update({ entries: state.entries.filter((e) => e.id !== id) });
    toast("Entry deleted");
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold mb-1">Track</h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>Measure what's working. Double down on what performs.</p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {kpis.map((k) => <KpiCard key={k.name} {...k} />)}
      </div>

      <section className="spectr-card p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Content Performance Log</h2>
          <button onClick={() => { setAdding(true); setDraft(blank()); }} className="spectr-btn-primary" style={{ height: 36 }}>
            <Plus size={14} />Add Entry
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase" style={{ color: "var(--color-text-secondary)" }}>
                {["Date", "Title", "Format", "Source", "Impressions", "Eng %", "Followers", "Notes", ""].map((h) => (
                  <th key={h} className="py-2 pr-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adding && (
                <EditRow draft={draft} setDraft={setDraft} onSave={save} onCancel={() => { setAdding(false); setDraft(blank()); }} />
              )}
              {state.entries.length === 0 && !adding && (
                <tr><td colSpan={9} className="py-8 text-center" style={{ color: "var(--color-text-secondary)" }}>
                  No entries yet. Log your first piece of content to start tracking what works.
                </td></tr>
              )}
              {state.entries.map((e) => editingId === e.id ? (
                <EditRow key={e.id} draft={draft} setDraft={setDraft} onSave={save} onCancel={() => { setEditingId(null); setDraft(blank()); }} />
              ) : (
                <tr key={e.id} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                  <td className="py-2 pr-3">{e.date}</td>
                  <td className="py-2 pr-3 font-medium">{e.title}</td>
                  <td className="py-2 pr-3"><FormatBadge f={e.format} /></td>
                  <td className="py-2 pr-3">{e.source}</td>
                  <td className="py-2 pr-3">{e.impressions.toLocaleString()}</td>
                  <td className="py-2 pr-3">{e.engagementRate}%</td>
                  <td className="py-2 pr-3">{e.followersGained > 0 ? `+${e.followersGained}` : e.followersGained}</td>
                  <td className="py-2 pr-3 max-w-[200px] truncate" title={e.notes}>{e.notes}</td>
                  <td className="py-2 pr-3 flex gap-2">
                    <button onClick={() => { setEditingId(e.id); setDraft(e); }}><Pencil size={14} /></button>
                    <button onClick={() => del(e.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-bold mb-3">Format Intelligence</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FORMATS.map((f) => {
            const t = totals[f];
            return (
              <div key={f} className="spectr-card p-4">
                <FormatBadge f={f} />
                <div className="mt-3 space-y-1.5">
                  <Stat label="Avg Impressions" value={t.count ? Math.round(t.imp / t.count).toLocaleString() : "—"} />
                  <Stat label="Avg Engagement" value={t.count ? `${(t.eng / t.count).toFixed(1)}%` : "—"} />
                  <Stat label="Entries Logged" value={String(t.count)} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="spectr-card p-5">
        <h2 className="font-bold mb-3">Weekly Trend — Followers</h2>
        <TrendChart entries={state.entries} baseline={Number(ws.baseline.followers || 0)} />
      </section>
    </div>
  );
}

function blank(): Partial<PerfEntry> {
  return { date: new Date().toISOString().slice(0, 10), title: "", format: "Article", source: "Transcript", impressions: 0, engagementRate: 0, followersGained: 0, notes: "" };
}

function EditRow({ draft, setDraft, onSave, onCancel }: { draft: Partial<PerfEntry>; setDraft: (d: Partial<PerfEntry>) => void; onSave: () => void; onCancel: () => void }) {
  const inp = "border rounded px-2 py-1 text-sm w-full";
  return (
    <tr className="border-t" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <td className="py-2 pr-2"><input className={inp} type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></td>
      <td className="py-2 pr-2"><input className={inp} placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></td>
      <td className="py-2 pr-2"><select className={inp} value={draft.format} onChange={(e) => setDraft({ ...draft, format: e.target.value as Format })}>{FORMATS.map((f) => <option key={f}>{f}</option>)}</select></td>
      <td className="py-2 pr-2"><select className={inp} value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as any })}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></td>
      <td className="py-2 pr-2"><input className={inp} type="number" value={draft.impressions} onChange={(e) => setDraft({ ...draft, impressions: Number(e.target.value) })} /></td>
      <td className="py-2 pr-2"><input className={inp} type="number" step="0.1" value={draft.engagementRate} onChange={(e) => setDraft({ ...draft, engagementRate: Number(e.target.value) })} /></td>
      <td className="py-2 pr-2"><input className={inp} type="number" value={draft.followersGained} onChange={(e) => setDraft({ ...draft, followersGained: Number(e.target.value) })} /></td>
      <td className="py-2 pr-2"><input className={inp} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></td>
      <td className="py-2 pr-2 flex gap-1">
        <button onClick={onSave} className="p-1 rounded text-white" style={{ background: "var(--color-success)" }}><Check size={14} /></button>
        <button onClick={onCancel} className="p-1 rounded" style={{ background: "var(--color-surface)" }}><X size={14} /></button>
      </td>
    </tr>
  );
}

function KpiCard({ name, current, target, suffix }: { name: string; current: number; target: number; suffix?: string }) {
  const pct = target ? Math.min(100, (current / target) * 100) : 0;
  const gap = target ? Math.abs(current - target) / target : 1;
  const status = !target ? "#999" : gap <= 0.1 ? "var(--color-success)" : gap <= 0.3 ? "var(--color-warning)" : "oklch(0.55 0.22 27)";
  return (
    <div className="spectr-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>{name}</span>
        <span className="rounded-full" style={{ background: status, width: 8, height: 8 }} />
      </div>
      <div className="text-2xl font-bold mt-2">{Math.round(current).toLocaleString()}{suffix}</div>
      <div className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>Target: {target ? target.toLocaleString() : "—"}{suffix}</div>
      <div className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ background: "var(--color-surface)" }}>
        <div className="h-full" style={{ width: `${pct}%`, background: "var(--color-primary)" }} />
      </div>
    </div>
  );
}

function FormatBadge({ f }: { f: Format }) {
  const colors: Record<Format, string> = {
    "Article": "var(--color-primary)",
    "Post": "var(--color-success)",
    "Video Script": "var(--color-warning)",
    "Carousel": "var(--color-purple-accent)",
  };
  return <span className="text-[10px] font-bold uppercase px-2 py-1 rounded text-white" style={{ background: colors[f] }}>{f}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: "var(--color-text-secondary)" }}>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function sumByFormat(entries: PerfEntry[]) {
  const r: Record<Format, { imp: number; eng: number; count: number }> = {
    "Article": { imp: 0, eng: 0, count: 0 },
    "Post": { imp: 0, eng: 0, count: 0 },
    "Video Script": { imp: 0, eng: 0, count: 0 },
    "Carousel": { imp: 0, eng: 0, count: 0 },
  };
  for (const e of entries) {
    r[e.format].imp += e.impressions;
    r[e.format].eng += e.engagementRate;
    r[e.format].count += 1;
  }
  return r;
}
function avg(xs: number[]) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }

function TrendChart({ entries, baseline }: { entries: PerfEntry[]; baseline: number }) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const W = 700, H = 200, P = 30;
  if (sorted.length === 0) {
    return (
      <div className="relative" style={{ height: H }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--color-border)" />
          <line x1={P} y1={P} x2={P} y2={H - P} stroke="var(--color-border)" />
        </svg>
        <p className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Log entries to see your follower trend.
        </p>
      </div>
    );
  }
  let acc = baseline;
  const pts = sorted.map((e) => { acc += e.followersGained; return acc; });
  const max = Math.max(...pts, baseline + 1);
  const min = Math.min(...pts, baseline);
  const xs = pts.map((_, i) => P + (i / Math.max(1, pts.length - 1)) * (W - P * 2));
  const ys = pts.map((p) => H - P - ((p - min) / Math.max(1, max - min)) * (H - P * 2));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--color-border)" />
      <line x1={P} y1={P} x2={P} y2={H - P} stroke="var(--color-border)" />
      <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth={2} />
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r={3} fill="var(--color-primary)" />)}
    </svg>
  );
}
