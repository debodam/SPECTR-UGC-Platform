/**
 * Generation in the demo: prewritten outputs so Transform is instant and never fails.
 * "Try your own topic" may make a real call (at most 3 per session) and falls back to cached output on any problem.
 */
import { TOUR_PLAY, SEED_GENERATIONS } from "./seed/content";
import { DEMO_KEYS, demoEvent } from "./mode";
import type { TransformInput } from "@/lib/transform-fn";

type Out = { article?: string; posts?: string; videoScript?: string; error?: string };
type TabFormat = "Article" | "Post" | "Video Script";
const KEY: Record<TabFormat, keyof Out> = {
  Article: "article",
  Post: "posts",
  "Video Script": "videoScript",
};

export const LIVE_LIMIT = 3;
export const liveUsed = () => Number(sessionStorage.getItem(DEMO_KEYS.live) || 0);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Picks the prewritten piece for this play and format. */
export function cachedOutput(format: TabFormat, playKey?: string | null): string {
  const key = playKey?.replace(/^demo-/, "");
  if (!key || key === TOUR_PLAY.playKey) return TOUR_PLAY.outputs[format];
  return (
    SEED_GENERATIONS.find((g) => g.playKey === key && g.format === format)?.content ??
    SEED_GENERATIONS.find((g) => g.format === format)?.content ??
    TOUR_PLAY.outputs[format]
  );
}

export async function demoTransform(input: TransformInput, playKey?: string | null): Promise<Out> {
  const format = (input.format as TabFormat) || "Post";
  await sleep(1100);
  if (input.refine) {
    demoEvent("refine");
    const text =
      format === "Post"
        ? TOUR_PLAY.refineExample.result
        : (input.existingContent ?? cachedOutput(format, playKey));
    return { [KEY[format]]: text };
  }
  demoEvent("generate", { format });
  return { [KEY[format]]: cachedOutput(format, playKey) };
}

/** One live generation for a visitor's own topic. Returns null when it should fall back to cached output. */
export async function demoLiveTransform(
  run: (input: TransformInput & { demo: true }) => Promise<Out>,
  input: TransformInput,
): Promise<string | null> {
  if (liveUsed() >= LIVE_LIMIT) return null;
  sessionStorage.setItem(DEMO_KEYS.live, String(liveUsed() + 1));
  const format = (input.format as TabFormat) || "Post";
  try {
    const out = await Promise.race([
      run({ ...input, demo: true }),
      sleep(25000).then(() => ({ error: "timeout" }) as Out),
    ]);
    const text = out[KEY[format]];
    demoEvent("live generation", { ok: !!text });
    return !out.error && typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null;
  }
}
