import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Message from an unknown thrown value, or undefined if it has none. */
export function errMessage(e: unknown): string | undefined {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: unknown }).message);
  return typeof e === "string" ? e : undefined;
}

/** Copies text, falling back to a hidden textarea when the async clipboard API is unavailable or refused. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("Copy was blocked by the browser");
  }
}

/** Turns a raw error into a calm sentence for the UI. Raw details stay in the console. */
export function friendlyError(
  e: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const m = (errMessage(e) || "").toLowerCase();
  if (!m) return fallback;
  if (m.includes("api_key") || m.includes("api key") || m.includes("not configured"))
    return "The writing service is not set up on this server yet. Add the Anthropic key to the server environment.";
  if (m.includes("rate") || m.includes("429"))
    return "The writing service is busy right now. Wait a moment and try again.";
  if (m.includes("overloaded") || m.includes("529") || m.includes("503"))
    return "The writing service is overloaded right now. Try again in a minute.";
  if (m.includes("timeout") || m.includes("timed out"))
    return "That took too long. Try again, or use a shorter source.";
  if (m.includes("failed to fetch") || m.includes("network") || m.includes("load failed"))
    return "You appear to be offline. Check your connection and try again.";
  if (m.includes("too long") || m.includes("prompt is too long") || m.includes("too large"))
    return "That source is too long. Trim it and try again.";
  if (m.includes("jwt") || m.includes("auth") || m.includes("401"))
    return "Your session has expired. Sign in again.";
  return fallback;
}

/** Longest source sent to the model; the rest is cut so requests stay fast and within limits. */
export const MAX_SOURCE_CHARS = 60000;
