import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Markdown } from "@/components/spectr/Markdown";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Calendar, Check, CheckCheck, Copy, ExternalLink, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AppGate, AppHeader, AppRail } from "@/components/spectr/AppChrome";
import { PlayBanner } from "@/components/spectr/GrowthCards";
import { useApp, type Format } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";
import { playSearch, usePlay } from "@/lib/use-growth";
import { advancePlay, insertWithLinks, loadAllPlays, type RepoCtx } from "@/lib/growth-repo";
import { toAppFormat, type Play } from "@/lib/growth-types";
import {
  createPendingResult,
  isDue,
  linkedInComposeUrl,
  plannedAt,
  postFromRow,
  postText,
  setPostStatus,
  type PostItem,
  type PostStatus,
} from "@/lib/posting";
import { copyText, errMessage, friendlyError } from "@/lib/utils";
import { DemoLock } from "@/demo/DemoLock";

export const Route = createFileRoute("/distribute")({
  component: () => (
    <AppGate>
      <DistributePage />
    </AppGate>
  ),
  validateSearch: playSearch,
});

const FORMATS: Format[] = ["Article", "Post", "Video Script"];
const TIPS = [
  "Tag 2 to 3 industry peers in the post for early engagement.",
  "Reply to every comment within the first 90 minutes.",
  "Ask 2 colleagues to engage within the first hour of posting.",
  "Cross-post a key stat as a follow-up 48 hours later.",
];
const STATUS_LABEL: Record<PostStatus | "due", string> = {
  draft: "Draft",
  ready: "Ready",
  due: "Due now",
  posted: "Posted",
};

interface Draft {
  title: string;
  content: string;
  format: Format;
  date: string;
  time: string;
  status: PostStatus;
}
const blank = (): Draft => ({
  title: "",
  content: "",
  format: "Post",
  date: new Date().toISOString().slice(0, 10),
  time: "09:00",
  status: "ready",
});

function fmtWhen(p: Pick<PostItem, "date" | "time">) {
  const d = plannedAt(p);
  if (isNaN(d.getTime())) return `${p.date} at ${p.time}`;
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function CadenceGrid({ queue }: { queue: PostItem[] }) {
  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));
  const days = useMemo(() => {
    const base = new Date(todayStr + "T00:00:00");
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [todayStr]);
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="ds-cadence-wrap" style={{ marginTop: 14 }}>
      <div className="ds-cadence ds-cal">
        {days.map((d) => {
          const key = d.toISOString().slice(0, 10);
          const items = queue.filter((q) => q.date === key && q.status !== "draft");
          const isToday = key === todayStr;
          return (
            <div key={key} className={`ds-cal-day${isToday ? " is-today" : ""}`}>
              <div className="ds-cal-dow">{DOW[d.getDay()]}</div>
              <div className="ds-cal-num">{d.getDate()}</div>
              {items.slice(0, 2).map((q) => (
                <div
                  key={q.id}
                  className={`ds-cal-tag${q.status === "posted" ? " is-posted" : ""}`}
                >
                  {q.format === "Video Script" ? "Video" : q.format}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Browser notifications for items whose planned time arrives while the app is open. */
function useDueNotifications(queue: PostItem[]) {
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    const check = () => {
      if (Notification.permission !== "granted") return;
      const seen = new Set<string>(JSON.parse(localStorage.getItem("spectr-due-notified") || "[]"));
      for (const q of queue) {
        if (isDue(q) && !seen.has(q.id)) {
          new Notification("A post is due", {
            body: `${q.title}. Copy it or open LinkedIn to post.`,
          });
          seen.add(q.id);
        }
      }
      localStorage.setItem("spectr-due-notified", JSON.stringify([...seen]));
    };
    check();
    const iv = setInterval(check, 60_000);
    return () => clearInterval(iv);
  }, [queue]);
}

function DistributePage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const ws = state.workspace;
  const companyId = ws.companyId;
  const userId = state.user?.id;
  const ctx: RepoCtx | null = useMemo(
    () => (companyId && userId ? { companyId, userId } : null),
    [companyId, userId],
  );
  const { play: playId } = Route.useSearch();
  const { play, refresh: refreshPlay } = usePlay(ctx, playId);

  const [queue, setQueue] = useState<PostItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank());
  const [linkPlayId, setLinkPlayId] = useState("");
  const [saving, setSaving] = useState(false);
  const [titleErr, setTitleErr] = useState(false);
  const [plays, setPlays] = useState<Play[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [notifyPerm, setNotifyPerm] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const titleRef = useRef<HTMLInputElement>(null);

  const load = () => {
    if (!companyId) {
      setStatus("ready");
      return;
    }
    setStatus("loading");
    supabase
      .from("queue_items")
      .select("*")
      .eq("company_id", companyId)
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setStatus("error");
          return;
        }
        setQueue((data ?? []).map(postFromRow));
        setStatus("ready");
      });
  };

  useEffect(load, [companyId]);
  useEffect(() => {
    if (ctx)
      loadAllPlays(ctx)
        .then(setPlays)
        .catch(() => setPlays([]));
  }, [ctx]);
  // Re-evaluate due badges every minute.
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(iv);
  }, []);
  useDueNotifications(queue);

  const fillFromPlay = async (p: Play | undefined) => {
    if (!p) {
      setLinkPlayId("");
      return;
    }
    setLinkPlayId(p.id);
    let content = "";
    if (p.linkedContentId) {
      const { data } = await supabase
        .from("generations")
        .select("content")
        .eq("id", p.linkedContentId)
        .maybeSingle();
      content = (data?.content as string) || "";
    }
    setDraft((d) => ({
      ...d,
      title: p.title,
      format: toAppFormat(p.format),
      content: content || d.content,
    }));
  };

  // Opened from a play: open the add form prefilled with its title, format and generated text.
  useEffect(() => {
    if (play && !["scheduled", "posted", "measured"].includes(play.status)) {
      setAdding(true);
      fillFromPlay(play);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play?.id]);

  const save = async () => {
    if (!draft.title.trim()) {
      setTitleErr(true);
      titleRef.current?.focus();
      return;
    }
    if (!companyId || !userId) {
      toast.error("No active workspace. Pick a company first.");
      return;
    }
    setSaving(true);
    const row = {
      id: crypto.randomUUID(),
      company_id: companyId,
      user_id: userId,
      title: draft.title.trim(),
      format: draft.format,
      date: draft.date,
      time: draft.time,
      status: draft.status,
    };
    const { data, error } = await insertWithLinks("queue_items", row, {
      content: draft.content.trim(),
      platform: "LinkedIn",
      play_id: linkPlayId,
    });
    setSaving(false);
    if (error || !data) {
      toast.error("Could not add it to the queue", { description: friendlyError(error) });
      return;
    }
    const item = postFromRow({
      ...row,
      content: draft.content.trim(),
      play_id: linkPlayId || null,
      ...data,
    });
    setQueue((prev) =>
      [...prev, item].sort((a, b) => plannedAt(a).getTime() - plannedAt(b).getTime()),
    );
    if (ctx && linkPlayId) {
      await advancePlay(ctx, linkPlayId, "scheduled").catch(() => {});
      refreshPlay();
    }
    setDraft(blank());
    setLinkPlayId("");
    setAdding(false);
    setTitleErr(false);
    toast.success(item.status === "draft" ? "Saved as a draft" : "Your post is ready", {
      description:
        item.status === "draft" ? undefined : "Copy it or open LinkedIn to post when it is time.",
    });
  };

  const copy = async (q: PostItem) => {
    try {
      await copyText(postText(q));
      setCopied(q.id);
      setTimeout(() => setCopied((c) => (c === q.id ? null : c)), 1800);
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  };

  const markReady = async (q: PostItem) => {
    setBusy(q.id);
    const { error } = await setPostStatus(q.id, "ready");
    setBusy(null);
    if (error) {
      toast.error("Could not update the post", { description: error });
      return;
    }
    setQueue((prev) => prev.map((x) => (x.id === q.id ? { ...x, status: "ready" } : x)));
  };

  const markPosted = async (q: PostItem) => {
    if (!companyId || !userId) return;
    setBusy(q.id);
    const { error } = await setPostStatus(q.id, "posted");
    if (error) {
      setBusy(null);
      toast.error("Could not mark it as posted", { description: error });
      return;
    }
    setQueue((prev) =>
      prev.map((x) =>
        x.id === q.id ? { ...x, status: "posted", postedAt: new Date().toISOString() } : x,
      ),
    );
    if (ctx && q.playId) advancePlay(ctx, q.playId, "posted").catch(() => {});
    try {
      await createPendingResult(companyId, userId, q);
      toast.success("Marked as posted", {
        description: "Come back in 24 to 48 hours to log how it did.",
        action: { label: "Open Results", onClick: () => navigate({ to: "/results" }) },
      });
    } catch (e) {
      toast.success("Marked as posted", {
        description: "Log its numbers in Results when they are in.",
      });
    }
    setBusy(null);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("queue_items").delete().eq("id", id);
    if (error) {
      toast.error("Could not remove it", { description: friendlyError(error) });
      return;
    }
    setQueue((prev) => prev.filter((q) => q.id !== id));
    toast("Removed from the queue");
  };

  const askNotify = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotifyPerm(p);
    if (p === "granted")
      toast.success("We will remind you when a post is due", {
        description: "Reminders appear while SPECTR is open.",
      });
  };

  const open = queue.filter((q) => q.status !== "posted");
  const posted = queue
    .filter((q) => q.status === "posted")
    .slice(-5)
    .reverse();
  const dueCount = queue.filter((q) => isDue(q)).length;

  return (
    <div className="sx-shell">
      <AppRail active="/distribute" />
      <AppHeader
        title="Distribute"
        subtitle="Plan each post, then copy it or open LinkedIn when it is time."
        actions={
          notifyPerm === "default" ? (
            <DemoLock>
              <button
                type="button"
                className="gh-btn gh-btn--ghost"
                onClick={askNotify}
                aria-label="Remind me when a post is due"
              >
                <Bell size={15} aria-hidden="true" />
                <span className="sx-hide-sm">Remind me when due</span>
              </button>
            </DemoLock>
          ) : undefined
        }
      />

      <main className="sx-main">
        <div className="sx-page">
          {play && (
            <PlayBanner
              play={play}
              note={
                ["scheduled", "posted", "measured"].includes(play.status)
                  ? "In your posting queue. When it is live and the numbers are in, log them in Results."
                  : "Pick a date and time below. The post keeps this play's title, format and generated text."
              }
              onClear={() => navigate({ to: "/distribute", search: {} })}
              action={
                ["scheduled", "posted"].includes(play.status) ? (
                  <button
                    type="button"
                    className="gh-btn gh-btn--primary"
                    onClick={() => navigate({ to: "/results", search: { play: play.id } })}
                  >
                    Log results
                  </button>
                ) : undefined
              }
            />
          )}

          <div className="ds-layout">
            {/* Posting queue */}
            <section
              className="sx-glass ds-queue ds-panel"
              aria-labelledby="ds-q-h"
              data-tour="posting-queue"
            >
              <div className="ds-panel-head">
                <h2 id="ds-q-h" className="ds-h2">
                  Posting queue
                </h2>
                {dueCount > 0 && <span className="ds-badge ds-badge--due">{dueCount} due</span>}
                <button
                  type="button"
                  className="gh-btn gh-btn--primary ds-add"
                  onClick={() => {
                    setAdding(true);
                    setDraft(blank());
                    setLinkPlayId("");
                  }}
                >
                  <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
                  Add to queue
                </button>
              </div>

              {adding && (
                <div className="ds-form">
                  {plays.some((p) => !["scheduled", "posted", "measured"].includes(p.status)) && (
                    <>
                      <label htmlFor="ds-play" className="ds-label">
                        From a play
                      </label>
                      <select
                        id="ds-play"
                        className="tf-in ds-input"
                        value={linkPlayId}
                        onChange={(e) => fillFromPlay(plays.find((p) => p.id === e.target.value))}
                      >
                        <option value="">Not from a play</option>
                        {plays
                          .filter(
                            (p) =>
                              !["scheduled", "posted", "measured"].includes(p.status) ||
                              p.id === linkPlayId,
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                      </select>
                    </>
                  )}
                  <label htmlFor="ds-title" className="ds-label">
                    Title
                  </label>
                  <input
                    id="ds-title"
                    ref={titleRef}
                    autoFocus
                    className="tf-in ds-input"
                    type="text"
                    placeholder="What is this post about?"
                    value={draft.title}
                    aria-invalid={titleErr}
                    onChange={(e) => {
                      setDraft({ ...draft, title: e.target.value });
                      setTitleErr(false);
                    }}
                  />
                  {titleErr && <div className="ds-err">Add a title so you can find it later</div>}
                  <label htmlFor="ds-content" className="ds-label">
                    Post text <span className="su-optional">Optional</span>
                  </label>
                  <textarea
                    id="ds-content"
                    className="tf-in ds-input ds-textarea"
                    placeholder="Paste the post you will publish. Copy post and Open LinkedIn use this text."
                    value={draft.content}
                    onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  />
                  <div className="ds-label">Format</div>
                  <div className="ds-seg" role="group" aria-label="Format">
                    {FORMATS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={draft.format === f}
                        className={draft.format === f ? "is-on" : ""}
                        onClick={() => setDraft({ ...draft, format: f })}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="ds-row">
                    <div>
                      <label htmlFor="ds-date" className="ds-label">
                        Date
                      </label>
                      <input
                        id="ds-date"
                        className="tf-in ds-input"
                        type="date"
                        value={draft.date}
                        onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                        style={{ colorScheme: "dark" }}
                      />
                    </div>
                    <div>
                      <label htmlFor="ds-time" className="ds-label">
                        Time
                      </label>
                      <input
                        id="ds-time"
                        className="tf-in ds-input"
                        type="time"
                        value={draft.time}
                        onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                        style={{ colorScheme: "dark" }}
                      />
                    </div>
                  </div>
                  <label className="ds-check">
                    <input
                      type="checkbox"
                      checked={draft.status === "draft"}
                      onChange={(e) =>
                        setDraft({ ...draft, status: e.target.checked ? "draft" : "ready" })
                      }
                    />{" "}
                    Save as a draft for now
                  </label>
                  <div className="ds-form-actions">
                    <button
                      type="button"
                      className="gh-btn gh-btn--primary"
                      style={{ flex: 1 }}
                      disabled={saving}
                      onClick={save}
                    >
                      {saving ? "Saving" : draft.status === "draft" ? "Save draft" : "Add to queue"}
                    </button>
                    <button
                      type="button"
                      className="gh-btn"
                      onClick={() => {
                        setAdding(false);
                        setDraft(blank());
                        setTitleErr(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {status === "loading" ? (
                <div className="ds-list" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="tf-sk gh-sk" style={{ height: 92, borderRadius: 18 }} />
                  ))}
                </div>
              ) : status === "error" ? (
                <div className="ds-empty" role="alert">
                  <div className="ds-empty-title">We could not load your queue</div>
                  <button type="button" className="gh-btn gh-btn--small" onClick={load}>
                    Try again
                  </button>
                </div>
              ) : !open.length && !adding ? (
                <div className="ds-empty">
                  <div className="db-empty-icon">
                    <Calendar size={26} strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <div className="ds-empty-title">Nothing queued yet</div>
                  <div className="ds-empty-sub">
                    Add a post and a time. When it is due, copy it or open LinkedIn to post it.
                  </div>
                </div>
              ) : (
                <ul className="ds-list" aria-label="Queued posts">
                  {open.map((q) => {
                    const due = isDue(q);
                    const tag = due ? "due" : q.status;
                    return (
                      <li
                        key={q.id}
                        className={`ds-item${due ? " is-due" : ""}`}
                        data-tour="queue-item"
                        data-queue-id={q.id}
                      >
                        <div className="ds-item-top">
                          <span className="ds-item-title">{q.title}</span>
                          <span className={`ds-badge ds-badge--${tag}`}>{STATUS_LABEL[tag]}</span>
                          <button
                            type="button"
                            className="ds-icon"
                            aria-label={`Remove ${q.title}`}
                            onClick={() => remove(q.id)}
                          >
                            <X size={13} />
                          </button>
                        </div>
                        <div className="ds-item-meta">
                          <span className="ds-pill">{q.format}</span>
                          <span className="ds-pill">{q.platform}</span>
                          <span>{fmtWhen(q)}</span>
                          {q.playId && <span className="ds-from">From a play</span>}
                        </div>
                        {q.content && (
                          <Markdown text={q.content} compact className="ds-item-text" />
                        )}
                        {due && (
                          <div className="ds-due-note">
                            Your post is ready. Copy it or open LinkedIn to post.
                          </div>
                        )}
                        <div className="ds-actions">
                          <button
                            type="button"
                            className="gh-btn gh-btn--small"
                            onClick={() => copy(q)}
                            aria-live="polite"
                            data-tour="copy-post"
                          >
                            {copied === q.id ? (
                              <>
                                <Check size={14} aria-hidden="true" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy size={14} aria-hidden="true" />
                                Copy post
                              </>
                            )}
                          </button>
                          <DemoLock>
                            <a
                              className="gh-btn gh-btn--small"
                              href={linkedInComposeUrl(postText(q))}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink size={14} aria-hidden="true" />
                              Open LinkedIn
                            </a>
                          </DemoLock>
                          {q.status === "draft" ? (
                            <button
                              type="button"
                              className="gh-btn gh-btn--small"
                              disabled={busy === q.id}
                              onClick={() => markReady(q)}
                            >
                              Mark ready
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="gh-btn gh-btn--small gh-btn--primary"
                              disabled={busy === q.id}
                              onClick={() => markPosted(q)}
                              data-tour="mark-posted"
                            >
                              <CheckCheck size={14} aria-hidden="true" />
                              Mark as posted
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {posted.length > 0 && (
                <div className="ds-posted">
                  <div className="ds-label" style={{ marginTop: 0 }}>
                    Recently posted
                  </div>
                  {posted.map((q) => (
                    <div key={q.id} className="ds-posted-row">
                      <Check size={14} aria-hidden="true" />
                      <span>{q.title}</span>
                      <button
                        type="button"
                        className="gh-link ds-linkbtn"
                        onClick={() => navigate({ to: "/results" })}
                      >
                        Log results
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="ds-side">
              {/* Cadence planner */}
              <section className="sx-glass ds-panel" aria-labelledby="ds-cad-h">
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "4px 12px",
                    flexWrap: "wrap",
                  }}
                >
                  <h2 id="ds-cad-h" className="ds-h2">
                    Cadence planner
                  </h2>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.88)" }}>
                    Two-week view starting from today.
                  </div>
                </div>
                <CadenceGrid queue={queue} />
              </section>

              {/* Amplification tips */}
              <section className="sx-glass ds-panel" aria-labelledby="ds-tips-h">
                <h2 id="ds-tips-h" className="ds-h2">
                  Amplification tips
                </h2>
                <ul
                  style={{
                    listStyle: "none",
                    margin: "14px 0 0",
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {TIPS.map((tip) => (
                    <li
                      key={tip}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        lineHeight: 1.45,
                        fontSize: 14.5,
                        color: "rgba(255,255,255,0.96)",
                      }}
                    >
                      <span className="ds-tip-dot">
                        <Check size={13} strokeWidth={2.6} aria-hidden="true" />
                      </span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
