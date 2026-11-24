import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppHeader, AppRail } from "@/components/spectr/AppChrome";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, ChevronDown, Mic } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";
import { toast } from "sonner";
import { MicHalo, type OrbState } from "@/components/spectr/MicHalo";
import { PlayBanner } from "@/components/spectr/GrowthCards";
import { playSearch, usePlay } from "@/lib/use-growth";
import { advancePlay, insertWithLinks, type RepoCtx } from "@/lib/growth-repo";
import { guidedPrompts } from "@/lib/growth-prompts";

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface SpeechRecognizer {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
}
type SpeechWindow = {
  SpeechRecognition?: new () => SpeechRecognizer;
  webkitSpeechRecognition?: new () => SpeechRecognizer;
};

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: playSearch,
});

// --- Helpers ---

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
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
  const user = (userName || "User")
    .split(/\s+/)[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 20);
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
  const ML = 20,
    MT = 25,
    CW = 170;
  let y = MT;
  const ensureSpace = (n: number) => {
    if (y + n > 282) {
      doc.addPage();
      y = MT;
    }
  };
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
          }),
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
        <span
          style={{
            height: 22,
            padding: "0 9px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.24)",
            fontSize: 12,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          {formatDuration(entry.duration_seconds)}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          style={{
            marginLeft: "auto",
            transition: "transform .2s ease",
            transform: expanded ? "rotate(180deg)" : "none",
          }}
          aria-hidden="true"
        />
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 14,
          lineHeight: "1.55",
          color: "rgba(255,255,255,0.94)",
          ...(expanded
            ? {}
            : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }),
        }}
      >
        {entry.transcript_text}
      </div>
      {expanded && (
        <div
          style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onSendToTransform(entry.transcript_text)}
            style={{
              height: 34,
              padding: "0 16px",
              borderRadius: 999,
              border: 0,
              background: "#ffffff",
              color: "#0a66c2",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Take to Transform
          </button>
          <button
            onClick={() =>
              dlDocx(entry.transcript_text, buildFilename(companyName, userName, "docx", date))
            }
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.14)",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "inherit",
            }}
          >
            <Download size={13} />
            DOCX
          </button>
          <button
            onClick={() =>
              dlPdf(entry.transcript_text, buildFilename(companyName, userName, "pdf", date))
            }
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.14)",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "inherit",
            }}
          >
            <Download size={13} />
            PDF
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.7)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
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
  const { play: playId } = Route.useSearch();
  const ctx: RepoCtx | null = useMemo(
    () =>
      ws.companyId && state.user?.id ? { companyId: ws.companyId, userId: state.user.id } : null,
    [ws.companyId, state.user?.id],
  );
  const { play, refresh: refreshPlay } = usePlay(ctx, playId);

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState("");
  const [micReady, setMicReady] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [logs, setLogs] = useState<TranscriptLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const recognitionRef = useRef<SpeechRecognizer | null>(null);
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
    const { data, error: err } = await insertWithLinks(
      "transcripts",
      { company_id: companyId, user_id: userId, transcript_text: text, duration_seconds: duration },
      { play_id: playId },
    );
    if (!err && data && ctx && playId) {
      await advancePlay(ctx, playId, "recorded", { linkedLogId: data.id as string }).catch(
        () => {},
      );
      refreshPlay();
    }
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
      (window as unknown as SpeechWindow).SpeechRecognition ||
      (window as unknown as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setError("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    setError("");
    setMicReady(false);
    setMicDenied(false);
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
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalRef.current += t + " ";
        else interim += t;
      }
      setTranscript(finalRef.current);
      setInterimText(interim);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow microphone access and try again.");
        setMicDenied(true);
        setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };
    recognition.onend = () => {
      if (stoppedManuallyRef.current) {
        setInterimText("");
      } else {
        try {
          recognition.start();
        } catch {
          /* recognizer is already running */
        }
      }
    };
    recognition.onstart = () => setMicReady(true);
    recognition.onaudiostart = () => setMicReady(true);
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
    navigate({ to: "/transform", search: playId ? { play: playId } : {} });
  };

  const isRec = recording;
  const isDone = !recording && !!transcript;
  const orbState: OrbState = micDenied
    ? "denied"
    : isRec
      ? micReady
        ? "recording"
        : "loading"
      : "idle";
  const liveText = transcript + (interimText ? " " + interimText : "");
  const hasLogs = logs.length > 0;

  const userName = state.user?.name ?? "";

  return (
    <div className="sx-shell">
      <AppRail active="/record" />

      <AppHeader
        title="Record"
        subtitle="Record audio and get a live transcript directly in your browser."
      />

      <main className="sx-main sx-fit sx-fit-rc">
        <div className="sx-page">
          <div className="rc-layout">
            <div className="rc-orbcol">
              {/* Orb */}
              <MicHalo
                state={orbState}
                onClick={isRec ? stopRecording : startRecording}
                liveAudio
              />

              {/* Caption */}
              <div
                style={{
                  marginTop: 18,
                  position: "relative",
                  width: "100%",
                  maxWidth: 460,
                  textAlign: "center",
                }}
              >
                {orbState === "denied" ? (
                  <div className="mo-denied" role="alert">
                    <span style={{ flex: "1 1 220px" }}>
                      Microphone access is blocked. Allow it in your browser settings and try again.
                    </span>
                    <button type="button" onClick={startRecording}>
                      Try again
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                      }}
                      aria-live="polite"
                    >
                      {orbState === "recording" && (
                        <span className="mo-status-dot" aria-hidden="true" />
                      )}
                      {orbState === "recording"
                        ? "Recording"
                        : orbState === "loading"
                          ? "Requesting microphone"
                          : "Click to start recording"}
                      {orbState === "recording" && (
                        <span
                          style={{
                            fontWeight: 500,
                            fontVariantNumeric: "tabular-nums",
                            color: "rgba(255,255,255,0.9)",
                          }}
                        >
                          {formatTime(seconds)}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 15, color: "rgba(255,255,255,0.9)" }}>
                      {orbState === "recording"
                        ? "Tap the mic to stop"
                        : orbState === "loading"
                          ? "Allow access in your browser to begin"
                          : "Your words become a live transcript"}
                    </div>
                    {error && (
                      <div className="mo-denied" role="alert" style={{ marginTop: 14 }}>
                        {error}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Transcription logs panel */}
            <div
              className="rc-panel"
              style={{
                boxSizing: "border-box",
                padding: 24,
                borderRadius: 28,
                minWidth: 0,
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.4)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                boxShadow: "0 10px 30px rgba(6,42,92,0.14)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {play && (
                <div style={{ marginBottom: 16, flexShrink: 0 }}>
                  <PlayBanner
                    play={play}
                    prompts={guidedPrompts(play, ws)}
                    note={
                      play.status === "recorded" || play.linkedLogId
                        ? "Recorded and linked to this play. Take it to Transform next."
                        : "Tap the mic and speak to these prompts. Your recording is linked to this play when you save it."
                    }
                    onClear={() => navigate({ to: "/record", search: {} })}
                  />
                </div>
              )}
              {/* Panel header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>
                  Transcription logs
                </div>
                {hasLogs && (
                  <span
                    style={{
                      minWidth: 24,
                      height: 24,
                      padding: "0 8px",
                      boxSizing: "border-box",
                      borderRadius: 12,
                      background: "#ffffff",
                      color: "#0a66c2",
                      fontSize: 13,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {logs.length}
                  </span>
                )}
              </div>

              {/* Live transcript while recording */}
              {isRec && (
                <div
                  style={{
                    flexShrink: 0,
                    marginTop: 16,
                    boxSizing: "border-box",
                    padding: "18px 20px",
                    borderRadius: 20,
                    background: "#ffffff",
                    color: "#0b1220",
                    boxShadow: "0 14px 34px rgba(6,42,92,0.22)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <span
                      className="rc-live"
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: "#d92d20",
                        display: "inline-block",
                      }}
                    />
                    <span style={{ color: "#0b1220" }}>Live transcript</span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 13,
                        color: "#475569",
                        fontWeight: 500,
                      }}
                    >
                      {formatTime(seconds)}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 15,
                      lineHeight: 1.6,
                      color: "#1c2a3f",
                      minHeight: 96,
                    }}
                  >
                    {liveText || <span style={{ color: "#94a3b8" }}>Listening...</span>}
                    <span
                      style={{
                        display: "inline-block",
                        width: 2,
                        height: 16,
                        marginLeft: 2,
                        verticalAlign: "-3px",
                        background: "#0a66c2",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Done - save new transcript */}
              {isDone && (
                <div
                  style={{
                    flexShrink: 0,
                    marginTop: 16,
                    boxSizing: "border-box",
                    padding: "18px 20px",
                    borderRadius: 20,
                    background: "#ffffff",
                    color: "#0b1220",
                    boxShadow: "0 14px 34px rgba(6,42,92,0.22)",
                  }}
                >
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: "#0b1220", marginBottom: 10 }}
                  >
                    New transcript
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: "#1c2a3f",
                      maxHeight: 100,
                      overflow: "hidden",
                    }}
                  >
                    {transcript.slice(0, 200)}
                    {transcript.length > 200 ? "..." : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <button
                      onClick={handleSave}
                      disabled={saving || saved}
                      style={{
                        height: 34,
                        padding: "0 16px",
                        borderRadius: 999,
                        border: 0,
                        background: saved ? "#12b76a" : "#0a66c2",
                        color: "#ffffff",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        opacity: saving || saved ? 0.9 : 1,
                      }}
                    >
                      {saved ? (
                        <>
                          <Check size={13} />
                          Saved
                        </>
                      ) : saving ? (
                        "Saving..."
                      ) : (
                        "Save"
                      )}
                    </button>
                    <button
                      onClick={() => sendToTransform(transcript)}
                      style={{
                        height: 34,
                        padding: "0 16px",
                        borderRadius: 999,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: "rgba(0,0,0,0.06)",
                        color: "#0b1220",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Take to Transform
                    </button>
                  </div>
                </div>
              )}

              {/* Log entries */}
              {hasLogs && (
                <div
                  style={{
                    marginTop: 16,
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
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

              {/* Empty state */}
              {!hasLogs && !isRec && !isDone && (
                <div
                  style={{
                    marginTop: 16,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    gap: 14,
                    borderRadius: 20,
                    border: "1.5px dashed rgba(255,255,255,0.5)",
                  }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 20,
                      background: "rgba(255,255,255,0.18)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Mic size={28} strokeWidth={1.8} color="#ffffff" aria-hidden="true" />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>No recordings yet</div>
                  <div
                    style={{
                      maxWidth: 300,
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    Tap the mic and start talking. Your transcript will show up here.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
