import supabase from "./supabase";
import type { Format } from "./spectr-store";

/**
 * Posting queue. LinkedIn's API does not allow third-party scheduling for this app, so nothing here publishes.
 * Items are planned, the user copies the post or opens LinkedIn's composer, then marks it posted.
 */

export type PostStatus = "draft" | "ready" | "posted";

export interface PostItem {
  id: string;
  title: string;
  content: string;
  platform: string;
  format: Format;
  date: string;
  time: string;
  status: PostStatus;
  postedAt: string | null;
  playId: string | null;
}

/** Older rows used Scheduled and Published. */
export function normalizeStatus(s: unknown): PostStatus {
  const v = String(s || "").toLowerCase();
  if (v === "posted" || v === "published") return "posted";
  if (v === "draft") return "draft";
  return "ready";
}

export function postFromRow(row: Record<string, unknown>): PostItem {
  return {
    id: row.id as string,
    title: (row.title as string) || "Untitled",
    content: (row.content as string) || "",
    platform: (row.platform as string) || "LinkedIn",
    format: (row.format as Format) || "Post",
    date: row.date as string,
    time: (row.time as string) || "09:00",
    status: normalizeStatus(row.status),
    postedAt: (row.posted_at as string) ?? null,
    playId: (row.play_id as string) ?? null,
  };
}

export const plannedAt = (p: Pick<PostItem, "date" | "time">) =>
  new Date(`${p.date}T${p.time || "09:00"}`);

/** A ready item whose planned time has arrived. */
export const isDue = (p: PostItem, now = new Date()) =>
  p.status === "ready" && plannedAt(p).getTime() <= now.getTime();

export const postText = (p: Pick<PostItem, "title" | "content">) =>
  p.content.trim() ? p.content.trim() : p.title;

/** LinkedIn's share composer prefilled with the post text (works for text posts). */
export const linkedInComposeUrl = (text: string) =>
  `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;

function missingColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const m = (error.message || "").toLowerCase();
  return (
    ["42703", "PGRST204"].includes(error.code || "") ||
    m.includes("column") ||
    m.includes("schema cache")
  );
}

/** Sets status, and the posted timestamp when that column exists (migration 011). */
export async function setPostStatus(
  id: string,
  status: PostStatus,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("queue_items").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  if (status === "posted") {
    await supabase
      .from("queue_items")
      .update({ posted_at: new Date().toISOString() })
      .eq("id", id)
      .then(() => {});
  }
  return { error: null };
}

// ── Pending results ─────────────────────────────────────────────────────────

export interface PendingResult {
  id: string;
  title: string;
  format: Format;
  date: string;
  playId: string | null;
  /** Where it lives: a pending perf_entries row, or this device until migration 011 is applied. */
  store: "db" | "local";
}

const localKey = (companyId: string) => `spectr-pending-results:${companyId}`;
export function loadLocalPending(companyId: string): PendingResult[] {
  try {
    return JSON.parse(localStorage.getItem(localKey(companyId)) || "[]");
  } catch {
    return [];
  }
}
function saveLocalPending(companyId: string, list: PendingResult[]) {
  localStorage.setItem(localKey(companyId), JSON.stringify(list));
}
export function removeLocalPending(companyId: string, id: string) {
  saveLocalPending(
    companyId,
    loadLocalPending(companyId).filter((p) => p.id !== id),
  );
}

/** After Mark as posted: a placeholder Results entry that nudges the user to add numbers in 24 to 48 hours. */
export async function createPendingResult(
  companyId: string,
  userId: string,
  item: Pick<PostItem, "title" | "format" | "playId">,
): Promise<PendingResult> {
  const date = new Date().toISOString().slice(0, 10);
  const row: Record<string, unknown> = {
    company_id: companyId,
    user_id: userId,
    date,
    title: item.title,
    format: item.format,
    source: "Draft",
    impressions: 0,
    engagement_rate: 0,
    followers_gained: 0,
    notes: "",
    pending: true,
  };
  if (item.playId) row.play_id = item.playId;
  const { data, error } = await supabase.from("perf_entries").insert(row).select("id").single();
  if (!error && data)
    return {
      id: data.id as string,
      title: item.title,
      format: item.format,
      date,
      playId: item.playId,
      store: "db",
    };
  if (error && !missingColumn(error)) throw new Error(error.message);
  const local: PendingResult = {
    id: crypto.randomUUID(),
    title: item.title,
    format: item.format,
    date,
    playId: item.playId,
    store: "local",
  };
  saveLocalPending(companyId, [local, ...loadLocalPending(companyId)]);
  return local;
}
