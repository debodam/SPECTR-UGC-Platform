/**
 * The demo's sample recording: a real spoken take (public/demo/sample-recording.m4a) with a transcript revealed
 * word by word from the audio clock, so pauses, seeks and background tabs cannot pull them apart.
 *
 * Order of preference, never throwing:
 * 1. the audio file, words from audio.currentTime, orb level from a Web Audio AnalyserNode on the element;
 * 2. if the file cannot load or play: speechSynthesis with word boundary events and the best en-US voice;
 *    if no boundary arrives within 1.5 s, words follow the recorded timings on a clock instead;
 * 3. if sound is blocked altogether: words follow the timings on a clock at the take's natural pace (~150 wpm).
 * Muting keeps everything running; only the sound goes.
 */
import timings from "./seed/sampleRecordingTimings.json";
import { demoEvent } from "./mode";

export const SAMPLE_SRC = "/demo/sample-recording.m4a";
export const SAMPLE_WORDS: string[] = timings.words.map((w) => w.w);
const STARTS: number[] = timings.words.map((w) => w.t / 1000);
export const SAMPLE_DURATION = timings.durationMs / 1000;

export type SampleMode = "audio" | "speech" | "clock";
export interface SampleHandlers {
  /** Number of words revealed so far (only called when it changes). */
  onWords: (count: number) => void;
  /** Elapsed seconds of the take. */
  onTime: (seconds: number) => void;
  /** The take reached its end. */
  onEnd: () => void;
  onMode?: (mode: SampleMode) => void;
}

/** How many words have started by time t (seconds). */
export const wordsAt = (t: number) => {
  let lo = 0,
    hi = STARTS.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (STARTS[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

type Graph = {
  audio: HTMLAudioElement;
  ctx: AudioContext | null;
  analyser: AnalyserNode | null;
  gain: GainNode | null;
};

/** The audio element and its Web Audio graph (source, analyser for the orb, gain for mute). */
function buildGraph(): Graph {
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = SAMPLE_SRC;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return { audio, ctx: null, analyser: null, gain: null };
    const ctx = new Ctx();
    const src = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    const gain = ctx.createGain();
    src.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);
    return { audio, ctx, analyser, gain };
  } catch {
    /* no Web Audio: the element plays directly and the orb uses the envelope */
    return { audio, ctx: null, analyser: null, gain: null };
  }
}

let prepared: Graph | null = null;
const takePrepared = () => {
  const g = prepared;
  prepared = null;
  return g;
};

/**
 * Builds the audio element and graph ahead of time (in idle time on the Record page), so pressing
 * "Use sample recording" only has to start playback. The context starts suspended and resumes on the click.
 */
export function prepareSample() {
  if (prepared || typeof window === "undefined") return;
  try {
    prepared = buildGraph();
  } catch {
    prepared = null;
  }
}

export class SamplePlayer {
  private h: SampleHandlers;
  private mode: SampleMode = "audio";
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gain: GainNode | null = null;
  private buf: Float32Array<ArrayBuffer> | null = null;
  private raf = 0;
  private shown = -1;
  private lastSec = -1;
  private ended = false;
  private stopped = false;
  private muted = false;
  private clockStart = 0;
  private clockOffset = 0;
  private envelope = 0;
  private envTarget = 0;
  private boundaryTimer = 0;

  constructor(h: SampleHandlers) {
    this.h = h;
  }

  get currentMode() {
    return this.mode;
  }

  /** Seconds into the take, from whichever clock is driving it. */
  time(): number {
    if (this.mode === "audio" && this.audio) return this.audio.currentTime;
    if (this.mode === "clock")
      return this.clockOffset + (performance.now() - this.clockStart) / 1000;
    return this.speechTime;
  }

  /** Current loudness 0..1 for the orb. */
  level(): number {
    if (this.ended || this.stopped) return 0;
    if (this.mode === "audio" && this.analyser && this.buf) {
      this.analyser.getFloatTimeDomainData(this.buf);
      let sum = 0;
      for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
      return Math.pow(
        Math.min(1, Math.max(0, (Math.sqrt(sum / this.buf.length) - 0.004) / 0.1)),
        0.7,
      );
    }
    // Speech and clock: a smoothed random envelope that jumps on each word.
    this.envTarget *= 0.93;
    this.envelope += (this.envTarget - this.envelope) * 0.25;
    return this.envelope;
  }

  start() {
    this.setMode("audio");
    try {
      // Use the element and audio graph prepared in idle time if there is one, so the click does little work.
      const g = takePrepared() ?? buildGraph();
      const a = g.audio;
      this.audio = a;
      if (g.ctx && g.analyser && g.gain) {
        this.ctx = g.ctx;
        this.analyser = g.analyser;
        this.gain = g.gain;
        this.buf = new Float32Array(g.analyser.fftSize);
        void g.ctx.resume().catch(() => {});
      }
      a.addEventListener("ended", () => this.finish());
      a.addEventListener("error", () => this.fallbackToSpeech("audio error"));
      a.play().then(
        () => this.loop(),
        () => this.fallbackToSpeech("play blocked"),
      );
    } catch {
      this.fallbackToSpeech("audio unavailable");
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.gain) this.gain.gain.value = m ? 0 : 1;
    else if (this.audio) this.audio.muted = m;
    if (m && (this.mode === "speech" || this.mode === "clock")) {
      if (this.mode === "clock") {
        window.speechSynthesis?.cancel();
        return;
      }
      // speechSynthesis cannot be muted mid sentence: carry on silently on the clock from where it was.
      const t = this.time();
      window.speechSynthesis?.cancel();
      this.startClock(t);
    }
  }

  /** Stops playback early or after the end. Safe to call more than once. */
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.boundaryTimer);
    try {
      this.audio?.pause();
    } catch {
      /* already stopped */
    }
    if (this.mode === "speech") window.speechSynthesis?.cancel();
    void this.ctx?.close().catch(() => {});
  }

  private setMode(m: SampleMode) {
    this.mode = m;
    this.h.onMode?.(m);
  }

  private loop = () => {
    if (this.stopped) return;
    const t = this.time();
    this.emit(t);
    if (this.mode !== "audio" && t >= SAMPLE_DURATION) return this.finish();
    this.raf = requestAnimationFrame(this.loop);
  };

  private emit(t: number) {
    const n = this.ended ? SAMPLE_WORDS.length : wordsAt(t);
    if (n !== this.shown) {
      if (n > this.shown) this.envTarget = 0.45 + Math.random() * 0.5;
      this.shown = n;
      this.h.onWords(n);
    }
    const sec = Math.min(Math.floor(SAMPLE_DURATION), Math.floor(t));
    if (sec !== this.lastSec) {
      this.lastSec = sec;
      this.h.onTime(sec);
    }
  }

  private finish() {
    if (this.ended || this.stopped) return;
    this.ended = true;
    cancelAnimationFrame(this.raf);
    this.shown = -1;
    this.emit(SAMPLE_DURATION);
    this.h.onTime(Math.floor(SAMPLE_DURATION));
    this.h.onEnd();
  }

  // ── speechSynthesis fallback ──
  private speechTime = 0;
  private speechStarted = 0;

  private fallbackToSpeech(reason: string) {
    if (this.stopped || this.mode !== "audio") return;
    demoEvent("sample audio fallback", { reason });
    cancelAnimationFrame(this.raf);
    this.audio = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;
    this.gain = null;
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth || this.muted) return this.startClock(0);
    try {
      this.setMode("speech");
      const text = SAMPLE_WORDS.join(" ");
      const charStarts: number[] = [];
      let at = 0;
      for (const w of SAMPLE_WORDS) {
        charStarts.push(at);
        at += w.length + 1;
      }
      const u = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices().filter((v) => v.lang === "en-US" || v.lang === "en_US");
      u.voice =
        voices.find((v) => /ava|samantha|zoe/i.test(v.name)) ??
        voices.find((v) => /natural|premium|enhanced/i.test(v.name)) ??
        voices[0] ??
        null;
      u.lang = "en-US";
      u.rate = 1;
      let gotBoundary = false;
      u.onstart = () => {
        this.speechStarted = performance.now();
        this.boundaryTimer = window.setTimeout(() => {
          // No word events from this voice: follow the recorded timings on a clock instead.
          if (!gotBoundary && this.mode === "speech") this.startClock(0, true);
        }, 1500);
      };
      u.onboundary = (e) => {
        if (e.name && e.name !== "word") return;
        gotBoundary = true;
        let i = 0;
        while (i + 1 < charStarts.length && charStarts[i + 1] <= e.charIndex) i++;
        // Map the spoken word back onto the take's timeline so the timer and reveal agree.
        this.speechTime = Math.max(this.speechTime, STARTS[i] ?? 0);
        this.emit(this.speechTime);
      };
      u.onend = () => {
        if (this.mode === "speech") this.finish();
      };
      u.onerror = () => {
        if (this.mode === "speech") this.startClock(this.speechTime);
      };
      synth.cancel();
      synth.speak(u);
      // Some browsers never fire onstart when sound is blocked.
      window.setTimeout(() => {
        if (this.mode === "speech" && !this.speechStarted) this.startClock(0);
      }, 1500);
    } catch {
      this.startClock(0);
    }
  }

  private startClock(from: number, keepSpeaking = false) {
    if (this.stopped || this.ended) return;
    if (!keepSpeaking) window.speechSynthesis?.cancel();
    this.setMode("clock");
    this.clockOffset = from;
    this.clockStart = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }
}
