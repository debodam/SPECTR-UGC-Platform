/**
 * Generation in the demo: always prewritten outputs from src/demo/seed, so Transform is instant, never fails and
 * never spends tokens. Text the visitor types or pastes picks the closest sample for the chosen format.
 */
import { TOUR_PLAY, SEED_GENERATIONS, SEED_TRANSCRIPTS } from "./seed/content";
import { demoEvent } from "./mode";
import type { TransformInput } from "@/lib/transform-fn";

type Out = { article?: string; posts?: string; videoScript?: string; error?: string };
type TabFormat = "Article" | "Post" | "Video Script";
const KEY: Record<TabFormat, keyof Out> = {
  Article: "article",
  Post: "posts",
  "Video Script": "videoScript",
};

export const DEMO_SAMPLE_NOTE =
  "Demo uses sample outputs. The full product writes from your own text.";

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

const STOP = new Set(
  "the a an and or but of to in on for with is it that this we they you i our was are be as at by not so".split(
    " ",
  ),
);
const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );

/** True when the text is one of the demo's own takes (the tour recording or a seeded transcript). */
export function isSampleText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  const tour = TOUR_PLAY.sampleRecording.chunks.join(" ");
  return [tour, ...SEED_TRANSCRIPTS.map((s) => s.text)].some(
    (s) => s.includes(t.slice(0, 120)) || t.includes(s.slice(0, 120)),
  );
}

/** The prewritten output for this format whose words overlap most with what the visitor wrote. */
export function closestOutput(format: TabFormat, text: string): string {
  const mine = words(text);
  const pool = [
    TOUR_PLAY.outputs[format],
    ...SEED_GENERATIONS.filter((g) => g.format === format).map((g) => g.content),
  ];
  let best = pool[0],
    score = -1;
  for (const c of pool) {
    const theirs = words(c);
    let s = 0;
    for (const w of mine) if (theirs.has(w)) s++;
    if (s > score) {
      best = c;
      score = s;
    }
  }
  return best;
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
  const source = input.content ?? "";
  const own = !!source.trim() && !isSampleText(source);
  demoEvent("generate", { format, own });
  return {
    [KEY[format]]: own ? closestOutput(format, source) : cachedOutput(format, playKey),
  };
}
