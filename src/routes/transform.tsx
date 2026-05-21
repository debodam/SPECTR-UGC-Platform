import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, Upload, X, FileText } from "lucide-react";
import { useApp, type Format } from "@/lib/spectr-store";
import { AppShell } from "@/components/spectr/AppShell";

export const Route = createFileRoute("/transform")({ component: TransformPage });

type InputType = "Transcript" | "Notes" | "Draft" | "Document";
const TABS: { key: Format | "Calendar"; label: string }[] = [
  { key: "Article", label: "Article" },
  { key: "Post", label: "Posts" },
  { key: "Video Script", label: "Video Scripts" },
  { key: "Carousel", label: "Carousel" },
  { key: "Calendar", label: "Calendar" },
];

function TransformPage() {
  return (
    <AppShell>
      <Transform />
    </AppShell>
  );
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
  const [outputs, setOutputs] = useState<Record<string, string> | null>(null);
  const [tab, setTab] = useState<Format | "Calendar">("Article");
  const [refineInput, setRefineInput] = useState<Record<string, string>>({});

  const banner = useMemo(() => {
    const a = ws.audience;
    const titles = a.jobTitles || "your audience";
    const size = a.companySize || "all-size";
    const ind = ws.industry || "your industry";
    return `Targeting: ${titles} at ${size} companies in ${ind}`;
  }, [ws]);

  const transform = () => {
    if (!file && !text.trim()) { setError("Please upload a document or paste your content."); return; }
    setError(""); setLoading(true);
    setTimeout(() => {
      const source = file ? `[Document: ${file.name}]` : text.slice(0, 200);
      const ctxLine = context ? `Context: ${context}\n\n` : "";
      setOutputs(generate(source, ctxLine, ws));
      setLoading(false);
    }, 700);
  };

  const copy = (key: string) => {
    if (!outputs) return;
    navigator.clipboard.writeText(outputs[key]);
    toast.success("Copied to clipboard");
  };
  const regen = (key: string) => {
    setOutputs((o) => o ? { ...o, [key]: o[key] + "\n\n— regenerated —" } : o);
    toast("Regenerated");
  };
  const refine = (key: string) => {
    const note = refineInput[key]?.trim();
    if (!note) return;
    setOutputs((o) => o ? { ...o, [key]: o[key] + `\n\n[Refined: ${note}]` } : o);
    setRefineInput((r) => ({ ...r, [key]: "" }));
    toast("Output refined");
  };

  return (
    <div className="flex h-screen">
      {/* LEFT */}
      <div className="w-2/5 border-r overflow-y-auto p-6 flex flex-col" style={{ borderColor: "var(--color-border)", background: "white" }}>
        <h1 className="text-xl font-bold mb-1">Transform</h1>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>Drop in raw material — get a full content ecosystem.</p>

        <label className="spectr-label">Input Type</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {(["Transcript", "Notes", "Draft", "Document"] as InputType[]).map((t) => {
            const active = inputType === t;
            return (
              <button key={t} onClick={() => setInputType(t)}
                className="px-4 h-8 text-xs font-semibold rounded-full"
                style={{
                  background: active ? "var(--color-primary)" : "white",
                  color: active ? "white" : "var(--color-primary)",
                  border: `1px solid var(--color-primary)`,
                }}>{t}</button>
            );
          })}
        </div>

        <label className="spectr-label">Add context (optional)</label>
        <input className="spectr-input mb-4" placeholder="e.g. 45-min CEO session on carbon capture economics, targeting VP-level O&G audience"
          value={context} onChange={(e) => setContext(e.target.value)} />

        <label className="cursor-pointer mb-3">
          <div className="rounded-md p-6 text-center" style={{ border: `2px dashed var(--color-border)`, background: "var(--color-surface)" }}>
            {!file ? (
              <>
                <Upload size={24} className="mx-auto mb-2" style={{ color: "var(--color-text-secondary)" }} />
                <div className="text-sm font-semibold">Upload a document</div>
                <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>PDF, DOCX, or TXT</div>
              </>
            ) : (
              <div className="flex items-center justify-between p-2 rounded bg-white border" style={{ borderColor: "var(--color-border)" }}>
                <div className="flex items-center gap-2 text-sm truncate">
                  <FileText size={16} style={{ color: "var(--color-primary)" }} />
                  <span className="truncate">{file.name}</span>
                </div>
                <button onClick={(e) => { e.preventDefault(); setFile(null); }}><X size={16} /></button>
              </div>
            )}
          </div>
          <input type="file" accept=".pdf,.docx,.txt" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>

        <div className="flex items-center gap-3 my-3">
          <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>or</span>
          <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
        </div>

        <textarea rows={10} className="spectr-textarea" placeholder="Paste your transcript, notes, or draft here..."
          value={text} onChange={(e) => setText(e.target.value)}
          disabled={!!file} style={{ opacity: file ? 0.4 : 1 }} />

        {error && <p className="field-error mt-2">{error}</p>}

        <div className="mt-4">
          <button onClick={transform} disabled={loading} className="spectr-btn-primary w-full">
            {loading ? "Generating..." : "Transform Content"}
          </button>
        </div>
      </div>

      {/* RIGHT */}
      <div className="w-3/5 flex flex-col overflow-hidden">
        <div className="px-6 py-2 text-xs font-semibold border-b"
          style={{ background: "var(--color-surface)", color: "var(--color-primary)", borderColor: "var(--color-border)" }}>
          {banner}
        </div>

        {!outputs ? (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ background: "var(--color-surface)" }}>
            <Upload size={36} style={{ color: "var(--color-text-secondary)" }} />
            <p className="mt-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Drop in your content to generate your content ecosystem.
            </p>
          </div>
        ) : (
          <>
            <div className="flex border-b px-6" style={{ borderColor: "var(--color-border)", background: "white" }}>
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className="px-4 py-3 text-sm font-semibold"
                    style={{
                      color: active ? "var(--color-primary)" : "var(--color-text-secondary)",
                      borderBottom: `2px solid ${active ? "var(--color-primary)" : "transparent"}`,
                    }}>{t.label}</button>
                );
              })}
            </div>
            <div className="flex-1 overflow-y-auto p-6" style={{ background: "var(--color-surface)" }}>
              {tab === "Calendar" ? (
                <CalendarView outputs={outputs} />
              ) : (
                <div className="spectr-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold">{tab}</h2>
                    <div className="flex gap-2">
                      <button onClick={() => copy(tab)} className="spectr-btn-secondary" style={{ height: 32 }}>
                        <Copy size={14} className="inline mr-1" />Copy
                      </button>
                      <button onClick={() => regen(tab)} className="spectr-btn-secondary" style={{ height: 32 }}>
                        <RefreshCw size={14} className="inline mr-1" />Regenerate
                      </button>
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm leading-6 font-sans">{outputs[tab]}</pre>
                  <div className="mt-5 pt-4 border-t flex gap-2" style={{ borderColor: "var(--color-border)" }}>
                    <input className="spectr-input flex-1" placeholder="e.g. Make the hook more aggressive"
                      value={refineInput[tab] ?? ""}
                      onChange={(e) => setRefineInput((r) => ({ ...r, [tab]: e.target.value }))} />
                    <button onClick={() => refine(tab)} className="spectr-btn-primary">Refine</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CalendarView({ outputs }: { outputs: Record<string, string> }) {
  const days = Array.from({ length: 14 }).map((_, i) => i);
  const plan: Record<number, { label: string; color: string }[]> = {
    1: [{ label: "Article", color: "var(--color-primary)" }],
    3: [{ label: "Post", color: "var(--color-success)" }],
    5: [{ label: "Video Script", color: "var(--color-warning)" }],
    8: [{ label: "Carousel", color: "var(--color-purple-accent)" }],
    10: [{ label: "Post", color: "var(--color-success)" }],
  };
  return (
    <div className="spectr-card p-5">
      <h2 className="font-bold mb-1">Recommended 14-day cadence</h2>
      <p className="text-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>Based on the formats SPECTR generated for this input.</p>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => (
          <div key={d} className="rounded-md p-2 min-h-[80px]" style={{ background: "var(--color-surface)" }}>
            <div className="text-[10px] font-bold mb-1" style={{ color: "var(--color-text-secondary)" }}>Day {d + 1}</div>
            {plan[d]?.map((p, i) => (
              <div key={i} className="text-[10px] font-semibold text-white rounded px-1.5 py-1 mb-1" style={{ background: p.color }}>{p.label}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function generate(source: string, ctxLine: string, ws: any): Record<string, string> {
  const aud = ws.audience.jobTitles || "your audience";
  const ind = ws.industry || "your industry";
  return {
    Article: `${ctxLine}# The Real Economics of ${ind}\n\nMost ${aud} are still misreading the curve.\n\nIn this piece, we break down what the data is actually saying — and what it means for teams making decisions right now.\n\n1. The baseline assumption is broken.\n2. The cost curve doesn't behave the way the deck says it does.\n3. The opportunity window is shorter than most expect.\n\nSource:\n${source}\n\nTakeaway: focus less on the headline and more on the underlying mechanics.`,
    Post: `${ctxLine}3 things I keep telling ${aud} about ${ind}:\n\n→ The math has changed.\n→ The buyer has changed.\n→ The window has changed.\n\nIf your strategy hasn't, you're already behind.\n\nSource: ${source}`,
    "Video Script": `${ctxLine}[HOOK 0:00] If you're a ${aud.split(",")[0] || "leader"} in ${ind}, this is the 60 seconds you needed today.\n\n[POINT 1 0:08] The market just shifted — here's what changed.\n[POINT 2 0:25] Most teams are responding to the wrong signal.\n[POINT 3 0:42] Here's what to do this week.\n\n[CTA 0:55] Follow for more on ${ind}.\n\n— Source: ${source}`,
    Carousel: `${ctxLine}SLIDE 1 — Cover\n"What ${aud} need to know about ${ind} in 2026"\n\nSLIDE 2 — The Problem\nThe old playbook stopped working in Q3.\n\nSLIDE 3 — The Data\nThree numbers that explain the shift.\n\nSLIDE 4 — The Reframe\nStop optimizing for X. Start measuring Y.\n\nSLIDE 5 — The Move\nThe one decision to make this week.\n\nSLIDE 6 — CTA\nFollow for more breakdowns on ${ind}.`,
  };
}
