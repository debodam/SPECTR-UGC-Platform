// Layered wavy-ring glow used behind the mic / record controls across SPECTR.
// Pure decoration: callers position their own content (button, icon) on top.

const BLOB =
  "M210,45 C262,50 304,76 330,118 C356,160 361,202 350,244 C339,286 307,322 265,342 C223,362 179,362 140,346 C101,330 69,298 52,256 C35,214 38,166 64,128 C90,90 142,40 210,45 Z";

export function OrbRings({ size = 420, accent = "#0a66c2" }: { size?: number; accent?: string }) {
  const gradA = `spcRingA-${size}`;
  const gradB = `spcRingB-${size}`;
  const glow = `spcGlow-${size}`;

  return (
    <svg width={size} height={size} viewBox="0 0 420 420" fill="none" style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.3" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={gradA} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4fc3f7" />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
        <linearGradient id={gradB} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor="#7cd4ff" />
        </linearGradient>
      </defs>

      <circle cx="210" cy="210" r="208" fill={`url(#${glow})`} />
      <circle cx="210" cy="210" r="195" stroke="#1c1c1c" strokeWidth="1" opacity="0.6" />
      <circle cx="210" cy="210" r="165" stroke="#1c1c1c" strokeWidth="1" opacity="0.5" />

      <path d={BLOB} stroke={`url(#${gradA})`} strokeWidth="1.6" opacity="0.85" fill="none" />
      <path
        d={BLOB}
        stroke={`url(#${gradB})`}
        strokeWidth="1.2"
        opacity="0.6"
        fill="none"
        transform="rotate(42 210 210) scale(0.93)"
        style={{ transformOrigin: "210px 210px" }}
      />
      <path
        d={BLOB}
        stroke={`url(#${gradA})`}
        strokeWidth="1"
        opacity="0.4"
        fill="none"
        transform="rotate(-38 210 210) scale(1.04)"
        style={{ transformOrigin: "210px 210px" }}
      />
      <path
        d={BLOB}
        stroke={`url(#${gradB})`}
        strokeWidth="1"
        opacity="0.3"
        fill="none"
        transform="rotate(95 210 210) scale(0.86)"
        style={{ transformOrigin: "210px 210px" }}
      />
    </svg>
  );
}

export function OrbWaveform({ accent = "#0a66c2" }: { accent?: string }) {
  const id = "spcWave";
  return (
    <svg width="420" height="420" viewBox="0 0 420 420" fill="none" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4fc3f7" />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
      </defs>
      <path
        d="M10,212 Q50,195 80,212 T140,212 Q165,180 185,212 T235,212 Q255,240 280,212 T340,212 Q365,195 410,212"
        stroke={`url(#${id})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
    </svg>
  );
}
