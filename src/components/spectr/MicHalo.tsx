import { useEffect, useRef, useState } from "react";

export type OrbState = "idle" | "loading" | "recording" | "denied";

const LABELS: Record<OrbState, string> = {
  idle: "Start recording",
  loading: "Requesting microphone access",
  recording: "Stop recording",
  denied: "Try recording again",
};

let noiseUrl: string | null = null;
function makeNoise() {
  if (noiseUrl) return noiseUrl;
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseUrl = c.toDataURL("image/png");
  return noiseUrl;
}

/**
 * One rAF loop per orb. Writes the sprung mic level into --lvl on the button and sets blob/ripple
 * playback speed (hover +30%, louder voice faster). No React state is touched per frame.
 */
function useOrbMotion(
  orb: React.RefObject<HTMLButtonElement | null>,
  blobs: React.RefObject<HTMLSpanElement | null>,
  ripples: React.RefObject<HTMLSpanElement | null>,
  listening: boolean,
  external: React.RefObject<(() => number) | null | undefined>,
) {
  useEffect(() => {
    const el = orb.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false,
      raf = 0;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let buf: Float32Array<ArrayBuffer> | null = null;

    if (listening && navigator.mediaDevices?.getUserMedia) {
      // The speech recognizer exposes no stream; this reuses the origin's existing mic permission.
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((s) => {
          if (cancelled) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          stream = s;
          ctx = new AudioContext();
          analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          ctx.createMediaStreamSource(s).connect(analyser);
          buf = new Float32Array(analyser.fftSize);
        })
        .catch(() => {});
    }

    let smooth = 0,
      lvl = 0,
      vel = 0,
      rate = 1,
      frame = 0,
      written = -1,
      appliedRate = -1,
      hovered = false;
    // Hover is tracked with events, so the loop never queries styles.
    const enter = () => (hovered = true);
    const leave = () => (hovered = false);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    let anims: Animation[] = [];
    let rippleAnims: Animation[] = [];

    const tick = () => {
      if (frame++ % 60 === 0) {
        anims = blobs.current?.getAnimations({ subtree: true }) ?? [];
        rippleAnims = ripples.current?.getAnimations({ subtree: true }) ?? [];
      }
      let target = 0;
      if (external.current) {
        target = Math.max(0, Math.min(1, external.current()));
      } else if (analyser && buf) {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        target = Math.pow(
          Math.min(1, Math.max(0, (Math.sqrt(sum / buf.length) - 0.006) / 0.12)),
          0.7,
        );
      }
      smooth += (target - smooth) * (target > smooth ? 0.25 : 0.06);
      // Under-damped spring: a little overshoot so the core feels elastic rather than jittery.
      vel = (vel + (smooth - lvl) * 0.09) * 0.8;
      lvl = Math.max(0, Math.min(1.2, lvl + vel));
      // Only touch the style when the value moves, so a quiet orb causes no style work at all.
      if (Math.abs(lvl - written) > 0.002) {
        written = lvl;
        el.style.setProperty("--lvl", lvl.toFixed(3));
      }

      const wantRate = (hovered ? 1.3 : 1) * (1 + lvl * 1.6);
      rate += (wantRate - rate) * 0.08;
      // Retiming an animation has a cost, so only do it when the speed has actually changed.
      if (Math.abs(rate - appliedRate) > 0.01 || frame % 60 === 1) {
        appliedRate = rate;
        for (const a of anims) a.playbackRate = rate;
        for (const a of rippleAnims) a.playbackRate = 1 + lvl * 1.4;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
      el.style.removeProperty("--lvl");
      for (const a of [...anims, ...rippleAnims]) a.playbackRate = 1;
    };
  }, [orb, blobs, ripples, listening]);
}

export function MicHalo({
  state,
  onClick,
  liveAudio = false,
  level,
}: {
  state: OrbState;
  onClick: () => void;
  /** React to the live microphone level while recording. */
  liveAudio?: boolean;
  /** Reads a level 0..1 each frame from another source (the demo's sample recording) instead of the mic. */
  level?: () => number;
}) {
  const orb = useRef<HTMLButtonElement>(null);
  const blobs = useRef<HTMLSpanElement>(null);
  const ripples = useRef<HTMLSpanElement>(null);
  const [noise, setNoise] = useState<string | null>(null);
  useEffect(() => {
    setNoise(makeNoise());
  }, []);
  const external = useRef(level);
  external.current = level;
  useOrbMotion(orb, blobs, ripples, state === "recording" && liveAudio && !level, external);

  return (
    <div className="mo-slot">
      <button
        ref={orb}
        type="button"
        className={`mo mo--${state}`}
        aria-label={LABELS[state]}
        aria-busy={state === "loading"}
        onClick={onClick}
      >
        <span className="mo-ambient" />
        <span className="mo-x mo-ripples" ref={ripples}>
          <span className="mo-ripple" />
          <span className="mo-ripple" />
          <span className="mo-ripple" />
        </span>
        <span className="mo-x mo-aurax">
          <span className="mo-l mo-aura" />
        </span>
        <span className="mo-l mo-core" />
        <span className="mo-sheen" />
        <span
          className="mo-grain"
          style={noise ? { backgroundImage: `url(${noise})` } : undefined}
        />
        <span className="mo-orbcore">
          <span className="mo-cbloom" />
          <span className="mo-sphere" />
          <span className="mo-blobs" ref={blobs}>
            <span className="mo-blob b1" />
            <span className="mo-blob b2" />
            <span className="mo-blob b3" />
            <span className="mo-blob b4" />
          </span>
          <span className="mo-hotx">
            <span className="mo-hot" />
          </span>
        </span>
      </button>
    </div>
  );
}
