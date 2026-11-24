import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Download, ChevronDown, LogOut, ChevronsUpDown, Bell, Mic, House, Sparkles, ChartNoAxesColumn, Calendar, Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";
import { toast } from "sonner";
import { MicHalo } from "@/components/spectr/MicHalo";

export const Route = createFileRoute("/record")({ component: RecordPage });

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

// --- Nav ---

const NAV_ITEMS: { label: string; to: string; icon: LucideIcon; active?: boolean }[] = [
  { label: "Home", to: "/", icon: House },
  { label: "Transform", to: "/transform", icon: Sparkles },
  { label: "Record", to: "/record", icon: Mic, active: true },
  { label: "Track", to: "/track", icon: ChartNoAxesColumn },
  { label: "Distribute", to: "/distribute", icon: Calendar },
  { label: "Settings", to: "/settings", icon: SettingsIcon },
];

// --- Log Entry ---

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
      style={{
        boxSizing: "border-box",
        padding: "16px 18px",
        borderRadius: 18,
        background: `rgba(255,255,255,${expanded ? 0.22 : 0.14})`,
        border: "1px solid rgba(255,255,255,0.34)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background .2s ease",
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{formatLogDate(entry.created_at)}</div>
        <span style={{ height: 22, padding: "0 9px", borderRadius: 999, background: "rgba(255,255,255,0.24)", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>
          {formatDuration(entry.duration_seconds)}
        </span>
        <ChevronDown size={18} strokeWidth={2} style={{ marginLeft: "auto", transition: "transform .2s ease", transform: expanded ? "rotate(180deg)" : "none" }} aria-hidden="true" />
      </div>
      <div style={{
        marginTop: 8, fontSize: 14, lineHeight: "1.55", color: "rgba(255,255,255,0.94)",
        ...(expanded ? {} : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }),
      }}>
        {entry.transcript_text}
      </div>
      {expanded && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onSendToTransform(entry.transcript_text)}
            style={{ height: 34, padding: "0 16px", borderRadius: 999, border: 0, background: "#ffffff", color: "#0a66c2", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Take to Transform
          </button>
          <button
            onClick={() => dlDocx(entry.transcript_text, buildFilename(companyName, userName, "docx", date))}
            style={{ height: 34, padding: "0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)", color: "#ffffff", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}
          >
            <Download size={13} />DOCX
          </button>
          <button
            onClick={() => dlPdf(entry.transcript_text, buildFilename(companyName, userName, "pdf", date))}
            style={{ height: 34, padding: "0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)", color: "#ffffff", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}
          >
            <Download size={13} />PDF
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            style={{ height: 34, padding: "0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// --- Main ---

function RecordPage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const ws = state.workspace;

  const [recording, setRecording] = useState(false);
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);

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
      .then(({ data }) => {
        if (data) setLogs(data as TranscriptLog[]);
      });
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
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalRef.current += t + " ";
        else interim += t;
      }
      setTranscript(finalRef.current);
      setInterimText(interim);
    };
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow microphone access and try again.");
        setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };
    recognition.onend = () => {
      if (stoppedManuallyRef.current) {
        setInterimText("");
      } else {
        try { recognition.start(); } catch {}
      }
    };
    recognition.start();
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    stoppedManuallyRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    recognitionRef.current?.stop();
    setRecording(false);
    setInterimText("");
    durationRef.current = seconds;
    setTranscript(finalRef.current.trim());
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("transcripts").delete().eq("id", id);
    if (!error) setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const sendToTransform = (text: string) => {
    sessionStorage.setItem("pendingTranscript", text);
    navigate({ to: "/transform" });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const isRec = recording;
  const isDone = !recording && !!transcript;
  const liveText = transcript + (interimText ? " " + interimText : "");
  const hasLogs = logs.length > 0;


  const userName = state.user?.name ?? "";
  const userInitials = userName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U";
  const companyInitial = (ws.companyName || "C")[0].toUpperCase();

  return (
    <div className="sx-shell">

        {/* Left rail */}
        <aside className="sx-rail">
          <div className="sx-rail-logo">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <polygon points="12,3 21,21 12,21" fill="#0a66c2" />
              <polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55" />
            </svg>
          </div>
          <nav className="sx-rail-nav">
            {NAV_ITEMS.map((n) => (
              <button
                key={n.label}
                type="button"
                aria-label={n.label}
                title={n.label}
                onClick={() => navigate({ to: n.to as string })}
                style={{
                  width: 44, height: 44, borderRadius: "50%", border: 0, padding: 0, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
                  background: n.active ? "#0a66c2" : "transparent",
                  color: n.active ? "#ffffff" : "rgba(255,255,255,0.9)",
                  boxShadow: n.active ? "0 8px 20px rgba(6,42,92,0.35)" : "none",
                }}
              >
                <n.icon size={22} strokeWidth={1.8} aria-hidden="true" />
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="sx-rail-out"
            aria-label="Log out"
            title="Log out"
            onClick={handleLogout}
            style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
          >
            <LogOut size={20} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </aside>

        {/* Header */}
        <header className="sx-header">
          <div className="sx-header-title">
            <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: "-0.01em", lineHeight: 1.1 }}>Record</div>
            <div className="sx-hide-sm" style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.9)" }}>Record audio and get a live transcript directly in your browser.</div>
          </div>
          <div className="sx-header-actions">
            <button type="button" style={{ height: 44, padding: "0 14px 0 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)", color: "#ffffff", fontFamily: "inherit", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#ffffff", color: "#0a66c2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{companyInitial}</span>
              <span className="sx-hide-sm">{ws.companyName || "Company"}</span>
              <ChevronsUpDown size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 5px 0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)" }}>
              <Bell size={20} strokeWidth={1.8} color="#ffffff" aria-hidden="true" />
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(145deg,#ffffff,#b9d6f8)", color: "#0a4a94", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, marginLeft: 6 }}>
                {userInitials}
              </div>
            </div>
          </div>
        </header>

        <main className="sx-main"><div className="sx-page"><div className="rc-layout">
        <div className="rc-orbcol">
        {/* Orb */}
        <div className="rc-orb">
          <MicHalo recording={isRec} onClick={isRec ? stopRecording : startRecording} liveAudio />
        </div>

        {/* Caption */}
        <div style={{ marginTop: -24, position: "relative", width: "100%", maxWidth: 400, textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>
            {isRec ? "Recording" : isDone ? "Tap to record again" : "Click to start recording"}
          </div>
          <div style={{ marginTop: 6, fontSize: 15, color: "rgba(255,255,255,0.9)" }}>
            {isRec
              ? "Tap the mic to stop"
              : "Your words become a live transcript"}
          </div>
          {error && (
            <div style={{ marginTop: 8, fontSize: 13, color: "#fca5a5" }}>{error}</div>
          )}
        </div>

        </div>

        {/* Transcription logs panel */}
        <div className="rc-panel" style={{
          boxSizing: "border-box", padding: 24, borderRadius: 28, minWidth: 0,
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.4)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)" as any,
          boxShadow: "0 10px 30px rgba(6,42,92,0.14)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Panel header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>Transcription logs</div>
            {hasLogs && (
              <span style={{ minWidth: 24, height: 24, padding: "0 8px", boxSizing: "border-box", borderRadius: 12, background: "#ffffff", color: "#0a66c2", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {logs.length}
              </span>
            )}
          </div>

          {/* Live transcript while recording */}
          {isRec && (
            <div style={{ flexShrink: 0, marginTop: 16, boxSizing: "border-box", padding: "18px 20px", borderRadius: 20, background: "#ffffff", color: "#0b1220", boxShadow: "0 14px 34px rgba(6,42,92,0.22)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
                <span className="rc-live" style={{ width: 9, height: 9, borderRadius: "50%", background: "#d92d20", display: "inline-block" }} />
                <span style={{ color: "#0b1220" }}>Live transcript</span>
                <span style={{ marginLeft: "auto", fontSize: 13, color: "#475569", fontWeight: 500 }}>{formatTime(seconds)}</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.6, color: "#1c2a3f", minHeight: 96 }}>
                {liveText || <span style={{ color: "#94a3b8" }}>Listening...</span>}
                <span style={{ display: "inline-block", width: 2, height: 16, marginLeft: 2, verticalAlign: "-3px", background: "#0a66c2" }} />
              </div>
            </div>
          )}

          {/* Done - save new transcript */}
          {isDone && (
            <div style={{ flexShrink: 0, marginTop: 16, boxSizing: "border-box", padding: "18px 20px", borderRadius: 20, background: "#ffffff", color: "#0b1220", boxShadow: "0 14px 34px rgba(6,42,92,0.22)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0b1220", marginBottom: 10 }}>New transcript</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: "#1c2a3f", maxHeight: 100, overflow: "hidden" }}>
                {transcript.slice(0, 200)}{transcript.length > 200 ? "..." : ""}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <button
                  onClick={handleSave}
                  disabled={saving || saved}
                  style={{ height: 34, padding: "0 16px", borderRadius: 999, border: 0, background: saved ? "#12b76a" : "#0a66c2", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, opacity: (saving || saved) ? 0.9 : 1 }}
                >
                  {saved ? <><Check size={13} />Saved</> : saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => sendToTransform(transcript)}
                  style={{ height: 34, padding: "0 16px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.15)", background: "rgba(0,0,0,0.06)", color: "#0b1220", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Take to Transform
                </button>
              </div>
            </div>
          )}

          {/* Log entries */}
          {hasLogs && (
            <div style={{ marginTop: 16, flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
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

          {/* Empty state */}
          {!hasLogs && !isRec && !isDone && (
            <div style={{ marginTop: 16, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 14, borderRadius: 20, border: "1.5px dashed rgba(255,255,255,0.5)" }}>
              <div style={{ width: 60, height: 60, borderRadius: 20, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Mic size={28} strokeWidth={1.8} color="#ffffff" aria-hidden="true" />
              </div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>No recordings yet</div>
              <div style={{ maxWidth: 300, fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.92)" }}>
                Tap the mic and start talking. Your transcript will show up here.
              </div>
            </div>
          )}
        </div>
        </div></div></main>

    </div>
  );
}
