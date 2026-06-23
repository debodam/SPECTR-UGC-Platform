import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp, type QueueItem, type Format } from "@/lib/spectr-store";
import { AppShell } from "@/components/spectr/AppShell";
import supabase from "@/lib/supabase";

export const Route = createFileRoute("/distribute")({ component: () => <AppShell><Distribute /></AppShell> });

const FORMAT_COLORS: Record<Format, string> = {
  "Article": "var(--color-primary)",
  "Post": "var(--color-success)",
  "Video Script": "var(--color-warning)",
};
const FORMATS: Format[] = ["Article", "Post", "Video Script"];

// ── DB row ↔ app type conversions ─────────────────────────────────────────────

function fromRow(row: Record<string, unknown>): QueueItem {
  return {
    id: row.id as string,
    title: row.title as string,
    format: row.format as Format,
    date: row.date as string,
    time: row.time as string,
    status: row.status as QueueItem["status"],
  };
}

function toRow(item: QueueItem, companyId: string, userId: string) {
  return {
    id: item.id,
    company_id: companyId,
    user_id: userId,
    title: item.title,
    format: item.format,
    date: item.date,
    time: item.time,
    status: item.status,
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

function Distribute() {
  const { state } = useApp();
  const ws = state.workspace;
  const companyId = ws.companyId;
  const userId = state.user?.id;

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<QueueItem>>(blank());
  const [saving, setSaving] = useState(false);

  // ── Load queue from Supabase ─────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) { setLoadingQueue(false); return; }
    setLoadingQueue(true);
    supabase
      .from("queue_items")
      .select("*")
      .eq("company_id", companyId)
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error("Failed to load queue");
        else setQueue((data ?? []).map(fromRow));
        setLoadingQueue(false);
      });
  }, [companyId]);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!draft.title?.trim()) { toast.error("Title is required"); return; }
    if (!companyId || !userId) { toast.error("No active company"); return; }
    setSaving(true);
    const item: QueueItem = {
      id: crypto.randomUUID(),
      title: draft.title!,
      format: (draft.format as Format) || "Article",
      date: draft.date || new Date().toISOString().slice(0, 10),
      time: draft.time || "09:00",
      status: "Scheduled",
    };
    const { error } = await supabase
      .from("queue_items")
      .insert(toRow(item, companyId, userId));
    setSaving(false);
    if (error) { toast.error("Failed to save"); return; }
    setQueue((prev) =>
      [...prev, item].sort(
        (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
      )
    );
    setDraft(blank());
    setAdding(false);
    toast.success("Added to queue");
  };

  const toggle = async (id: string) => {
    const item = queue.find((q) => q.id === id);
    if (!item) return;
    const newStatus: QueueItem["status"] =
      item.status === "Scheduled" ? "Published" : "Scheduled";
    const { error } = await supabase
      .from("queue_items")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) { toast.error("Failed to update status"); return; }
    setQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: newStatus } : q))
    );
  };

  const remove = async (id: string) => {
    const { error } = await supabase
      .from("queue_items")
      .delete()
      .eq("id", id);
    if (error) { toast.error("Failed to remove"); return; }
    setQueue((prev) => prev.filter((q) => q.id !== id));
    toast("Removed from queue");
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold mb-1">Distribute</h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
        Sequence the rollout. Time it for momentum.
      </p>

      {/* Publish Queue */}
      <section className="spectr-card p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Publish Queue</h2>
          <button
            onClick={() => { setAdding(true); setDraft(blank()); }}
            className="spectr-btn-primary"
            style={{ height: 36 }}
          >
            <Plus size={14} />Add to Queue
          </button>
        </div>

        {adding && (
          <div
            className="grid grid-cols-12 gap-2 p-3 mb-3 rounded"
            style={{ background: "var(--color-surface)" }}
          >
            <input
              className="col-span-4 spectr-input"
              placeholder="Content title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && save()}
              autoFocus
            />
            <select
              className="col-span-2 spectr-input"
              value={draft.format}
              onChange={(e) => setDraft({ ...draft, format: e.target.value as Format })}
            >
              {FORMATS.map((f) => <option key={f}>{f}</option>)}
            </select>
            <input
              className="col-span-2 spectr-input"
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
            <input
              className="col-span-2 spectr-input"
              type="time"
              value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.target.value })}
            />
            <button
              onClick={save}
              disabled={saving}
              className="col-span-1 spectr-btn-primary"
              style={{ opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "…" : "Save"}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="col-span-1 spectr-btn-secondary"
            >
              Cancel
            </button>
          </div>
        )}

        {loadingQueue ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--color-text-secondary)" }}>
            Loading queue…
          </p>
        ) : queue.length === 0 && !adding ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--color-text-secondary)" }}>
            Nothing queued yet. Add a piece to start planning your cadence.
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {queue.map((q) => (
              <div
                key={q.id}
                className="flex items-center gap-4 py-3"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <span
                  className="text-[10px] font-bold uppercase px-2 py-1 rounded text-white shrink-0"
                  style={{ background: FORMAT_COLORS[q.format] ?? "var(--color-primary)" }}
                >
                  {q.format}
                </span>
                <span className="flex-1 font-medium text-sm truncate">{q.title}</span>
                <span className="text-xs shrink-0" style={{ color: "var(--color-text-secondary)" }}>
                  {q.date} · {q.time}
                </span>
                <button
                  onClick={() => toggle(q.id)}
                  className="text-xs font-semibold px-3 py-1 rounded-full shrink-0"
                  style={{
                    background: q.status === "Published" ? "var(--color-success)" : "var(--color-card-2)",
                    color: q.status === "Published" ? "white" : "var(--color-primary)",
                    border: `1px solid ${q.status === "Published" ? "var(--color-success)" : "var(--color-primary)"}`,
                  }}
                >
                  {q.status}
                </button>
                <button
                  onClick={() => remove(q.id)}
                  className="shrink-0"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cadence Planner */}
      <section className="spectr-card p-5 mb-8">
        <h2 className="font-bold mb-1">Cadence Planner</h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>
          Two-week view starting from today.
        </p>
        <CadenceGrid queue={queue} />
      </section>

      {/* Amplification Tips */}
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
              <span style={{ color: "var(--color-primary)" }}>→</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ── Cadence grid ───────────────────────────────────────────────────────────────

function CadenceGrid({ queue }: { queue: QueueItem[] }) {
  // Anchor to today on each mount so the window is always current
  const [todayStr] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });

  const days = useMemo(() => {
    const base = new Date(todayStr);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [todayStr]);

  const byDate = useMemo(() => {
    const map: Record<string, QueueItem[]> = {};
    for (const q of queue) {
      if (!map[q.date]) map[q.date] = [];
      map[q.date].push(q);
    }
    return map;
  }, [queue]);

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const key = d.toISOString().slice(0, 10);
        const items = byDate[key] ?? [];
        const isToday = key === todayStr;
        return (
          <div
            key={key}
            className="rounded-md p-2 min-h-[100px]"
            style={{
              background: isToday ? "rgba(10,102,194,0.06)" : "var(--color-surface)",
              border: `1.5px solid ${isToday ? "var(--color-primary)" : "transparent"}`,
            }}
          >
            <div
              className="text-[10px] font-bold"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {d.toLocaleDateString(undefined, { weekday: "short" })}
            </div>
            <div
              className="text-sm font-bold mb-1"
              style={{ color: isToday ? "var(--color-primary)" : undefined }}
            >
              {d.getDate()}
            </div>
            {items.map((q) => (
              <div
                key={q.id}
                title={`${q.title} · ${q.time} (${q.format})`}
                className="text-[10px] font-semibold text-white rounded px-1.5 py-1 mb-1 truncate"
                style={{ background: FORMAT_COLORS[q.format] ?? "var(--color-primary)" }}
              >
                {q.title}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function blank(): Partial<QueueItem> {
  return {
    title: "",
    format: "Article",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    status: "Scheduled",
  };
}
