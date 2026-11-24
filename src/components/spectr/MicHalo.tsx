import { useEffect, useId, useMemo, useRef } from "react";
import { Mic } from "lucide-react";

// Geometry, colors and breathe values are taken from design/source/Record.dc.html and Dashboard.dc.html.
const N = 18, CX = 200, CY = 196, OUT = 352;

const STOPS: [number, string][] = [
  [0, "#ffffff"], [0.05, "#e3f1ff"], [0.14, "#8cc4fa"], [0.3, "#3b86dc"], [0.45, "#0a5ab4"],
  [0.56, "#0a4a94"], [0.68, "#3b86dc"], [0.8, "#8fc0f7"], [0.92, "#cfe4fc"], [1, "#eaf3fe"],
];

function ramp(t: number) {
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [a0, ac] = STOPS[i - 1], [b0, bc] = STOPS[i];
      const k = (t - a0) / (b0 - a0), ca = hex(ac), cb = hex(bc);
      return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * k)).join(",")})`;
    }
  }
  return "#eaf3fe";
}

function buildHalo(rec: boolean) {
  const coreW = rec ? 112 : 70, coreH = rec ? 112 : 124, coreR = rec ? 56 : 30;
  const layers = [];
  for (let i = N; i >= 1; i--) {
    const t = i / N;
    const e = Math.pow(t, 0.85);
    const w = coreW + (OUT - coreW) * e;
    const h = coreH + (OUT - coreH) * e;
    // Each ring gets its own period (about ±18% around the design value) so rings drift against each other.
    const spread = 0.82 + (((i * 37) % 17) / 16) * 0.36;
    layers.push({
      key: `l${i}`, t, x: CX - w / 2, y: CY - h / 2, w, h, rx: Math.min(w, h) / 2,
      fill: ramp(t),
      opacity: t > 0.7 ? 1 - ((t - 0.7) / 0.3) * 0.7 : 1,
      dur: (rec ? 5.2 : 11) * spread,
      delay: -(i * 0.42),
      amp: 1 + (rec ? 0.012 : 0.006) + t * (rec ? 0.05 : 0.026),
      amp2: 1 - t * (rec ? 0.03 : 0.014),
      dx: Math.sin(i * 1.7) * (0.8 + t * 2.4),
      dy: Math.cos(i * 1.3) * (0.8 + t * 2.4),
      phase: i * 2.399,
    });
  }
  return { layers, core: { x: CX - coreW / 2, y: CY - coreH / 2, width: coreW, height: coreH, rx: coreR } };
}

type Layer = ReturnType<typeof buildHalo>["layers"][number];

/** Drives ring scale, shake and opacity from the live mic level. Transform and opacity only. */
function useMicLevel(active: boolean, rings: React.MutableRefObject<(SVGGElement | null)[]>, ripples: React.RefObject<SVGGElement | null>, layers: Layer[]) {
  const layersRef = useRef(layers);
  layersRef.current = layers;

  useEffect(() => {
    if (!active || typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false, raf = 0;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;

    (async () => {
      try {
        // Same per-origin microphone permission the speech recognizer already holds, so no extra prompt.
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return; // halo keeps its CSS breathe if the meter is unavailable
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

      ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let level = 0;

      const tick = (now: number) => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const target = Math.pow(Math.min(1, Math.max(0, (rms - 0.006) / 0.12)), 0.7);
        level += (target - level) * (target > level ? 0.35 : 0.08);

        const ls = layersRef.current;
        rings.current.forEach((g, idx) => {
          const l = ls[idx];
          if (!g || !l) return;
          const shake = level * (0.4 + 3.4 * l.t);
          const dx = Math.sin(now * 0.021 + l.phase) * shake;
          const dy = Math.cos(now * 0.017 + l.phase * 1.3) * shake;
          g.style.transform = `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) scale(${(1 + level * (0.015 + 0.1 * l.t)).toFixed(4)})`;
          g.style.opacity = (0.88 + 0.12 * level).toFixed(3);
        });
        if (ripples.current) {
          ripples.current.style.transform = `scale(${(1 + level * 0.08).toFixed(4)})`;
          ripples.current.style.opacity = (0.55 + 0.45 * level).toFixed(3);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
      rings.current.forEach((g) => { if (g) { g.style.transform = ""; g.style.opacity = ""; } });
      if (ripples.current) { ripples.current.style.transform = ""; ripples.current.style.opacity = ""; }
    };
  }, [active, rings, ripples]);
}

export function MicHalo({ recording, onClick, liveAudio = false }: {
  recording: boolean;
  onClick: () => void;
  /** React to the live microphone level while recording. */
  liveAudio?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const { layers, core } = useMemo(() => buildHalo(recording), [recording]);
  const rings = useRef<(SVGGElement | null)[]>([]);
  const ripples = useRef<SVGGElement | null>(null);
  useMicLevel(recording && liveAudio, rings, ripples, layers);

  const morph = "x .8s ease,y .8s ease,width .8s ease,height .8s ease,rx .8s ease";
  const origin = { transformOrigin: `${CX}px ${CY}px` };

  return (
    <button type="button" className="db-mic" aria-label={recording ? "Stop recording" : "Start recording"} onClick={onClick}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, padding: 0, background: "transparent", cursor: "pointer", borderRadius: "50%" }}>
      <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 400 400" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <defs>
          <filter id={`${uid}-soft`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.7" /></filter>
          <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9" /></filter>
          <radialGradient id={`${uid}-aura`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r="200" fill={`url(#${uid}-aura)`} opacity="0.5" />
        {recording && (
          <g ref={ripples} style={origin}>
            <circle className="db-hr" cx={CX} cy={CY} r="168" fill="none" stroke="#ffffff" strokeWidth="1.6" />
            <circle className="db-hr" cx={CX} cy={CY} r="168" fill="none" stroke="#ffffff" strokeWidth="1.6" style={{ animationDelay: "-2.1s" }} />
          </g>
        )}
        <g filter={`url(#${uid}-soft)`}>
          {layers.map((l, idx) => (
            <g key={l.key} ref={(el) => { rings.current[idx] = el; }} style={origin}>
              <rect className="db-hl" x={l.x} y={l.y} width={l.w} height={l.h} rx={l.rx}
                fill={l.fill} opacity={l.opacity} stroke="rgba(255,255,255,0.3)" strokeWidth="1"
                style={{
                  "--amp": l.amp, "--amp2": l.amp2, "--dx": `${l.dx.toFixed(2)}px`, "--dy": `${l.dy.toFixed(2)}px`,
                  animationDuration: `${l.dur.toFixed(2)}s`, animationDelay: `${l.delay.toFixed(2)}s`, transition: morph,
                } as React.CSSProperties} />
            </g>
          ))}
        </g>
        <rect {...core} fill="#ffffff" opacity="0.7" filter={`url(#${uid}-glow)`} style={{ transition: morph }} />
        <rect {...core} fill="#ffffff" style={{ transition: morph }} />
        <g style={{ transition: "opacity .5s ease", opacity: recording ? 0 : 1 }}>
          <Mic x={CX - 21} y={CY - 21} size={42} color="#0a66c2" strokeWidth={2.2} />
        </g>
        <rect x="182" y="178" width="36" height="36" rx="9" fill="#0a66c2" style={{ transition: "opacity .5s ease", opacity: recording ? 1 : 0 }} />
      </svg>
    </button>
  );
}
