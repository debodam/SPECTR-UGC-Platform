import { createServerFn } from "@tanstack/react-start";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { errMessage } from "./utils";
import { aiGate, checkPayload, isSignedIn } from "./server-auth";

export interface TransformInput {
  content?: string;
  pdfBase64?: string;
  context: string;
  inputType?: string;
  workspace: {
    companyName: string;
    industry: string;
    goalDescription: string;
    audience: { jobTitles: string; seniority: string; companySize: string; description: string };
  };
  // Freeform output instructions (length, structure, count, etc.)
  instructions?: string;
  // Which format to generate (required for all non-refine calls)
  format?: string;
  // true = regenerate with a fresh angle; false/absent = first-time generate
  regenerate?: boolean;
  // Refine existing output
  refine?: boolean;
  existingContent?: string;
  note?: string;
}

export interface TransformOutput {
  article?: string;
  posts?: string;
  videoScript?: string;
  error?: string;
}

const SYSTEM = `You are an expert content strategist and ghostwriter for B2B companies on LinkedIn. Transform raw source material into polished, platform-native content. Always return valid JSON with no markdown code fences. Never use em dashes (—) in your output. Do not replace em dashes with hyphens either — a hyphen used as an em dash substitute reads as AI-generated and must be avoided. Instead, rewrite any sentence that would naturally use an em dash so it flows without one. Use commas, periods, semicolons, or restructure the sentence entirely. The writing must read naturally without relying on em dashes or hyphen substitutes as a stylistic crutch.`;

function wsCtx(ws: TransformInput["workspace"]) {
  const lines: string[] = [];
  if (ws?.companyName) lines.push(`Company: ${ws.companyName}`);
  if (ws?.industry) lines.push(`Industry: ${ws.industry}`);
  if (ws?.audience?.jobTitles) lines.push(`Target audience: ${ws.audience.jobTitles}`);
  if (ws?.audience?.companySize) lines.push(`Company size: ${ws.audience.companySize}`);
  if (ws?.goalDescription) lines.push(`Goal: ${ws.goalDescription}`);
  return lines.join("\n");
}

function jsonKey(format: string) {
  return format === "Article" ? "article" : format === "Post" ? "posts" : "videoScript";
}

function videoScriptDesc(company: string, instructions?: string): string {
  const cap = `Hard maximum: 5 minutes of spoken content (approximately 750 spoken words). Never exceed this regardless of content instructions. At average speaking pace (150 words/min), 750 words = exactly 5 minutes.`;
  if (instructions?.trim()) {
    return `Structured video script. Follow the content instructions for section count and format. Use labeled sections with timestamps and full spoken text (e.g. [HOOK 0:00], [SECTION 1 0:30], ...). Write out every word to be spoken - do not summarize. First-person voice as a thought leader from ${company}. ${cap}`;
  }
  return `Structured video script as a single string with labeled sections and spoken text: [HOOK 0:00], [CONTEXT 0:08], [POINT 1 0:20], [POINT 2 0:38], [POINT 3 0:56], [CTA 1:10]. First-person voice as a thought leader from ${company}. ${cap}`;
}

function flattenValue(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    // Claude sometimes returns { headline, body } or { intro, sections, ... }
    // Flatten all string leaves into one text block
    return Object.values(v as Record<string, unknown>)
      .map((leaf) => (typeof leaf === "string" ? leaf : flattenValue(leaf)))
      .join("\n\n");
  }
  return String(v ?? "");
}

function tryParseJson(str: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(str);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = flattenValue(value);
    }
    return result;
  } catch {
    return null;
  }
}

function parseResult(raw: string, expectedKey?: string): Record<string, string> {
  // 1. Extract from a ```json ... ``` or ``` ... ``` code fence (handles extra prose before/after)
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    const r = tryParseJson(fenceMatch[1].trim());
    if (r) return r;
  }

  // 2. Strip outer fences if they span the whole response
  const cleaned = raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, "").trim();
  const r2 = tryParseJson(cleaned);
  if (r2) return r2;

  // 3. Find any {...} object anywhere in the text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const r3 = tryParseJson(jsonMatch[0]);
    if (r3) return r3;
  }

  // 4. Fallback: treat raw text as the expected content
  const fallbackKey = expectedKey ?? "article";
  return { [fallbackKey]: raw };
}

function generateAllPrompt(data: TransformInput) {
  const ctx = data.context ? `Additional context: ${data.context}\n\n` : "";
  const company = data.workspace?.companyName || "the company";
  const instrLine = data.instructions?.trim()
    ? `\n\nContent instructions (follow precisely): ${data.instructions.trim()}`
    : "";
  return `${ctx}Transform the following ${data.inputType || "content"} into three LinkedIn content formats.

${wsCtx(data.workspace)}${instrLine}

Return a JSON object with exactly three keys: "article", "posts", "videoScript". Each value MUST be a plain string - no nested objects, no arrays.

article (string): Long-form LinkedIn article. Hard maximum: 2000 words. Never exceed 2000 words regardless of content instructions - stop and wrap up the final section before that limit. Aim for 1500-1800 words. Start with a compelling headline on the first line, then the full body. First-person voice as a thought leader from ${company}. Each section must be thoroughly developed with specific examples, concrete data points, and real insights - not generic statements. If the content instructions specify a structure (pillars, frameworks, numbered sections, etc.), follow it exactly and give each element substantial depth within the word limit. Plain text only - no em dashes, no hyphen substitutes for em dashes, no JSON sub-fields, no # markdown headers. Rewrite any sentence that would use an em dash so it flows naturally with commas or periods instead.

posts (string): Exactly 3 LinkedIn posts as a single string, separated by ---. Never generate more than 3 posts regardless of content instructions. Each post has a strong hook, substantive body, and clear CTA. Vary formats: narrative story, bullet list (→), and a provocative question or bold claim.

videoScript (string): ${videoScriptDesc(company, data.instructions)}`;
}

function generateOnePrompt(data: TransformInput) {
  const ctx = data.context ? `Additional context: ${data.context}\n\n` : "";
  const company = data.workspace?.companyName || "the company";
  const format = data.format!;
  const key = jsonKey(format);
  const desc: Record<string, string> = {
    Article: `Long-form LinkedIn article. Hard maximum: 2000 words. Never exceed 2000 words regardless of content instructions - stop and wrap up the final section before that limit. Aim for 1500-1800 words. Start with a compelling headline on the first line, then the full body. First-person voice as a thought leader from ${company}. Each section must be thoroughly developed with specific examples, concrete data points, and real insights - not generic statements. If the content instructions specify a structure (pillars, frameworks, numbered sections, etc.), follow it exactly and give each element substantial depth within the word limit. Plain text only - no em dashes, no hyphen substitutes for em dashes, no JSON sub-fields, no # markdown headers. Rewrite any sentence that would use an em dash so it flows naturally with commas or periods instead.`,
    Post: `Exactly 3 LinkedIn posts as a single string, separated by ---. Never generate more than 3 posts regardless of content instructions. Each has a strong hook, substantive body, and clear CTA. Vary formats: narrative story, bullet list (→), and a provocative question or bold claim. No em dashes or hyphen substitutes for em dashes.`,
    "Video Script": videoScriptDesc(company, data.instructions),
  };
  const instrLine = data.instructions?.trim()
    ? `\n\nContent instructions (follow precisely): ${data.instructions.trim()}`
    : "";
  return {
    prompt: `${ctx}Transform the following ${data.inputType || "content"} into a LinkedIn ${format}.\n\n${wsCtx(data.workspace)}\n\n${desc[format] || ""}${instrLine}\n\nReturn ONLY a JSON object with the single key "${key}" whose value is a plain string. No markdown fences, no nested objects.`,
    key,
  };
}

function regenPrompt(data: TransformInput) {
  const ctx = data.context ? `Additional context: ${data.context}\n\n` : "";
  const company = data.workspace?.companyName || "the company";
  const format = data.format!;
  const key = jsonKey(format);
  const desc: Record<string, string> = {
    Article: `Long-form LinkedIn article. Hard maximum: 2000 words. Never exceed 2000 words regardless of content instructions. Aim for 1500-1800 words. Fresh angle, different structure from the previous version. First-person from ${company}. Each section thoroughly developed with specific examples and real insights within the word limit. If content instructions specify a structure, follow it exactly. Plain text only - no em dashes, no hyphen substitutes for em dashes, no markdown headers. Rewrite any sentence that would use an em dash so it flows naturally.`,
    Post: `Exactly 3 LinkedIn posts separated by ---. Never generate more than 3 posts regardless of content instructions. Fresh angles, strong hooks. Vary formats. No em dashes or hyphen substitutes for em dashes.`,
    "Video Script": videoScriptDesc(company, data.instructions),
  };
  const instrLine = data.instructions?.trim()
    ? `\n\nContent instructions (follow precisely): ${data.instructions.trim()}`
    : "";
  return {
    prompt: `${ctx}Regenerate the ${format} from the source content below. Use a fresh angle and different structure.\n\n${wsCtx(data.workspace)}\n\n${desc[format] || ""}${instrLine}\n\nReturn ONLY a JSON object with the single key "${key}". No markdown fences.`,
    key,
  };
}

const FORMAT_CAPS: Record<string, string> = {
  Article: "Hard maximum: 2000 words. Never exceed 2000 words.",
  Post: "Exactly 3 posts separated by ---. Never generate more than 3 posts.",
  "Video Script":
    "Hard maximum: 5 minutes of spoken content (approximately 750 spoken words). Never exceed this.",
};

function refinePrompt(data: TransformInput) {
  const format = data.format!;
  const key = jsonKey(format);
  const capLine = FORMAT_CAPS[format]
    ? `\n\nOutput limit (non-negotiable): ${FORMAT_CAPS[format]}`
    : "";
  const instrLine = data.instructions?.trim()
    ? `\n\nStanding content instructions (maintain throughout): ${data.instructions.trim()}`
    : "";
  return {
    prompt: `Refine the following ${format} based on this instruction: "${data.note}"\n\n${wsCtx(data.workspace)}${instrLine}${capLine}\n\nCurrent content:\n${data.existingContent}\n\nApply the refinement while preserving the core message and staying within the output limit. Return ONLY a JSON object with the single key "${key}". No markdown fences.`,
    key,
  };
}

function stripEmDashes(obj: TransformOutput): TransformOutput {
  // Replace em dash with a comma where it falls mid-sentence (word—word), else just a space.
  // This is a safety net only; the model is instructed not to produce them at all.
  const fix = (s?: string) =>
    s
      ?.replace(/(\w)\s*—\s*(\w)/g, "$1, $2")
      .replace(/—/g, " ")
      .replace(/ {2,}/g, " ");
  return {
    ...obj,
    article: fix(obj.article),
    posts: fix(obj.posts),
    videoScript: fix(obj.videoScript),
  };
}

export const transformContent = createServerFn({ method: "POST" })
  .inputValidator((v: TransformInput & { token?: string }) =>
    checkPayload<TransformInput & { token?: string }>(v, 15_000_000),
  )
  .handler(async ({ data }): Promise<TransformOutput> => {
    // First: the demo is refused and only signed-in users may spend tokens, whatever else is configured.
    const refused = await aiGate(data);
    if (refused) return { error: refused };
    if (!(await isSignedIn(data.token)))
      return { error: "Your session has expired. Sign in again." };

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your-api-key-here") {
      return { error: "ANTHROPIC_API_KEY is not configured." };
    }

    const client = new Anthropic({ apiKey });

    try {
      // Refine existing output
      if (data.refine) {
        const { prompt, key } = refinePrompt(data);
        const refineTok =
          data.format === "Article" ? 3200 : data.format === "Video Script" ? 1500 : 1500;
        const msg = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: refineTok,
          system: SYSTEM,
          messages: [{ role: "user", content: prompt }],
        });
        const raw = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
        const result = parseResult(raw, key);
        return stripEmDashes({ [key]: result[key] ?? raw } as TransformOutput);
      }

      // Single format - generate or regenerate
      if (data.format) {
        const { prompt, key } = data.regenerate ? regenPrompt(data) : generateOnePrompt(data);
        const messages: MessageParam[] = data.pdfBase64
          ? [
              {
                role: "user",
                content: [
                  {
                    type: "document",
                    source: { type: "base64", media_type: "application/pdf", data: data.pdfBase64 },
                  },
                  { type: "text", text: prompt },
                ],
              },
            ]
          : [
              {
                role: "user",
                content: `${prompt}\n\nSource content:\n${(data.content ?? "").slice(0, 60000)}`,
              },
            ];
        const maxTok =
          data.format === "Article" ? 3200 : data.format === "Video Script" ? 1500 : 1500;
        const msg = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: maxTok,
          system: SYSTEM,
          messages,
        });
        const raw = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
        const result = parseResult(raw, key);
        return stripEmDashes({ [key]: result[key] ?? raw } as TransformOutput);
      }

      // Fallback: full generation (kept for compatibility)
      const prompt = generateAllPrompt(data);
      const messages: MessageParam[] = data.pdfBase64
        ? [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: { type: "base64", media_type: "application/pdf", data: data.pdfBase64 },
                },
                { type: "text", text: prompt },
              ],
            },
          ]
        : [
            {
              role: "user",
              content: `${prompt}\n\nSource content:\n${(data.content ?? "").slice(0, 60000)}`,
            },
          ];
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: SYSTEM,
        messages,
      });
      const raw = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
      return stripEmDashes(parseResult(raw) as TransformOutput);
    } catch (err) {
      console.error("Transform error:", err);
      return { error: errMessage(err) ?? "Generation failed." };
    }
  });
