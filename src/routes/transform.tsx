import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, FileText, RefreshCw, Upload, X } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import { AppShell } from "@/components/spectr/AppShell";
import { transformContent, type TransformInput } from "@/lib/transform-fn";

export const Route = createFileRoute("/transform")({ component: TransformPage });

type InputType = "Transcript" | "Notes" | "Draft" | "Document";
type TabKey = "Article" | "Post" | "Video Script";

const TABS: { key: TabKey; label: string }[] = [
  { key: "Article", label: "Article" },
  { key: "Post", label: "Posts" },
  { key: "Video Script", label: "Video Script" },
];

const JSON_KEY: Record<TabKey, string> = {
  Article: "article",
  Post: "posts",
  "Video Script": "videoScript",
};

interface Source {
  content?: string;
  pdfBase64?: string;
  context: string;
  inputType: InputType;
}

function TransformPage() {
  return <AppShell><Transform /></AppShell>;
}

// --- Content renderers ---

function safeExtract(text: string, tab: TabKey): string {
  const key = JSON_KEY[tab];
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("```")) {
    try {
      const cleaned = trimmed.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === "object" && key in parsed && typeof parsed[key] === "string") {
        return parsed[key];
      }
    } catch {}
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        if (parsed && typeof parsed === "object" && key in parsed && typeof parsed[key] === "string") {
          return parsed[key];
        }
      } catch {}
    }
  }
  return text;
}

function ArticleView({ text }: { text: string }) {
  const nl = text.indexOf("\n");
  const headline = nl >= 0 ? text.slice(0, nl).trim() : text.trim();
  const body = nl >= 0 ? text.slice(nl + 1).trim() : "";
  const paragraphs = body.split(/\n\n+/).filter(Boolean);
  return (
    <div>
      {headline && (
        <h2 className="text-lg font-bold mb-5 leading-snug">{headline}</h2>
      )}
      {paragraphs.map((para, i) => (
        <p key={i} className="mb-4 text-sm leading-7 whitespace-pre-wrap">
          {para.trim()}
        </p>
      ))}
    </div>
  );
}

function PostsView({ text }: { text: string }) {
  const posts = text.split(/\n\s*---\s*\n|(?:^|\n)---(?:\n|$)/m).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {posts.map((post, i) => (
        <div
          key={i}
          className="p-4 rounded-lg border"
          style={{ borderColor: "var(--color-border)", background: "white" }}
        >
          <div
            className="text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: "var(--color-primary)" }}
          >
            Post {i + 1}
          </div>
          <p className="text-sm leading-6 whitespace-pre-wrap">{post}</p>
        </div>
      ))}
    </div>
  );
}

function VideoScriptView({ text }: { text: string }) {
  const sectionRe = /(\[[A-Z][A-Z\s0-9]*\d+:\d+\])/g;
  const parts = text.split(sectionRe).filter((p) => p.trim());
  const labelRe = /^\[[A-Z][A-Z\s0-9]*\d+:\d+\]$/;

  if (parts.length <= 1) {
    return <p className="text-sm leading-7 whitespace-pre-wrap">{text}</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {parts.map((part, i) => {
        const clean = part.trim();
        if (!clean) return null;
        if (labelRe.test(clean)) {
          return (
            <div key={i} className="mt-4 first:mt-0">
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide"
                style={{ background: "var(--color-primary)", color: "white" }}
              >
                {clean.slice(1, -1)}
              </span>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm leading-7 whitespace-pre-wrap ml-1">
            {clean}
          </p>
        );
      })}
    </div>
  );
}

function ContentRenderer({ tab, text }: { tab: TabKey; text: string }) {
  const clean = safeExtract(text, tab);
  if (tab === "Article") return <ArticleView text={clean} />;
  if (tab === "Post") return <PostsView text={clean} />;
  return <VideoScriptView text={clean} />;
}

async function readFile(file: File): Promise<{ text?: string; pdfBase64?: string }> {
  const name = file.name.toLowerCase();
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
  const isDocx =
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (isPdf) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const bytes = new Uint8Array(e.target!.result as ArrayBuffer);
        let binary = "";
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        resolve({ pdfBase64: btoa(binary) });
      };
      reader.onerror = () => reject(new Error("Failed to read PDF."));
      reader.readAsArrayBuffer(file);
    });
  }

  if (isDocx) {
    const mammoth = await import("mammoth");
    const buffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
    return { text: value };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve({ text: e.target!.result as string });
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

function triggerDl(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildFilename(companyName: string, userName: string, tab: TabKey, ext: string): string {
  const co = (companyName || "Company").replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  const user = (userName || "User").split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  const type = tab === "Post" ? "Posts" : tab.replace(/\s+/g, "");
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "short" });
  return `${co}-${user}-${type}-${month}${now.getDate()}.${ext}`;
}

async function dlPdf(tab: TabKey, content: string, filename: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ML = 20, MT = 25, CW = 170;
  let y = MT;

  const ensureSpace = (n: number) => { if (y + n > 282) { doc.addPage(); y = MT; } };

  if (tab === "Article") {
    const nl = content.indexOf("\n");
    const headline = (nl >= 0 ? content.slice(0, nl) : content).trim();
    const body = (nl >= 0 ? content.slice(nl + 1) : "").trim();

    // Title
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(10, 102, 194);
    for (const line of doc.splitTextToSize(headline, CW) as string[]) {
      ensureSpace(13); doc.text(line, ML, y); y += 13;
    }
    y += 1;
    doc.setDrawColor(10, 102, 194); doc.setLineWidth(0.6); doc.line(ML, y, ML + CW, y); y += 9;

    // Body paragraphs
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
    for (const para of body.split(/\n\n+/).filter(Boolean)) {
      for (const line of doc.splitTextToSize(para.trim(), CW) as string[]) {
        ensureSpace(7); doc.text(line, ML, y); y += 7;
      }
      y += 5;
    }

  } else if (tab === "Post") {
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(10, 102, 194);
    doc.text("Posts", ML, y); y += 5;
    doc.setDrawColor(10, 102, 194); doc.setLineWidth(0.6); doc.line(ML, y, ML + CW, y); y += 10;

    const posts = content.split(/\n\s*---\s*\n|(?:^|\n)---(?:\n|$)/m).map((p) => p.trim()).filter(Boolean);
    for (let i = 0; i < posts.length; i++) {
      const bodyLines = doc.splitTextToSize(posts[i].trim(), CW - 10) as string[];
      const boxH = 10 + bodyLines.length * 7 + 8;
      ensureSpace(boxH);

      doc.setDrawColor(200, 218, 240); doc.setLineWidth(0.4); doc.rect(ML, y, CW, boxH);
      doc.setFillColor(10, 102, 194); doc.rect(ML, y, CW, 9, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
      doc.text(`POST ${i + 1}`, ML + 4, y + 6.2);

      doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
      let ty = y + 17;
      for (const line of bodyLines) { doc.text(line, ML + 5, ty); ty += 7; }
      y += boxH + 6;
    }

  } else {
    // Video Script
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(10, 102, 194);
    doc.text("Video Script", ML, y); y += 5;
    doc.setDrawColor(10, 102, 194); doc.setLineWidth(0.6); doc.line(ML, y, ML + CW, y); y += 12;

    const sectionRe = /(\[[A-Z][A-Z\s0-9]*\d+:\d+\])/g;
    const labelRe = /^\[[A-Z][A-Z\s0-9]*\d+:\d+\]$/;

    for (const part of content.split(sectionRe).filter((p) => p.trim())) {
      const clean = part.trim(); if (!clean) continue;
      if (labelRe.test(clean)) {
        const label = clean.slice(1, -1);
        ensureSpace(14);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        const tw = label.length * 2.2 + 10;
        doc.setFillColor(10, 102, 194); doc.roundedRect(ML, y - 5.5, tw, 8, 2, 2, "F");
        doc.setTextColor(255, 255, 255); doc.text(label, ML + 5, y);
        doc.setTextColor(30, 30, 30); y += 11;
      } else {
        doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
        for (const line of doc.splitTextToSize(clean, CW - 8) as string[]) {
          ensureSpace(7); doc.text(line, ML + 4, y); y += 7;
        }
        y += 5;
      }
    }
  }

  doc.save(filename);
}

async function dlDocx(tab: TabKey, content: string, filename: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, ShadingType } = await import("docx");
  const children: InstanceType<typeof Paragraph>[] = [];

  if (tab === "Article") {
    const nl = content.indexOf("\n");
    const headline = (nl >= 0 ? content.slice(0, nl) : content).trim();
    const body = (nl >= 0 ? content.slice(nl + 1) : "").trim();

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: headline, bold: true, color: "0A66C2" })],
      spacing: { after: 320 },
    }));
    for (const para of body.split(/\n\n+/).filter(Boolean)) {
      children.push(new Paragraph({
        children: [new TextRun({ text: para.trim(), size: 24 })],
        spacing: { after: 160, line: 352 },
      }));
    }

  } else if (tab === "Post") {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Posts", bold: true, color: "0A66C2" })],
      spacing: { after: 400 },
    }));

    const posts = content.split(/\n\s*---\s*\n|(?:^|\n)---(?:\n|$)/m).map((p) => p.trim()).filter(Boolean);
    posts.forEach((post, i) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `Post ${i + 1}`, bold: true, color: "0A66C2", size: 22 })],
        spacing: { before: i > 0 ? 500 : 0, after: 100 },
        border: { left: { style: BorderStyle.THICK, size: 20, color: "0A66C2" } },
        indent: { left: 280 },
      }));
      for (const line of post.split("\n")) {
        children.push(new Paragraph({
          children: [new TextRun({ text: line || " ", size: 24 })],
          spacing: { after: 80, line: 330 },
          border: { left: { style: BorderStyle.THICK, size: 20, color: "0A66C2" } },
          indent: { left: 280 },
        }));
      }
    });

  } else {
    // Video Script
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Video Script", bold: true, color: "0A66C2" })],
      spacing: { after: 400 },
    }));

    const sectionRe = /(\[[A-Z][A-Z\s0-9]*\d+:\d+\])/g;
    const labelRe = /^\[[A-Z][A-Z\s0-9]*\d+:\d+\]$/;

    for (const part of content.split(sectionRe).filter((p) => p.trim())) {
      const clean = part.trim(); if (!clean) continue;
      if (labelRe.test(clean)) {
        children.push(new Paragraph({
          children: [new TextRun({ text: clean.slice(1, -1), bold: true, color: "FFFFFF", size: 20 })],
          shading: { type: ShadingType.CLEAR, fill: "0A66C2", color: "auto" },
          spacing: { before: 360, after: 140 },
        }));
      } else {
        for (const line of clean.split("\n").filter(Boolean)) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line, size: 24 })],
            spacing: { after: 100, line: 340 },
            indent: { left: 360 },
          }));
        }
        children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
      }
    }
  }

  const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
  triggerDl(blob, filename);
}

function Transform() {
  const { state } = useApp();
  const ws = state.workspace;

  const [inputType, setInputType] = useState<InputType>("Transcript");
  const [context, setContext] = useState("");
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [outputs, setOutputs] = useState<Partial<Record<TabKey, string>>>({});
  const [tab, setTab] = useState<TabKey>("Article");
  const [refineInput, setRefineInput] = useState<Partial<Record<TabKey, string>>>({});
  const [source, setSource] = useState<Source | null>(null);
  const [tabBusy, setTabBusy] = useState<TabKey | null>(null);

  const hasAnyOutput = Object.keys(outputs).length > 0;
  const showOutput = hasAnyOutput || loading;

  const wsPayload = useMemo(
    () => ({
      companyName: ws.companyName,
      industry: ws.industry,
      goalDescription: ws.goalDescription,
      audience: ws.audience,
    }),
    [ws]
  );

  const banner = useMemo(() => {
    const titles = ws.audience.jobTitles || "your audience";
    const size = ws.audience.companySize || "all-size";
    const ind = ws.industry || "your industry";
    return `Targeting: ${titles} at ${size} companies in ${ind}`;
  }, [ws]);

  async function callTransform(input: TransformInput) {
    const data = await transformContent({ data: input });
    if (data.error) throw new Error(data.error);
    return data;
  }

  const transform = async () => {
    if (!file && !text.trim()) {
      setError("Please upload a document or paste your content.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const fileContent = file ? await readFile(file) : {};
      const content = (fileContent as any).text ?? text;
      const pdfBase64 = (fileContent as any).pdfBase64;
      const src: Source = { content, pdfBase64, context, inputType };
      setSource(src);

      const data = await callTransform({ format: tab, content, pdfBase64, context, instructions, inputType, workspace: wsPayload });
      const jk = JSON_KEY[tab];
      setOutputs((o) => ({ ...o, [tab]: data[jk as keyof typeof data] ?? "" }));
    } catch (err: any) {
      setError(err.message ?? "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const regen = async (key: TabKey) => {
    if (!source) return;
    setTabBusy(key);
    try {
      const data = await callTransform({
        format: key,
        regenerate: true,
        content: source.content,
        pdfBase64: source.pdfBase64,
        context: source.context,
        instructions,
        inputType: source.inputType,
        workspace: wsPayload,
      });
      const jk = JSON_KEY[key];
      setOutputs((o) => (o ? { ...o, [key]: data[jk as keyof typeof data] ?? o[key] } : o));
      toast.success("Regenerated");
    } catch (err: any) {
      toast.error(err.message ?? "Regeneration failed.");
    } finally {
      setTabBusy(null);
    }
  };

  const refine = async (key: TabKey) => {
    const note = refineInput[key]?.trim();
    if (!note || !outputs) return;
    setTabBusy(key);
    try {
      const data = await callTransform({
        refine: true,
        format: key,
        existingContent: outputs[key],
        note,
        context,
        instructions,
        inputType,
        workspace: wsPayload,
      });
      const jk = JSON_KEY[key];
      setOutputs((o) => (o ? { ...o, [key]: data[jk as keyof typeof data] ?? o[key] } : o));
      setRefineInput((r) => ({ ...r, [key]: "" }));
      toast.success("Output refined");
    } catch (err: any) {
      toast.error(err.message ?? "Refinement failed.");
    } finally {
      setTabBusy(null);
    }
  };

  const copy = (key: TabKey) => {
    if (!outputs[key]) return;
    navigator.clipboard.writeText(outputs[key]!);
    toast.success("Copied to clipboard");
  };

  const activeTabBusy = tabBusy === tab;

  return (
    <div className="flex h-screen">
      {/* LEFT PANEL — full width before any output, 2/5 once output exists */}
      <div
        className={`${showOutput ? "w-2/5 border-r" : "w-full"} overflow-y-auto`}
        style={{ borderColor: "var(--color-border)", background: "white" }}
      >
        <div className="p-6 pb-8">
          <h1 className="text-xl font-bold mb-1">Transform</h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
            Drop in raw material — get a full content ecosystem.
          </p>

          <label className="spectr-label">Input Type</label>
          <div className="flex flex-wrap gap-2 mb-5">
            {(["Transcript", "Notes", "Draft", "Document"] as InputType[]).map((t) => {
              const active = inputType === t;
              return (
                <button
                  key={t}
                  onClick={() => setInputType(t)}
                  className="px-4 h-8 text-xs font-semibold rounded-full"
                  style={{
                    background: active ? "var(--color-primary)" : "white",
                    color: active ? "white" : "var(--color-primary)",
                    border: `1px solid var(--color-primary)`,
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>

          <label className="spectr-label">Output Type</label>
          <div className="flex gap-2 mb-5">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="flex-1 py-2 text-xs font-semibold rounded-md transition-colors"
                  style={{
                    background: active ? "var(--color-primary)" : "var(--color-surface)",
                    color: active ? "white" : "var(--color-text-secondary)",
                    border: `1.5px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <label className="spectr-label">Add context (optional)</label>
          <textarea
            rows={3}
            className="spectr-textarea mb-5"
            placeholder="e.g. 45-min CEO session on carbon capture economics, targeting VP-level O&G audience"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />

          <label className="spectr-label">Content Instructions (optional)</label>
          <p className="text-xs mb-1" style={{ color: "var(--color-text-secondary)" }}>
            Control the shape and length of the output — e.g. <em>5 minutes long</em>, <em>1500 words</em>, <em>5 posts</em>, <em>include a case study</em>
          </p>
          <textarea
            rows={4}
            className="spectr-textarea mb-5"
            placeholder="e.g. Make the article 1500 words · 5 posts · Video script should be 3 minutes long"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />

          <label className="cursor-pointer mb-3 block">
            <div
              className="rounded-md p-6 text-center"
              style={{ border: `2px dashed var(--color-border)`, background: "var(--color-surface)" }}
            >
              {!file ? (
                <>
                  <Upload size={24} className="mx-auto mb-2" style={{ color: "var(--color-text-secondary)" }} />
                  <div className="text-sm font-semibold">Upload a document</div>
                  <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    PDF, DOCX, or TXT
                  </div>
                </>
              ) : (
                <div
                  className="flex items-center justify-between p-2 rounded bg-white border"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="flex items-center gap-2 text-sm truncate">
                    <FileText size={16} style={{ color: "var(--color-primary)" }} />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); setFile(null); }}>
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
            <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
          </div>

          <textarea
            rows={10}
            className="spectr-textarea mb-5"
            placeholder="Paste your transcript, notes, or draft here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!!file}
            style={{ opacity: file ? 0.4 : 1 }}
          />

          {error && <p className="field-error mb-3">{error}</p>}

          <button onClick={transform} disabled={loading} className="spectr-btn-primary w-full">
            {loading ? "Generating…" : `Generate ${tab === "Post" ? "Posts" : tab}`}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL — only mounts after first generate */}
      {showOutput && (
        <div className="w-3/5 flex flex-col overflow-hidden">
          <div
            className="px-6 py-2 text-xs font-semibold border-b"
            style={{
              background: "var(--color-surface)",
              color: "var(--color-primary)",
              borderColor: "var(--color-border)",
            }}
          >
            {banner}
          </div>

          <div
            className="flex border-b px-6"
            style={{ borderColor: "var(--color-border)", background: "white" }}
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="px-4 py-3 text-sm font-semibold flex items-center gap-2"
                  style={{
                    color: active ? "var(--color-primary)" : "var(--color-text-secondary)",
                    borderBottom: `2px solid ${active ? "var(--color-primary)" : "transparent"}`,
                  }}
                >
                  {t.label}
                  {tabBusy === t.key && (
                    <span
                      className="inline-block rounded-full animate-spin"
                      style={{
                        width: 10,
                        height: 10,
                        border: "2px solid var(--color-border)",
                        borderTopColor: "var(--color-primary)",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-6" style={{ background: "var(--color-surface)" }}>
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20">
                <div
                  className="animate-spin rounded-full"
                  style={{ width: 32, height: 32, border: "3px solid var(--color-border)", borderTopColor: "var(--color-primary)" }}
                />
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  Generating {tab === "Post" ? "Posts" : tab}…
                </p>
              </div>
            ) : outputs[tab] ? (
              <div className="spectr-card p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="font-bold">{tab === "Post" ? "Posts" : tab}</h2>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => copy(tab)} className="spectr-btn-secondary" style={{ height: 32 }}>
                      <Copy size={14} className="inline mr-1" />Copy
                    </button>
                    <button onClick={() => regen(tab)} disabled={activeTabBusy} className="spectr-btn-secondary" style={{ height: 32 }}>
                      <RefreshCw size={14} className={`inline mr-1 ${activeTabBusy ? "animate-spin" : ""}`} />
                      Regenerate
                    </button>
                    <button
                      onClick={() => {
                        const clean = safeExtract(outputs[tab]!, tab);
                        dlDocx(tab, clean, buildFilename(ws.companyName, state.user?.name ?? "", tab, "docx"));
                      }}
                      className="spectr-btn-secondary" style={{ height: 32 }}
                    >
                      <Download size={14} className="inline mr-1" />DOCX
                    </button>
                    <button
                      onClick={() => {
                        const clean = safeExtract(outputs[tab]!, tab);
                        dlPdf(tab, clean, buildFilename(ws.companyName, state.user?.name ?? "", tab, "pdf"));
                      }}
                      className="spectr-btn-secondary" style={{ height: 32 }}
                    >
                      <Download size={14} className="inline mr-1" />PDF
                    </button>
                  </div>
                </div>
                <ContentRenderer tab={tab} text={outputs[tab]!} />
                <div className="mt-5 pt-4 border-t flex gap-2" style={{ borderColor: "var(--color-border)" }}>
                  <input
                    className="spectr-input flex-1"
                    placeholder="e.g. Make the hook more aggressive"
                    value={refineInput[tab] ?? ""}
                    onChange={(e) => setRefineInput((r) => ({ ...r, [tab]: e.target.value }))}
                  />
                  <button onClick={() => refine(tab)} disabled={activeTabBusy} className="spectr-btn-primary">
                    Refine
                  </button>
                </div>
              </div>
            ) : (
              <div className="spectr-card p-5 flex flex-col items-center justify-center py-16">
                <p className="text-sm font-semibold mb-1">{tab === "Post" ? "Posts" : tab} not generated yet</p>
                <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  Switch to <strong>{tab === "Post" ? "Posts" : tab}</strong> on the left and click Generate.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
