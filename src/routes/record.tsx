import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Download, Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import { AppShell } from "@/components/spectr/AppShell";
import supabase from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/record")({ component: RecordPage });

function RecordPage() {
  return <AppShell><Record /></AppShell>;
}

// --- Helpers ---

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatDuration(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function formatLogDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildFilename(companyName: string, userName: string, ext: string, date?: Date): string {
  const co = (companyName || "Company").replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  const user = (userName || "User").split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  const d = date ?? new Date();
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${co}-${user}-Transcript-${month}${d.getDate()}.${ext}`;
}

function triggerDl(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function dlPdf(transcript: string, filename: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ML = 20, MT = 25, CW = 170;
  let y = MT;

  const ensureSpace = (n: number) => { if (y + n > 282) { doc.addPage(); y = MT; } };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(10, 102, 194);
  doc.text("Transcript", ML, y);
  y += 5;
  doc.setDrawColor(10, 102, 194);
  doc.setLineWidth(0.6);
  doc.line(ML, y, ML + CW, y);
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);

  for (const para of transcript.split(/\n\n+/).filter(Boolean)) {
    for (const line of doc.splitTextToSize(para.trim(), CW) as string[]) {
      ensureSpace(7);
      doc.text(line, ML, y);
      y += 7;
    }
    y += 5;
  }

  doc.save(filename);
}

async function dlDocx(transcript: string, filename: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Transcript", bold: true, color: "0A66C2" })],
      spacing: { after: 320 },
    }),
    ...transcript
      .split(/\n\n+/)
      .filter(Boolean)
      .map(
        (para) =>
          new Paragraph({
            children: [new TextRun({ text: para.trim(), size: 24 })],
            spacing: { after: 160, line: 352 },
          })
      ),
  ];

  const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
  triggerDl(blob, filename);
}

// --- Types ---

interface TranscriptLog {
  id: string;
  transcript_text: string;
  duration_seconds: number;
  created_at: string;
}

// --- Log entry component ---

function LogEntry({
  entry,
  companyName,
  userName,
  onSendToTransform,
  onDelete,
}: {
  entry: TranscriptLog;
  companyName: string;
  userName: string;
  onSendToTransform: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(entry.created_at);

  return (
    <div
      className="border-b last:border-b-0"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Collapsed row */}
      <div
        className="group flex items-start gap-3 px-5 py-4 cursor-pointer transition-colors hover:bg-[var(--color-card-2)]"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
              {formatLogDate(entry.created_at)}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: "var(--color-surface)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
            >
              {formatDuration(entry.duration_seconds)}
            </span>
          </div>
          <p className="text-xs leading-relaxed truncate" style={{ color: "var(--color-text-secondary)" }}>
            {entry.transcript_text.slice(0, 120)}{entry.transcript_text.length > 120 ? "…" : ""}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
          className="shrink-0 mt-0.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[rgba(220,38,38,0.15)]"
          style={{ color: "var(--color-text-secondary)" }}
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
        <span className="shrink-0 mt-1" style={{ color: "var(--color-text-secondary)" }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          className="px-5 pb-5"
          style={{ background: "var(--color-card-2)" }}
        >
          <p className="text-sm leading-7 whitespace-pre-wrap mb-4" style={{ color: "var(--color-foreground)" }}>
            {entry.transcript_text}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onSendToTransform(entry.transcript_text)}
              className="spectr-btn-primary"
              style={{ height: 32, padding: "0 14px", fontSize: 13 }}
            >
              Take to Transform
            </button>
            <button
              onClick={() => dlDocx(entry.transcript_text, buildFilename(companyName, userName, "docx", date))}
              className="spectr-btn-secondary"
              style={{ height: 32, padding: "0 14px", fontSize: 13 }}
            >
              <Download size={13} className="inline mr-1.5" />DOCX
            </button>
            <button
              onClick={() => dlPdf(entry.transcript_text, buildFilename(companyName, userName, "pdf", date))}
              className="spectr-btn-secondary"
              style={{ height: 32, padding: "0 14px", fontSize: 13 }}
            >
              <Download size={13} className="inline mr-1.5" />PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main component ---

function Record() {
  const { state } = useApp();
  const navigate = useNavigate();
  const ws = state.workspace;

  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<TranscriptLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const recognitionRef = useRef<any>(null);
  const finalRef = useRef("");
  const stoppedManuallyRef = useRef(false);
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);

  // Fetch transcript logs for active company
  useEffect(() => {
    const companyId = ws.companyId;
    const userId = state.user?.id;
    if (!companyId || !userId) return;
    setLogs([]);
    supabase
      .from("transcripts")
      .select("id, transcript_text, duration_seconds, created_at")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setLogs(data as TranscriptLog[]); });
  }, [ws.companyId, state.user?.id]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stoppedManuallyRef.current = true;
      recognitionRef.current?.stop();
    };
  }, []);

  const saveTranscript = async (text: string, duration: number): Promise<boolean> => {
    const companyId = ws.companyId;
    const userId = state.user?.id;
    if (!companyId || !userId || !text.trim()) return false;
    const { data, error: err } = await supabase
      .from("transcripts")
      .insert({ company_id: companyId, user_id: userId, transcript_text: text, duration_seconds: duration })
      .select("id, transcript_text, duration_seconds, created_at")
      .single();
    if (err) {
      console.error("Save transcript error:", err);
      return false;
    }
    if (data) {
      setLogs((prev) => [data as TranscriptLog, ...prev]);
      return true;
    }
    return false;
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await saveTranscript(transcript, durationRef.current);
    setSaving(false);
    if (ok) {
      setSaved(true);
      toast.success("Transcript saved.");
    } else {
      toast.error("Failed to save transcript. Check the browser console for details.");
    }
  };

  const startRecording = () => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setError("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    setError("");
    setTranscript("");
    setInterimText("");
    setSaved(false);
    finalRef.current = "";
    stoppedManuallyRef.current = false;
    pausedRef.current = false;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalRef.current += t + " ";
        } else {
          interim += t;
        }
      }
      setTranscript(finalRef.current);
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow microphone access and try again.");
        setRecording(false);
        setPaused(false);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    recognition.onend = () => {
      if (stoppedManuallyRef.current) {
        setInterimText("");
      } else if (pausedRef.current) {
        // paused — wait for resume
      } else {
        try { recognition.start(); } catch {}
      }
    };

    recognition.start();
    setRecording(true);
    setPaused(false);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const pauseRecording = () => {
    pausedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    recognitionRef.current?.stop();
    setPaused(true);
    setInterimText("");
  };

  const resumeRecording = () => {
    pausedRef.current = false;
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    try { recognitionRef.current?.start(); } catch {}
    setPaused(false);
  };

  const stopRecording = () => {
    stoppedManuallyRef.current = true;
    pausedRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    recognitionRef.current?.stop();
    setRecording(false);
    setPaused(false);
    setInterimText("");
    durationRef.current = seconds;
    const text = finalRef.current.trim();
    setTranscript(text);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("transcripts").delete().eq("id", id);
    if (!error) setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const sendToTransform = (text: string) => {
    sessionStorage.setItem("pendingTranscript", text);
    navigate({ to: "/transform" });
  };

  const userName = state.user?.name ?? "";
  const isActive = recording || paused;
  const isDone = !isActive && !!transcript;
  const liveText = transcript + (interimText ? " " + interimText : "");

  return (
    <div className="flex flex-col" style={{ minHeight: "100%" }}>

      {/* ── Recording interface — vertically centered ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-8 pb-6">
        <div className="w-full max-w-xl">
          <h1 className="text-xl font-bold mb-2 text-center">Record</h1>
          <p className="text-sm mb-10 text-center" style={{ color: "var(--color-text-secondary)" }}>
            Record audio and get a live transcript directly in your browser.
          </p>

          {/* Controls */}
          <div className="flex flex-col items-center gap-5 mb-8">

            {/* Idle */}
            {!isActive && !isDone && (
              <button
                onClick={startRecording}
                className="w-24 h-24 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: "var(--color-primary)",
                  boxShadow: "0 0 0 10px rgba(10,102,194,0.10), var(--glow-primary-lg)",
                  color: "white",
                }}
              >
                <Mic size={30} />
              </button>
            )}

            {/* Active: timer + Pause/Resume + Stop */}
            {isActive && (
              <>
                <div className="flex items-center gap-2 h-7">
                  {!paused && (
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#EF4444" }} />
                  )}
                  <span className="font-mono text-xl font-bold">{formatTime(seconds)}</span>
                  {paused && (
                    <span
                      className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{ background: "var(--color-surface)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
                    >
                      Paused
                    </span>
                  )}
                </div>

                <div className="flex items-end gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={paused ? resumeRecording : pauseRecording}
                      className="w-16 h-16 rounded-full flex items-center justify-center transition-all"
                      style={{
                        background: paused ? "var(--color-primary)" : "var(--color-surface)",
                        border: `2px solid ${paused ? "var(--color-primary)" : "var(--color-border)"}`,
                        color: paused ? "white" : "var(--color-foreground)",
                        boxShadow: paused ? "var(--glow-primary)" : "none",
                      }}
                    >
                      {paused ? <Play size={22} fill="white" /> : <Pause size={22} />}
                    </button>
                    <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      {paused ? "Resume" : "Pause"}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={stopRecording}
                      className="w-20 h-20 rounded-full flex items-center justify-center transition-all"
                      style={{
                        background: "#EF4444",
                        boxShadow: "0 0 0 10px rgba(239,68,68,0.12)",
                        color: "white",
                      }}
                    >
                      <Square size={26} fill="white" />
                    </button>
                    <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Stop</span>
                  </div>
                </div>
              </>
            )}

            {!isActive && !transcript && (
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Click to start recording
              </p>
            )}

            {isDone && (
              <button onClick={startRecording} className="spectr-btn-secondary text-sm">
                Record again
              </button>
            )}
          </div>

          {error && <p className="field-error mb-4 text-center">{error}</p>}

          {/* Live transcript while active */}
          {isActive && (
            <div
              className="rounded-xl p-5 mb-4"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                {!paused ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#EF4444" }} />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-secondary)" }}>
                      Live
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-secondary)" }}>
                    Captured so far
                  </span>
                )}
              </div>
              <p className="text-sm leading-7 min-h-[3rem]" style={{ color: "var(--color-foreground)" }}>
                {transcript}
                {!paused && interimText && (
                  <span style={{ color: "var(--color-text-secondary)" }}>{interimText}</span>
                )}
                {!liveText && !paused && (
                  <span style={{ color: "var(--color-text-secondary)" }}>Listening...</span>
                )}
                {paused && !transcript && (
                  <span style={{ color: "var(--color-text-secondary)" }}>Nothing captured yet.</span>
                )}
              </p>
            </div>
          )}

          {/* Final transcript card */}
          {isDone && (
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
            >
              <h2 className="font-bold text-sm mb-3">Transcript</h2>
              <p className="text-sm leading-7 whitespace-pre-wrap">{transcript}</p>
              <div
                className="flex flex-wrap gap-2 mt-5 pt-4"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <button
                  onClick={handleSave}
                  disabled={saving || saved}
                  className="spectr-btn-primary"
                  style={{ opacity: saved ? 0.8 : 1 }}
                >
                  {saved ? (
                    <><Check size={14} className="inline mr-1.5" />Saved</>
                  ) : saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => sendToTransform(transcript)} className="spectr-btn-secondary">
                  Take to Transform
                </button>
                <button
                  onClick={() => dlDocx(transcript, buildFilename(ws.companyName, userName, "docx"))}
                  className="spectr-btn-secondary"
                >
                  <Download size={14} className="inline mr-1.5" />DOCX
                </button>
                <button
                  onClick={() => dlPdf(transcript, buildFilename(ws.companyName, userName, "pdf"))}
                  className="spectr-btn-secondary"
                >
                  <Download size={14} className="inline mr-1.5" />PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Transcription Logs ── */}
      <div
        className="px-8 pb-10"
        style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
      >
        <div className="max-w-xl mx-auto pt-8">
          <h2 className="font-bold text-sm mb-4">Transcription Logs</h2>

          {logs.length === 0 ? (
            <div
              className="rounded-xl py-10 text-center"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-card)" }}
            >
              <p className="text-sm font-semibold mb-1">No recordings yet</p>
              <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                Your transcripts will appear here after you record.
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-card)" }}
            >
              {logs.map((entry) => (
                <LogEntry
                  key={entry.id}
                  entry={entry}
                  companyName={ws.companyName}
                  userName={userName}
                  onSendToTransform={sendToTransform}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
