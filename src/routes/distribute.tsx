import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useApp, type QueueItem, type Format } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";

export const Route = createFileRoute("/distribute")({ component: DistributePage });

const FORMATS: Format[] = ["Article", "Post", "Video Script"];

const TIPS = [
  "Tag 2 to 3 industry peers in the post for early engagement.",
  "Reply to every comment within the first 90 minutes.",
  "Ask 2 colleagues to engage within the first hour of posting.",
  "Cross-post a key stat as a follow-up 48 hours later.",
];

// --- DB conversions ---

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
    id: item.id, company_id: companyId, user_id: userId,
    title: item.title, format: item.format, date: item.date, time: item.time, status: item.status,
  };
}

function blank(): Partial<QueueItem> {
  return { title: "", format: "Article", date: new Date().toISOString().slice(0, 10), time: "09:00", status: "Scheduled" };
}

function fmtWhen(date: string, time: string) {
  const d = new Date(`${date}T${time}`);
  if (isNaN(d.getTime())) return `${date} at ${time}`;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// --- Nav ---

const NAV_ITEMS: { label: string; to: string; d1: string; d2: string; active?: boolean }[] = [
  { label: "Home", to: "/", d1: "M4 11l8-7 8 7", d2: "M6 10v10h12V10" },
  { label: "Transform", to: "/transform", d1: "M12 4l1.8 4.6L18.5 10l-4.7 1.4L12 16l-1.8-4.6L5.5 10l4.7-1.4z", d2: "M18 16v4M16 18h4" },
  { label: "Record", to: "/record", d1: "M9 4h6v8a3 3 0 0 1-6 0z", d2: "M6 11a6 6 0 0 0 12 0M12 17v3" },
  { label: "Track", to: "/track", d1: "M5 20V11M11 20V5M17 20v-7", d2: "M3 20h18" },
  { label: "Distribute", to: "/distribute", d1: "M5 6h14v14H5z", d2: "M5 10h14M9 3v4M15 3v4", active: true },
  { label: "Settings", to: "/settings", d1: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", d2: "M19 12l2-1-1-3-2.3.5-1.4-1.4.5-2.3-3-1-1 2h-2l-1-2-3 1 .5 2.3-1.4 1.4L3 8l-1 3 2 1v2l-2 1 1 3 2.3-.5 1.4 1.4-.5 2.3 3 1 1-2h2l1 2 3-1-.5-2.3 1.4-1.4L21 16l1-3-2-1z" },
];

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.4)",
  backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" as any,
  boxShadow: "0 10px 30px rgba(6,42,92,0.14)",
};

// --- Cadence grid ---

function CadenceGrid({ queue }: { queue: QueueItem[] }) {
  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));
  const days = useMemo(() => {
    const base = new Date(todayStr + "T00:00:00");
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base); d.setDate(base.getDate() + i); return d;
    });
  }, [todayStr]);
  const byDate = useMemo(() => {
    const map: Record<string, QueueItem[]> = {};
    for (const q of queue) { if (!map[q.date]) map[q.date] = []; map[q.date].push(q); }
    return map;
  }, [queue]);
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div style={{ flex: 1, minHeight: 0, marginTop: 14, display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridTemplateRows: "1fr 1fr", gap: 8 }}>
      {days.map((d) => {
        const key = d.toISOString().slice(0, 10);
        const items = byDate[key] ?? [];
        const isToday = key === todayStr;
        return (
          <div key={key} style={{ boxSizing: "border-box", padding: 10, borderRadius: 16, display: "flex", flexDirection: "column", minHeight: 0, background: `rgba(255,255,255,${isToday ? 0.26 : 0.1})`, border: isToday ? "2px solid #ffffff" : "1px solid rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{DOW[d.getDay()]}</div>
            <div style={isToday ? { marginTop: 4, width: 30, height: 30, borderRadius: "50%", background: "#0a66c2", color: "#ffffff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" } : { marginTop: 4, height: 30, fontSize: 17, fontWeight: 600, display: "flex", alignItems: "center" }}>
              {d.getDate()}
            </div>
            {items.slice(0, 1).map((q) => (
              <div key={q.id} style={{ marginTop: "auto", height: 22, padding: "0 7px", borderRadius: 7, background: "#ffffff", color: "#0a66c2", fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", whiteSpace: "nowrap", overflow: "hidden" }}>
                {q.format === "Video Script" ? "Video" : q.format}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// --- Main page ---

function DistributePage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const ws = state.workspace;
  const companyId = ws.companyId;
  const userId = state.user?.id;

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<QueueItem>>(blank());
  const [draftFormat, setDraftFormat] = useState<Format>("Article");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) { setLoadingQueue(false); return; }
    setLoadingQueue(true);
    supabase.from("queue_items").select("*").eq("company_id", companyId).order("date", { ascending: true }).order("time", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error("Failed to load queue");
        else setQueue((data ?? []).map(fromRow));
        setLoadingQueue(false);
      });
  }, [companyId]);

  const save = async () => {
    if (!draft.title?.trim()) { toast.error("Title is required"); return; }
    if (!companyId || !userId) { toast.error("No active company"); return; }
    setSaving(true);
    const item: QueueItem = {
      id: crypto.randomUUID(),
      title: draft.title!,
      format: draftFormat,
      date: draft.date || new Date().toISOString().slice(0, 10),
      time: draft.time || "09:00",
      status: "Scheduled",
    };
    const { error } = await supabase.from("queue_items").insert(toRow(item, companyId, userId));
    setSaving(false);
    if (error) { toast.error("Failed to save"); return; }
    setQueue(prev => [...prev, item].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
    setDraft(blank()); setDraftFormat("Article"); setAdding(false); toast.success("Added to queue");
  };

  const toggle = async (id: string) => {
    const item = queue.find(q => q.id === id); if (!item) return;
    const newStatus: QueueItem["status"] = item.status === "Scheduled" ? "Published" : "Scheduled";
    const { error } = await supabase.from("queue_items").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error("Failed to update status"); return; }
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: newStatus } : q));
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("queue_items").delete().eq("id", id);
    if (error) { toast.error("Failed to remove"); return; }
    setQueue(prev => prev.filter(q => q.id !== id)); toast("Removed from queue");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const userName = state.user?.name ?? "";
  const userInitials = userName.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "U";
  const companyInitial = (ws.companyName || "C")[0].toUpperCase();
  const isEmpty = !loadingQueue && queue.length === 0 && !adding;

  const inStyle: React.CSSProperties = {
    height: 44, width: "100%", boxSizing: "border-box", padding: "0 14px",
    border: 0, borderRadius: 12, background: "rgba(255,255,255,0.18)",
    color: "#ffffff", fontFamily: "inherit", fontSize: 15,
  };
  const segBtnBase: React.CSSProperties = {
    flex: 1, border: 0, borderRadius: 11, cursor: "pointer",
    fontFamily: "inherit", fontWeight: 600, fontSize: 14,
    transition: "background .15s ease,color .15s ease",
  };

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
            <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: "-0.01em", lineHeight: 1.1 }}>Distribute</div>
            <div style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.9)" }}>Sequence the rollout. Time it for momentum.</div>
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

        {/* Publish queue panel */}
        <div style={{ position: "absolute", left: 128, top: 112, width: 460, height: 736, boxSizing: "border-box", padding: 24, borderRadius: 26, ...glassCard, display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", height: 44, flexShrink: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>Publish queue</div>
            {queue.length > 0 && (
              <span style={{ marginLeft: 10, minWidth: 24, height: 24, padding: "0 8px", boxSizing: "border-box", borderRadius: 12, background: "#ffffff", color: "#0a66c2", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {queue.length}
              </span>
            )}
            <button type="button" onClick={() => { setAdding(true); setDraft(blank()); setDraftFormat("Article"); }}
              style={{ marginLeft: "auto", height: 44, padding: "0 18px", borderRadius: 12, border: 0, background: "#ffffff", color: "#0a66c2", fontFamily: "inherit", fontSize: 15, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", boxShadow: "0 10px 24px rgba(6,42,92,0.22)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Add to queue
            </button>
          </div>

          {/* Add form */}
          {adding && (
            <div style={{ flexShrink: 0, marginTop: 14, boxSizing: "border-box", padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.4)" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Title</div>
              <input autoFocus className="tf-in" type="text" placeholder="Content title" value={draft.title || ""} onChange={e => setDraft({ ...draft, title: e.target.value })} onKeyDown={e => e.key === "Enter" && save()}
                style={{ ...inStyle, marginTop: 8 }} />
              <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600 }}>Format</div>
              <div style={{ marginTop: 8, display: "flex", padding: 4, borderRadius: 14, background: "rgba(255,255,255,0.18)", height: 44, boxSizing: "border-box", gap: 4 }}>
                {FORMATS.map(f => (
                  <button key={f} type="button" onClick={() => setDraftFormat(f)}
                    style={{ ...segBtnBase, background: draftFormat === f ? "#0a66c2" : "transparent", color: draftFormat === f ? "#ffffff" : "rgba(255,255,255,0.9)", boxShadow: draftFormat === f ? "0 4px 12px rgba(10,102,194,0.3)" : "none" }}>
                    {f}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Date</div>
                  <input className="tf-in" type="date" value={draft.date || ""} onChange={e => setDraft({ ...draft, date: e.target.value })}
                    style={{ ...inStyle, marginTop: 8, colorScheme: "dark" as any }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Time</div>
                  <input className="tf-in" type="time" value={draft.time || ""} onChange={e => setDraft({ ...draft, time: e.target.value })}
                    style={{ ...inStyle, marginTop: 8, colorScheme: "dark" as any }} />
                </div>
              </div>
              <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
                <button type="button" onClick={save} disabled={saving}
                  style={{ flex: 1, justifyContent: "center", height: 44, padding: "0 18px", borderRadius: 12, border: 0, background: "#ffffff", color: "#0a66c2", fontFamily: "inherit", fontSize: 15, fontWeight: 600, display: "inline-flex", alignItems: "center", cursor: "pointer", boxShadow: "0 10px 24px rgba(6,42,92,0.22)", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={() => { setAdding(false); setDraft(blank()); }}
                  style={{ height: 44, padding: "0 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)", color: "#ffffff", fontFamily: "inherit", fontSize: 15, fontWeight: 600, display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Queue list or empty state */}
          {isEmpty ? (
            <div style={{ flex: 1, marginTop: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 12, borderRadius: 20, border: "1.5px dashed rgba(255,255,255,0.5)" }}>
              <div style={{ width: 60, height: 60, borderRadius: 20, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 6h14v14H5z"/><path d="M5 10h14M9 3v4M15 3v4"/></svg>
              </div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>Nothing queued yet</div>
              <div style={{ maxWidth: 280, fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.92)" }}>Add a piece to start planning your cadence.</div>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, marginTop: 14, overflow: "hidden", display: "flex", flexDirection: "column", gap: 10 }}>
              {loadingQueue ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "rgba(255,255,255,0.85)" }}>Loading queue...</div>
              ) : queue.map((q) => (
                <div key={q.id} className="tr-row" style={{ flexShrink: 0, boxSizing: "border-box", padding: "14px 16px", borderRadius: 18, border: "1px solid rgba(255,255,255,0.34)", background: "rgba(255,255,255,0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.title}</span>
                    <button type="button" onClick={() => toggle(q.id)}
                      style={{ height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center", flexShrink: 0, cursor: "pointer", border: 0, fontFamily: "inherit", background: q.status === "Published" ? "#ecfdf3" : "#ecfdf3", color: q.status === "Published" ? "#067647" : "#067647" }}>
                      {q.status}
                    </button>
                    <button type="button" aria-label="Remove" onClick={() => remove(q.id)}
                      style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>
                      <X size={12} />
                    </button>
                  </div>
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.88)" }}>
                    <span style={{ height: 22, padding: "0 9px", borderRadius: 999, background: "rgba(255,255,255,0.22)", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>{q.format}</span>
                    <span>{fmtWhen(q.date, q.time)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cadence planner */}
        <div style={{ position: "absolute", left: 608, top: 112, width: 712, height: 470, boxSizing: "border-box", padding: 24, borderRadius: 26, ...glassCard, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexShrink: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>Cadence planner</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.88)" }}>Two-week view starting from today.</div>
          </div>
          <CadenceGrid queue={queue} />
        </div>

        {/* Amplification tips */}
        <div style={{ position: "absolute", left: 608, top: 598, width: 712, height: 250, boxSizing: "border-box", padding: "22px 24px", borderRadius: 26, ...glassCard }}>
          <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>Amplification tips</div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {TIPS.map((tip) => (
              <div key={tip} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14.5, color: "rgba(255,255,255,0.96)" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.24)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                </span>
                {tip}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
