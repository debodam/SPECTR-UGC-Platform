import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp, type QueueItem, type Format } from "@/lib/spectr-store";
import { AppShell } from "@/components/spectr/AppShell";

export const Route = createFileRoute("/distribute")({ component: () => <AppShell><Distribute /></AppShell> });

const FORMAT_COLORS: Record<Format, string> = {
  "Article": "var(--color-primary)",
  "Post": "var(--color-success)",
  "Video Script": "var(--color-warning)",
  "Carousel": "var(--color-purple-accent)",
};
const FORMATS: Format[] = ["Article", "Post", "Video Script", "Carousel"];

function Distribute() {
  const { state, update } = useApp();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<QueueItem>>(blank());

  const save = () => {
    if (!draft.title?.trim()) { toast.error("Title is required"); return; }
    const item: QueueItem = {
      id: crypto.randomUUID(),
      title: draft.title!,
      format: (draft.format as Format) || "Article",
      date: draft.date || new Date().toISOString().slice(0, 10),
      time: draft.time || "09:00",
      status: "Scheduled",
    };
    update({ queue: [...state.queue, item] });
    setDraft(blank()); setAdding(false);
    toast.success("Added to queue");
  };

  const toggle = (id: string) => {
    update({ queue: state.queue.map((q) => q.id === id ? { ...q, status: q.status === "Scheduled" ? "Published" : "Scheduled" } : q) });
  };
  const remove = (id: string) => {
    update({ queue: state.queue.filter((q) => q.id !== id) });
    toast("Removed from queue");
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold mb-1">Distribute</h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>Sequence the rollout. Time it for momentum.</p>

      <section className="spectr-card p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Publish Queue</h2>
          <button onClick={() => setAdding(true)} className="spectr-btn-primary" style={{ height: 36 }}>
            <Plus size={14} />Add to Queue
          </button>
        </div>

        {adding && (
          <div className="grid grid-cols-12 gap-2 p-3 mb-3 rounded" style={{ background: "var(--color-surface)" }}>
            <input className="col-span-4 spectr-input" placeholder="Content title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <select className="col-span-2 spectr-input" value={draft.format} onChange={(e) => setDraft({ ...draft, format: e.target.value as Format })}>
              {FORMATS.map((f) => <option key={f}>{f}</option>)}
            </select>
            <input className="col-span-2 spectr-input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            <input className="col-span-2 spectr-input" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
            <button onClick={save} className="col-span-1 spectr-btn-primary">Save</button>
            <button onClick={() => setAdding(false)} className="col-span-1 spectr-btn-secondary">Cancel</button>
          </div>
        )}

        {state.queue.length === 0 && !adding ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--color-text-secondary)" }}>
            Nothing queued yet. Add a piece to start planning your cadence.
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {state.queue.map((q) => (
              <div key={q.id} className="flex items-center gap-4 py-3" style={{ borderTop: "1px solid var(--color-border)" }}>
                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded text-white" style={{ background: FORMAT_COLORS[q.format] }}>{q.format}</span>
                <span className="flex-1 font-medium text-sm">{q.title}</span>
                <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{q.date} · {q.time}</span>
                <button onClick={() => toggle(q.id)} className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{
                    background: q.status === "Published" ? "var(--color-success)" : "white",
                    color: q.status === "Published" ? "white" : "var(--color-primary)",
                    border: `1px solid ${q.status === "Published" ? "var(--color-success)" : "var(--color-primary)"}`,
                  }}>{q.status}</button>
                <button onClick={() => remove(q.id)} style={{ color: "var(--color-text-secondary)" }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="spectr-card p-5 mb-8">
        <h2 className="font-bold mb-1">Cadence Planner</h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>Two-week view of scheduled content.</p>
        <CadenceGrid queue={state.queue} />
      </section>

      <section className="spectr-card p-5">
        <h2 className="font-bold mb-3">Amplification Tips</h2>
        <ul className="space-y-2 text-sm">
          {[
            "Tag 2–3 industry peers in the post for early engagement.",
            "Reply to every comment within the first 90 minutes.",
            "Ask 2 colleagues to engage within the first hour of posting.",
            "Cross-post a key stat as a follow-up 48 hours later.",
          ].map((tip) => (
            <li key={tip} className="flex gap-2">
              <span style={{ color: "var(--color-primary)" }}>→</span><span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CadenceGrid({ queue }: { queue: QueueItem[] }) {
  const today = new Date();
  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i);
    return d;
  });
  const byDate: Record<string, QueueItem[]> = {};
  for (const q of queue) {
    byDate[q.date] = byDate[q.date] ?? [];
    byDate[q.date].push(q);
  }
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const key = d.toISOString().slice(0, 10);
        const items = byDate[key] || [];
        return (
          <div key={key} className="rounded-md p-2 min-h-[100px]" style={{ background: "var(--color-surface)" }}>
            <div className="text-[10px] font-bold" style={{ color: "var(--color-text-secondary)" }}>
              {d.toLocaleDateString(undefined, { weekday: "short" })}
            </div>
            <div className="text-sm font-bold mb-1">{d.getDate()}</div>
            {items.map((q) => (
              <div key={q.id} title={`${q.title} (${q.format})`}
                className="text-[10px] font-semibold text-white rounded px-1.5 py-1 mb-1 truncate"
                style={{ background: FORMAT_COLORS[q.format] }}>{q.title}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function blank(): Partial<QueueItem> {
  return { title: "", format: "Article", date: new Date().toISOString().slice(0, 10), time: "09:00", status: "Scheduled" };
}
