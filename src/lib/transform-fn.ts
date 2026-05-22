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
  // Regenerate a single format
  format?: string;
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

function parseResult(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { article: raw, posts: "", videoScript: "" };
  }
}

function generateAllPrompt(data: TransformInput) {
  const ctx = data.context ? `Additional context: ${data.context}\n\n` : "";
  const company = data.workspace?.companyName || "the company";
  return `${ctx}Transform the following ${data.inputType || "content"} into three LinkedIn content formats.

${wsCtx(data.workspace)}

Return a JSON object with exactly three keys: "article", "posts", "videoScript".

article: Long-form LinkedIn article (800–1200 words). Compelling headline, structured sections, strong conclusion. First-person voice as a thought leader from ${company}. Plain text, no # markdown headers.

posts: Three LinkedIn posts separated by ---. Each has a strong hook, substantive body, and clear CTA. Vary formats: narrative story, bullet list (→), and a provocative question or bold claim.

videoScript: Structured script with labeled sections and spoken text: [HOOK 0:00], [CONTEXT 0:08], [POINT 1 0:20], [POINT 2 0:38], [POINT 3 0:56], [CTA 1:10]. Target 60–90 seconds.`;
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
  return {
    prompt: `${ctx}Regenerate the ${format} from the source content below. Use a fresh angle and different structure.\n\n${wsCtx(data.workspace)}\n\n${desc[format] || ""}\n\nReturn ONLY a JSON object with the single key "${key}". No markdown fences.`,
    key,
  };
}

function refinePrompt(data: TransformInput) {
  const format = data.format!;
  const key = jsonKey(format);
  return {
    prompt: `Refine the following ${format} based on this instruction: "${data.note}"\n\n${wsCtx(data.workspace)}\n\nCurrent content:\n${data.existingContent}\n\nApply the refinement while preserving the core message. Return ONLY a JSON object with the single key "${key}". No markdown fences.`,
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
        const result = parseResult(raw);
        return { [key]: result[key] ?? raw } as TransformOutput;
      }

      // Regenerate single format
      if (data.format) {
        const { prompt, key } = regenPrompt(data);
        const messages: any[] = data.pdfBase64
          ? [{ role: "user", content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: data.pdfBase64 } },
              { type: "text", text: prompt },
            ]}]
          : [{ role: "user", content: `${prompt}\n\nSource content:\n${data.content ?? ""}` }];
        const msg = await client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 2048, system: SYSTEM, messages });
        const raw = (msg.content[0] as any).text ?? "";
        const result = parseResult(raw);
        return { [key]: result[key] ?? raw } as TransformOutput;
      }

      // Full generation — all three formats
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
