import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { Check, Download } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";
import { toast } from "sonner";

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

// --- Orb ---

const ORB_STOPS: [number, string][] = [
  [0, "#ffffff"],
  [0.05, "#e3f1ff"],
  [0.14, "#8cc4fa"],
  [0.3, "#3b86dc"],
  [0.45, "#0a5ab4"],
  [0.56, "#0a4a94"],
  [0.68, "#3b86dc"],
  [0.8, "#8fc0f7"],
  [0.92, "#cfe4fc"],
  [1, "#eaf3fe"],
];

function hexToRgb(h: string) {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

function orbColor(t: number): string {
  for (let i = 1; i < ORB_STOPS.length; i++) {
    if (t <= ORB_STOPS[i][0]) {
      const a = ORB_STOPS[i - 1], b = ORB_STOPS[i];
      const k = (t - a[0]) / (b[0] - a[0]);
      const ca = hexToRgb(a[1]), cb = hexToRgb(b[1]);
      return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * k)).join(",")})`;
    }
  }
  return "#eaf3fe";
}

function buildOrbLayers(isRec: boolean) {
  const N = 18, CX = 200, CY = 196, OUT = 352;
  const coreW = isRec ? 112 : 70;
  const coreH = isRec ? 112 : 124;
  const coreR = isRec ? 56 : 30;
  const layers: {
    key: string; x: number; y: number; w: number; h: number; rx: number;
    fill: string; opacity: number; dur: number; delay: number;
    amp: number; amp2: number; dx: number; dy: number;
  }[] = [];
  for (let i = N; i >= 1; i--) {
    const t = i / N;
    const e = Math.pow(t, 0.85);
    const w = coreW + (OUT - coreW) * e;
    const h = coreH + (OUT - coreH) * e;
    const rx = Math.min(w, h) / 2;
    const fade = t > 0.7 ? 1 - ((t - 0.7) / 0.3) * 0.7 : 1;
    const dur = isRec ? 5.2 : 11;
    const amp = 1 + (isRec ? 0.012 : 0.006) + t * (isRec ? 0.05 : 0.026);
    const amp2 = 1 - t * (isRec ? 0.03 : 0.014);
    layers.push({
      key: "l" + i,
      x: CX - w / 2, y: CY - h / 2, w, h, rx,
      fill: orbColor(t),
      opacity: fade,
      dur, delay: -(i * 0.42),
      amp, amp2,
      dx: Math.sin(i * 1.7) * (0.8 + t * 2.4),
      dy: Math.cos(i * 1.3) * (0.8 + t * 2.4),
    });
  }
  return { layers, coreW, coreH, coreR, CX, CY };
}

// --- Nav ---

const NAV_ITEMS: { label: string; to: string; d1: string; d2: string; active?: boolean }[] = [
  { label: "Home", to: "/", d1: "M4 11l8-7 8 7", d2: "M6 10v10h12V10" },
  { label: "Transform", to: "/transform", d1: "M12 4l1.8 4.6L18.5 10l-4.7 1.4L12 16l-1.8-4.6L5.5 10l4.7-1.4z", d2: "M18 16v4M16 18h4" },
  { label: "Record", to: "/record", d1: "M9 4h6v8a3 3 0 0 1-6 0z", d2: "M6 11a6 6 0 0 0 12 0M12 17v3", active: true },
  { label: "Track", to: "/track", d1: "M5 20V11M11 20V5M17 20v-7", d2: "M3 20h18" },
  { label: "Distribute", to: "/distribute", d1: "M5 6h14v14H5z", d2: "M5 10h14M9 3v4M15 3v4" },
  { label: "Settings", to: "/settings", d1: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", d2: "M19 12l2-1-1-3-2.3.5-1.4-1.4.5-2.3-3-1-1 2h-2l-1-2-3 1 .5 2.3-1.4 1.4L3 8l-1 3 2 1v2l-2 1 1 3 2.3-.5 1.4 1.4-.5 2.3 3 1 1-2h2l1 2 3-1-.5-2.3 1.4-1.4L21 16l1-3-2-1z" },
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
        <svg
          aria-hidden="true"
          width="18" height="18" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ marginLeft: "auto", transition: "transform .2s ease", transform: expanded ? "rotate(180deg)" : "none" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
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

  const { layers, coreW, coreH, coreR, CX, CY } = useMemo(() => buildOrbLayers(isRec), [isRec]);

  const geo = { x: CX - coreW / 2, y: CY - coreH / 2, w: coreW, h: coreH, r: coreR };
  const layerTransition = "x .8s ease, y .8s ease, width .8s ease, height .8s ease, rx .8s ease";

  const userName = state.user?.name ?? "";
  const userInitials = userName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U";
  const companyInitial = (ws.companyName || "C")[0].toUpperCase();

  return (
    <div style={{
      position: "fixed", inset: 0, overflow: "hidden",
      background: "radial-gradient(700px 520px at 28% 52%,rgba(160,205,255,0.45),rgba(160,205,255,0) 70%),linear-gradient(150deg,#5b9be4 0%,#3a82dc 42%,#1a56a8 100%)",
      fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',Inter,'Segoe UI',sans-serif",
      color: "#ffffff",
    }}>

        {/* Left rail */}
        <aside style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 88,
          boxSizing: "border-box",
          borderRight: "1px solid rgba(255,255,255,0.28)",
          background: "rgba(255,255,255,0.1)",
          display: "flex", flexDirection: "column", alignItems: "center", padding: "26px 0",
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24">
              <polygon points="12,3 21,21 12,21" fill="#0a66c2" />
              <polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55" />
            </svg>
          </div>
          <nav style={{ marginTop: "auto", marginBottom: "auto", padding: 8, borderRadius: 32, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.3)", display: "flex", flexDirection: "column", gap: 6 }}>
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
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={n.d1} /><path d={n.d2} />
                </svg>
              </button>
            ))}
          </nav>
          <button
            type="button"
            aria-label="Log out"
            title="Log out"
            onClick={handleLogout}
            style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
              <path d="M16 8l4 4-4 4" />
              <path d="M20 12H9" />
            </svg>
          </button>
        </aside>

        {/* Header */}
        <header style={{
          position: "absolute", left: 88, right: 0, top: 0, height: 88,
          boxSizing: "border-box", padding: "0 40px",
          borderBottom: "1px solid rgba(255,255,255,0.28)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: "-0.01em", lineHeight: 1.1 }}>Record</div>
            <div style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.9)" }}>Record audio and get a live transcript directly in your browser.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" style={{ height: 44, padding: "0 14px 0 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)", color: "#ffffff", fontFamily: "inherit", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#ffffff", color: "#0a66c2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{companyInitial}</span>
              <span>{ws.companyName || "Company"}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 9l5-5 5 5" /><path d="M7 15l5 5 5-5" />
              </svg>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 5px 0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 17h12l-1.5-2V11a4.5 4.5 0 0 0-9 0v4z" />
                <path d="M10 20a2 2 0 0 0 4 0" />
              </svg>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(145deg,#ffffff,#b9d6f8)", color: "#0a4a94", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, marginLeft: 6 }}>
                {userInitials}
              </div>
            </div>
          </div>
        </header>

        {/* Orb */}
        <div style={{ position: "absolute", left: 168, top: 170, width: 400, height: 400 }}>
          <button
            type="button"
            aria-label={isRec ? "Stop recording" : "Start recording"}
            onClick={isRec ? stopRecording : startRecording}
            style={{ position: "absolute", left: 0, top: 0, width: 400, height: 400, border: 0, padding: 0, background: "transparent", cursor: "pointer", borderRadius: "50%", transition: "transform .5s ease" }}
          >
            <svg
              aria-hidden="true"
              width="400" height="400" viewBox="0 0 400 400"
              style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
            >
              <defs>
                <filter id="rc-soft" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation="0.7" />
                </filter>
                <filter id="rc-coreGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="9" />
                </filter>
                <radialGradient id="rc-aura" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx={CX} cy={CY} r="200" fill="url(#rc-aura)" opacity="0.5" />
              {isRec && (
                <>
                  <circle className="db-hr" cx={CX} cy={CY} r="168" fill="none" stroke="#ffffff" strokeWidth="1.6" />
                  <circle className="db-hr" cx={CX} cy={CY} r="168" fill="none" stroke="#ffffff" strokeWidth="1.6" style={{ animationDelay: "-2.1s" }} />
                </>
              )}
              <g filter="url(#rc-soft)">
                {layers.map((l) => (
                  <rect
                    key={l.key}
                    className="db-hl"
                    x={l.x} y={l.y} width={l.w} height={l.h} rx={l.rx}
                    fill={l.fill} opacity={l.opacity}
                    stroke="rgba(255,255,255,0.3)" strokeWidth="1"
                    style={{
                      "--amp": l.amp,
                      "--amp2": l.amp2,
                      "--dx": `${l.dx.toFixed(2)}px`,
                      "--dy": `${l.dy.toFixed(2)}px`,
                      animationDuration: `${l.dur}s`,
                      animationDelay: `${l.delay.toFixed(2)}s`,
                      transition: layerTransition,
                    } as React.CSSProperties}
                  />
                ))}
              </g>
              <rect
                x={geo.x} y={geo.y} width={geo.w} height={geo.h} rx={geo.r}
                fill="#ffffff" opacity="0.7"
                filter="url(#rc-coreGlow)"
                style={{ transition: "x .8s ease, y .8s ease, width .8s ease, height .8s ease, rx .8s ease" }}
              />
              <rect
                x={geo.x} y={geo.y} width={geo.w} height={geo.h} rx={geo.r}
                fill="#ffffff"
                style={{ transition: "x .8s ease, y .8s ease, width .8s ease, height .8s ease, rx .8s ease" }}
              />
              {/* Mic glyph (visible when idle) */}
              <g style={{ transition: "opacity .5s ease", opacity: isRec ? 0 : 1 }}>
                <path d="M146 214 V232 C146 270 254 270 254 232 V214" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="200" cy="296" r="7" fill="#ffffff" />
              </g>
              {/* Stop glyph (visible when recording) */}
              <rect x="182" y="178" width="36" height="36" rx="9" fill="#0a66c2" style={{ transition: "opacity .5s ease", opacity: isRec ? 1 : 0 }} />
            </svg>
          </button>
        </div>

        {/* Caption */}
        <div style={{ position: "absolute", left: 168, top: 546, width: 400, textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>
            {isRec ? "Recording" : isDone ? "Tap to record again" : "Click to start recording"}
          </div>
          <div style={{ marginTop: 6, fontSize: 15, color: "rgba(255,255,255,0.9)" }}>
            {isRec
              ? `${formatTime(seconds)} - tap the mic to stop`
              : "Your words become a live transcript"}
          </div>
          {error && (
            <div style={{ marginTop: 8, fontSize: 13, color: "#fca5a5" }}>{error}</div>
          )}
        </div>

        {/* Transcription logs panel */}
        <div style={{
          position: "absolute", left: 700, top: 112, width: 620, height: 728,
          boxSizing: "border-box", padding: 24, borderRadius: 28,
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
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 4h6v8a3 3 0 0 1-6 0z" />
                  <path d="M6 11a6 6 0 0 0 12 0M12 17v3" />
                </svg>
              </div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>No recordings yet</div>
              <div style={{ maxWidth: 300, fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.92)" }}>
                Tap the mic and start talking. Your transcript will show up here.
              </div>
            </div>
          )}
        </div>

    </div>
  );
}
