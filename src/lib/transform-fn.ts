import { createServerFn } from "@tanstack/react-start";

export interface TransformInput {
  content?: string;
  pdfBase64?: string;
  context: string;
  inputType: string;
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

const SYSTEM = `You are an expert content strategist and ghostwriter for B2B companies on LinkedIn. Transform raw source material into polished, platform-native content. Always return valid JSON with no markdown code fences.`;

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

Return a JSON object with exactly three keys: "article", "posts", "videoScript". Each value MUST be a plain string — no nested objects, no arrays.

article (string): Long-form LinkedIn article (800–1200 words). Start with a compelling headline on the first line, then the body. First-person voice as a thought leader from ${company}. Plain text only — no JSON sub-fields, no # markdown headers.

posts (string): Three LinkedIn posts as a single string, separated by ---. Each post has a strong hook, substantive body, and clear CTA. Vary formats: narrative story, bullet list (→), and a provocative question or bold claim.

videoScript (string): Structured video script as a single string with labeled sections and spoken text: [HOOK 0:00], [CONTEXT 0:08], [POINT 1 0:20], [POINT 2 0:38], [POINT 3 0:56], [CTA 1:10]. Target 60–90 seconds.`;
}

function generateOnePrompt(data: TransformInput) {
  const ctx = data.context ? `Additional context: ${data.context}\n\n` : "";
  const company = data.workspace?.companyName || "the company";
  const format = data.format!;
  const key = jsonKey(format);
  const desc: Record<string, string> = {
    Article: `Long-form LinkedIn article (800–1200 words). Start with a compelling headline on the first line, then the body. First-person voice as a thought leader from ${company}. Plain text only — no JSON sub-fields, no # markdown headers.`,
    Post: `Three LinkedIn posts as a single string, separated by ---. Each has a strong hook, substantive body, and clear CTA. Vary formats: narrative story, bullet list (→), and a provocative question or bold claim.`,
    "Video Script": `Structured video script as a single string with labeled sections and spoken text: [HOOK 0:00], [CONTEXT 0:08], [POINT 1 0:20], [POINT 2 0:38], [POINT 3 0:56], [CTA 1:10]. Target 60–90 seconds.`,
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
    Article: `Long-form article (800–1200 words). Fresh angle. First-person from ${company}. Plain text.`,
    Post: `Three LinkedIn posts separated by ---. Fresh angles, strong hooks. Vary formats.`,
    "Video Script": `Script: [HOOK 0:00], [CONTEXT 0:08], [POINT 1–3], [CTA 1:10]. 60–90 seconds.`,
  };
  const instrLine = data.instructions?.trim()
    ? `\n\nContent instructions (follow precisely): ${data.instructions.trim()}`
    : "";
  return {
    prompt: `${ctx}Regenerate the ${format} from the source content below. Use a fresh angle and different structure.\n\n${wsCtx(data.workspace)}\n\n${desc[format] || ""}${instrLine}\n\nReturn ONLY a JSON object with the single key "${key}". No markdown fences.`,
    key,
  };
}

function refinePrompt(data: TransformInput) {
  const format = data.format!;
  const key = jsonKey(format);
  const instrLine = data.instructions?.trim()
    ? `\n\nStanding content instructions (maintain throughout): ${data.instructions.trim()}`
    : "";
  return {
    prompt: `Refine the following ${format} based on this instruction: "${data.note}"\n\n${wsCtx(data.workspace)}${instrLine}\n\nCurrent content:\n${data.existingContent}\n\nApply the refinement while preserving the core message. Return ONLY a JSON object with the single key "${key}". No markdown fences.`,
    key,
  };
}

export const transformContent = createServerFn({ method: "POST" })
  .inputValidator((v: TransformInput) => v)
  .handler(async ({ data }): Promise<TransformOutput> => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your-api-key-here") {
      return { error: "ANTHROPIC_API_KEY is not configured in .env." };
    }

    const client = new Anthropic({ apiKey });

    try {
      // Refine existing output
      if (data.refine) {
        const { prompt, key } = refinePrompt(data);
        const msg = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: SYSTEM,
          messages: [{ role: "user", content: prompt }],
        });
        const raw = (msg.content[0] as any).text ?? "";
        const result = parseResult(raw, key);
        return { [key]: result[key] ?? raw } as TransformOutput;
      }

      // Single format — generate or regenerate
      if (data.format) {
        const { prompt, key } = data.regenerate ? regenPrompt(data) : generateOnePrompt(data);
        const messages: any[] = data.pdfBase64
          ? [{ role: "user", content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: data.pdfBase64 } },
              { type: "text", text: prompt },
            ]}]
          : [{ role: "user", content: `${prompt}\n\nSource content:\n${data.content ?? ""}` }];
        const msg = await client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 2048, system: SYSTEM, messages });
        const raw = (msg.content[0] as any).text ?? "";
        const result = parseResult(raw, key);
        return { [key]: result[key] ?? raw } as TransformOutput;
      }

      // Fallback: full generation (kept for compatibility)
      const prompt = generateAllPrompt(data);
      const messages: any[] = data.pdfBase64
        ? [{ role: "user", content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: data.pdfBase64 } },
            { type: "text", text: prompt },
          ]}]
        : [{ role: "user", content: `${prompt}\n\nSource content:\n${data.content ?? ""}` }];
      const msg = await client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 4096, system: SYSTEM, messages });
      const raw = (msg.content[0] as any).text ?? "";
      return parseResult(raw) as TransformOutput;
    } catch (err: any) {
      console.error("Transform error:", err);
      return { error: err.message ?? "Generation failed." };
    }
  });
