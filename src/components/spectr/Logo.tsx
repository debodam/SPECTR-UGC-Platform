function SpectrMark({ size }: { size: number }) {
  return (
    <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
      {/* Left face — shadow side */}
      <path d="M12 2L2 20H12V2Z" fill="white" fillOpacity="0.45" />
      {/* Right face — lit side */}
      <path d="M12 2L22 20H12V2Z" fill="white" fillOpacity="0.95" />
      {/* Ridge */}
      <line x1="12" y1="2" x2="12" y2="20" stroke="white" strokeWidth="0.5" strokeOpacity="0.7" />
    </svg>
  );
}

export function SpectrLogo({ size = 32, showTag = false }: { size?: number; showTag?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <div
          className="rounded-md flex items-center justify-center"
          style={{
            width: size,
            height: size,
            background: "var(--color-primary)",
            boxShadow: "var(--glow-primary-sm)",
          }}
        >
          <SpectrMark size={size} />
        </div>
        <span
          className="font-bold tracking-tight"
          style={{ fontSize: size * 0.7, color: "var(--color-foreground)" }}
        >
          SPECTR
        </span>
      </div>
      {showTag && (
        <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
          Content Transformation Engine
        </span>
      )}
    </div>
  );
}
