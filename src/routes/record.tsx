import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppGate, AppHeader, AppRail } from "@/components/spectr/AppChrome";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, ChevronDown, Mic, X, Play, Square, Volume2, VolumeX } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";
import { toast } from "sonner";
import { MicHalo, type OrbState } from "@/components/spectr/MicHalo";
import { PlayBanner } from "@/components/spectr/GrowthCards";
import { playSearch, usePlay } from "@/lib/use-growth";
import { advancePlay, insertWithLinks, type RepoCtx } from "@/lib/growth-repo";
import { guidedPrompts } from "@/lib/growth-prompts";
import { useEscape } from "@/lib/use-escape";
import { demoEvent, isDemo } from "@/demo/mode";
import { SamplePlayer, SAMPLE_DURATION, SAMPLE_WORDS } from "@/demo/sample-player";

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
  component: () => (
    <AppGate>
      <RecordPage />
    </AppGate>
  ),
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
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedErr, setTypedErr] = useState(false);
  useEscape(typing, () => setTyping(false));

  const recognitionRef = useRef<SpeechRecognizer | null>(null);
  const finalRef = useRef("");
  const stoppedManuallyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const [demo] = useState(isDemo);
  const playerRef = useRef<SamplePlayer | null>(null);
  const [sampleWords, setSampleWords] = useState(0);
  /** idle, playing, ended (audio finished, waiting for Stop) or stopped. Mirrored on <html data-sample> for the tour. */
  const [sampleState, setSampleState] = useState<"idle" | "playing" | "ended" | "stopped">("idle");
  const [muted, setMuted] = useState(false);
  const sampleOn = sampleState === "playing" || sampleState === "ended";

  useEffect(() => {
    if (!demo) return;
    document.documentElement.dataset.sample = sampleState;
    return () => {
      delete document.documentElement.dataset.sample;
    };
  }, [demo, sampleState]);

  const clearSample = () => {
    playerRef.current?.stop();
    playerRef.current = null;
  };

  /** Demo only: plays the spoken sample take while its transcript appears word by word, in time with the voice. */
  const playSample = () => {
    clearSample();
    setError("");
    setMicDenied(false);
    setTranscript("");
    setInterimText("");
    setSaved(false);
    finalRef.current = "";
    stoppedManuallyRef.current = false;
    recognitionRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    setSampleWords(0);
    setSeconds(0);
    setMicReady(true);
    setRecording(true);
    setSampleState("playing");
    demoEvent("sample recording");
    const player = new SamplePlayer({
      onWords: setSampleWords,
      onTime: setSeconds,
      onEnd: () => setSampleState((s) => (s === "playing" ? "ended" : s)),
      onMode: (mode) => demoEvent("sample mode", { mode }),
    });
    playerRef.current = player;
    player.setMuted(muted);
    player.start();
  };

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    playerRef.current?.setMuted(m);
  };

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
      clearSample();
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
      toast.error("Could not save the transcript", {
        description: "Your text is still here.",
        action: { label: "Retry", onClick: () => handleSave() },
      });
    }
  };

  const startRecording = () => {
    const SpeechRecognitionAPI =
      (window as unknown as SpeechWindow).SpeechRecognition ||
      (window as unknown as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setError(
        "Live transcription is not supported in this browser. Use Chrome or Edge, or paste your text instead.",
      );
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
      const stop = (message: string) => {
        stoppedManuallyRef.current = true;
        setError(message);
        setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        durationRef.current = seconds;
        setTranscript(finalRef.current.trim());
      };
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        stop("Microphone access denied. Please allow microphone access and try again.");
        setMicDenied(true);
      } else if (event.error === "audio-capture") {
        stop("No microphone was found. Connect one and try again, or paste your text instead.");
      } else if (event.error === "network") {
        stop(
          "The transcription service could not be reached. Anything captured so far is kept below. You can try again or paste your text instead.",
        );
      }
      // "no-speech" and "aborted" are normal pauses; recognition restarts on its own.
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
    const player = playerRef.current;
    if (player) {
      // The sample take: keep what was heard so far (all of it when the audio has ended).
      const heard = SAMPLE_WORDS.slice(
        0,
        sampleState === "ended" ? SAMPLE_WORDS.length : sampleWords,
      );
      finalRef.current = heard.join(" ");
      durationRef.current = Math.min(Math.floor(SAMPLE_DURATION), Math.floor(player.time()));
      clearSample();
      setSampleState("stopped");
    } else {
      durationRef.current = seconds;
    }
    stoppedManuallyRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    recognitionRef.current?.stop();
    setRecording(false);
    setInterimText("");
    const text = finalRef.current.trim();
    setTranscript(text);
    if (player && text) void saveAndContinue(text, durationRef.current);
  };

  /** Demo sample take: Stop saves it, links it to the play, and moves on to Transform. */
  const saveAndContinue = async (text: string, duration: number) => {
    setSaving(true);
    const ok = await saveTranscript(text, duration);
    setSaving(false);
    if (ok) {
      setSaved(true);
      toast.success(playId ? "Saved and linked to this play" : "Transcript saved");
    }
    window.setTimeout(() => sendToTransform(text), 700);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("transcripts").delete().eq("id", id);
    if (!error) setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const sendToTransform = (text: string) => {
    sessionStorage.setItem("pendingTranscript", text);
    navigate({ to: "/transform", search: playId ? { play: playId } : {} });
  };

  const saveTyped = async () => {
    const text = typed.trim();
    if (!text) {
      setTypedErr(true);
      return;
    }
    setSaving(true);
    const ok = await saveTranscript(text, 0);
    setSaving(false);
    if (!ok) {
      toast.error("Could not save it", { description: "Your text is still here. Try again." });
      return;
    }
    toast.success("Added to your logs");
    setTyping(false);
    setTyped("");
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
  const sampleText = SAMPLE_WORDS.slice(0, sampleWords);
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
            <div className="rc-orbcol" data-tour="orb-col">
              {/* Orb */}
              <MicHalo
                state={orbState}
                onClick={isRec ? stopRecording : startRecording}
                liveAudio={!demo}
                level={sampleOn ? () => playerRef.current?.level() ?? 0 : undefined}
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
                ) : null}
                {orbState === "denied" ? (
                  <button type="button" className="rc-paste" onClick={() => setTyping(true)}>
                    Paste or type instead
                  </button>
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
                      {sampleState === "ended"
                        ? "Take finished"
                        : orbState === "recording"
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
                      {sampleState === "ended"
                        ? "Click Stop to save it"
                        : orbState === "recording"
                          ? "Tap the mic or Stop when you are done"
                          : orbState === "loading"
                            ? "Allow access in your browser to begin"
                            : "Your words become a live transcript"}
                    </div>
                    {error && (
                      <div className="mo-denied" role="alert" style={{ marginTop: 14 }}>
                        {error}
                      </div>
                    )}
                    {isRec && (
                      <button
                        type="button"
                        className="gh-btn gh-btn--primary rc-stop"
                        onClick={stopRecording}
                        data-tour="stop-recording"
                      >
                        <Square size={13} fill="currentColor" aria-hidden="true" />
                        Stop
                      </button>
                    )}
                    {demo && !isRec && (
                      <button
                        type="button"
                        className="gh-btn gh-btn--primary rc-sample"
                        onClick={playSample}
                        data-tour="sample-recording"
                      >
                        <Play size={15} aria-hidden="true" />
                        Use sample recording
                      </button>
                    )}
                    {!isRec && (
                      <button
                        type="button"
                        className="rc-paste"
                        onClick={() => setTyping(true)}
                        data-tour="paste-instead"
                      >
                        Paste or type instead
                      </button>
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
                <div data-tour="live-transcript" className="rc-card rc-card--live" aria-live="off">
                  <div className="rc-card-head">
                    <span className="rc-live rc-dot" aria-hidden="true" />
                    <span>Live transcript</span>
                    {sampleOn && (
                      <button
                        type="button"
                        className="rc-sound"
                        onClick={toggleMute}
                        aria-pressed={!muted}
                        aria-label={muted ? "Sound off. Turn sound on" : "Sound on. Mute"}
                        data-tour="sound-toggle"
                      >
                        {muted ? (
                          <VolumeX size={14} aria-hidden="true" />
                        ) : (
                          <Volume2 size={14} aria-hidden="true" />
                        )}
                        {muted ? "Sound off" : "Sound on"}
                      </button>
                    )}
                    <span className="rc-time">{formatTime(seconds)}</span>
                  </div>
                  <div className="rc-live-text" data-words={sampleOn ? sampleWords : undefined}>
                    {sampleOn ? (
                      sampleText.length ? (
                        sampleText.map((w, k) => (
                          <span key={k} className="rc-w">
                            {w}{" "}
                          </span>
                        ))
                      ) : (
                        <span className="rc-placeholder">Listening...</span>
                      )
                    ) : liveText ? (
                      <>
                        {transcript}
                        {interimText && <span className="rc-interim"> {interimText}</span>}
                      </>
                    ) : (
                      <span className="rc-placeholder">Listening...</span>
                    )}
                    <span className="rc-caret" aria-hidden="true" />
                  </div>
                </div>
              )}

              {/* Done - save new transcript */}
              {isDone && (
                <div data-tour="new-transcript" className="rc-card">
                  <div className="rc-card-head">
                    <span>New transcript</span>
                    {durationRef.current > 0 && (
                      <span className="rc-time">{formatTime(durationRef.current)}</span>
                    )}
                  </div>
                  <div className="rc-done-text">
                    {transcript.slice(0, 200)}
                    {transcript.length > 200 ? "..." : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="gh-btn gh-btn--primary gh-btn--small"
                      onClick={handleSave}
                      disabled={saving || saved}
                    >
                      {saved ? (
                        <>
                          <Check size={13} aria-hidden="true" />
                          Saved
                        </>
                      ) : saving ? (
                        "Saving..."
                      ) : (
                        "Save"
                      )}
                    </button>
                    <button
                      type="button"
                      className="gh-btn gh-btn--ghost gh-btn--small"
                      data-tour="take-to-transform"
                      onClick={() => sendToTransform(transcript)}
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
      {typing && (
        <div
          className="gx-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTyping(false);
          }}
        >
          <div className="gx-dialog" role="dialog" aria-modal="true" aria-labelledby="rc-type-h">
            <div className="gx-head">
              <h2 id="rc-type-h" className="gh-h2">
                Paste or type instead
              </h2>
              <button
                type="button"
                className="gx-close"
                aria-label="Close"
                onClick={() => setTyping(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="gx-sub">
              Paste a transcript or notes, or type your thoughts. It works exactly like a recording
              {play ? " and is linked to this play" : ""}.
            </p>
            <label className="gx-label" htmlFor="rc-typed">
              Your text
            </label>
            <textarea
              id="rc-typed"
              autoFocus
              className="tf-in gx-input"
              rows={8}
              value={typed}
              aria-invalid={typedErr}
              onChange={(e) => {
                setTyped(e.target.value);
                setTypedErr(false);
              }}
              placeholder="Start typing or paste here"
            />
            {typedErr && <div className="ds-err">Add some text first</div>}
            <div className="gx-actions">
              <button
                type="button"
                className="gh-btn gh-btn--ghost"
                disabled={saving}
                onClick={saveTyped}
              >
                {saving ? "Saving" : "Save to logs"}
              </button>
              <button
                type="button"
                className="gh-btn gh-btn--primary"
                onClick={() => {
                  if (!typed.trim()) {
                    setTypedErr(true);
                    return;
                  }
                  sendToTransform(typed.trim());
                }}
              >
                Take to Transform
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
