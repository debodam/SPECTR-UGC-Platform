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

async function dlDocx(content: string, filename: string) {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const paragraphs = content
    .split("\n")
    .map((line) => new Paragraph({ children: [new TextRun(line || " ")] }));
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  triggerDl(blob, filename);
}

async function dlPdf(content: string, filename: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const lines = doc.splitTextToSize(content, 180) as string[];
  let y = 15;
  for (const line of lines) {
    if (y > 280) { doc.addPage(); y = 15; }
    doc.text(line, 15, y);
    y += 7;
  }
  doc.save(filename);
}

function triggerDl(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Transform() {
  const { state } = useApp();
  const ws = state.workspace;

  const [inputType, setInputType] = useState<InputType>("Transcript");
  const [context, setContext] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [outputs, setOutputs] = useState<Record<TabKey, string> | null>(null);
  const [tab, setTab] = useState<TabKey>("Article");
  const [refineInput, setRefineInput] = useState<Partial<Record<TabKey, string>>>({});
  const [source, setSource] = useState<Source | null>(null);
  const [tabBusy, setTabBusy] = useState<TabKey | null>(null);

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

      const data = await callTransform({ content, pdfBase64, context, inputType, workspace: wsPayload });
      setOutputs({
        Article: data.article ?? "",
        Post: data.posts ?? "",
        "Video Script": data.videoScript ?? "",
      });
      setTab("Article");
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
        content: source.content,
        pdfBase64: source.pdfBase64,
        context: source.context,
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
    if (!outputs) return;
    navigator.clipboard.writeText(outputs[key]);
    toast.success("Copied to clipboard");
  };

  const activeTabBusy = tabBusy === tab;

  return (
    <div className="flex h-screen">
      {/* LEFT PANEL */}
      <div
        className="w-2/5 border-r overflow-y-auto p-6 flex flex-col"
        style={{ borderColor: "var(--color-border)", background: "white" }}
      >
        <h1 className="text-xl font-bold mb-1">Transform</h1>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
          Drop in raw material — get a full content ecosystem.
        </p>

        <label className="spectr-label">Input Type</label>
        <div className="flex flex-wrap gap-2 mb-4">
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

        <label className="spectr-label">Add context (optional)</label>
        <input
          className="spectr-input mb-4"
          placeholder="e.g. 45-min CEO session on carbon capture economics, targeting VP-level O&G audience"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />

        <label className="cursor-pointer mb-3">
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

        <div className="flex items-center gap-3 my-3">
          <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>or</span>
          <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
        </div>

        <textarea
          rows={10}
          className="spectr-textarea"
          placeholder="Paste your transcript, notes, or draft here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!!file}
          style={{ opacity: file ? 0.4 : 1 }}
        />

        {error && <p className="field-error mt-2">{error}</p>}

        <div className="mt-4">
          <button onClick={transform} disabled={loading} className="spectr-btn-primary w-full">
            {loading ? "Generating…" : "Transform Content"}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL */}
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

        {loading ? (
          <div
            className="flex-1 flex flex-col items-center justify-center gap-3"
            style={{ background: "var(--color-surface)" }}
          >
            <div
              className="animate-spin rounded-full"
              style={{
                width: 32,
                height: 32,
                border: "3px solid var(--color-border)",
                borderTopColor: "var(--color-primary)",
              }}
            />
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Generating your content…
            </p>
          </div>
        ) : !outputs ? (
          <div
            className="flex-1 flex flex-col items-center justify-center"
            style={{ background: "var(--color-surface)" }}
          >
            <Upload size={36} style={{ color: "var(--color-text-secondary)" }} />
            <p className="mt-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Drop in your content to generate your content ecosystem.
            </p>
          </div>
        ) : (
          <>
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
              <div className="spectr-card p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="font-bold">{tab === "Post" ? "Posts" : tab}</h2>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => copy(tab)}
                      className="spectr-btn-secondary"
                      style={{ height: 32 }}
                    >
                      <Copy size={14} className="inline mr-1" />Copy
                    </button>
                    <button
                      onClick={() => regen(tab)}
                      disabled={activeTabBusy}
                      className="spectr-btn-secondary"
                      style={{ height: 32 }}
                    >
                      <RefreshCw
                        size={14}
                        className={`inline mr-1 ${activeTabBusy ? "animate-spin" : ""}`}
                      />
                      Regenerate
                    </button>
                    <button
                      onClick={() =>
                        dlDocx(outputs[tab], `spectr-${tab.toLowerCase().replace(/\s+/g, "-")}.docx`)
                      }
                      className="spectr-btn-secondary"
                      style={{ height: 32 }}
                    >
                      <Download size={14} className="inline mr-1" />DOCX
                    </button>
                    <button
                      onClick={() =>
                        dlPdf(outputs[tab], `spectr-${tab.toLowerCase().replace(/\s+/g, "-")}.pdf`)
                      }
                      className="spectr-btn-secondary"
                      style={{ height: 32 }}
                    >
                      <Download size={14} className="inline mr-1" />PDF
                    </button>
                  </div>
                </div>

                <pre className="whitespace-pre-wrap text-sm leading-6 font-sans">{outputs[tab]}</pre>

                <div
                  className="mt-5 pt-4 border-t flex gap-2"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <input
                    className="spectr-input flex-1"
                    placeholder="e.g. Make the hook more aggressive"
                    value={refineInput[tab] ?? ""}
                    onChange={(e) => setRefineInput((r) => ({ ...r, [tab]: e.target.value }))}
                  />
                  <button
                    onClick={() => refine(tab)}
                    disabled={activeTabBusy}
                    className="spectr-btn-primary"
                  >
                    Refine
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
