function SpectrMark({ size }: { size: number }) {
  return (
    <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="13" width="3.5" height="9" rx="1.2" fill="white" />
      <rect x="8" y="7" width="3.5" height="15" rx="1.2" fill="white" />
      <rect x="14" y="2" width="3.5" height="20" rx="1.2" fill="white" />
      <rect x="20" y="9" width="2" height="13" rx="1" fill="white" fillOpacity="0.55" />
    </svg>
  );
}

export function SpectrLogo({ size = 32, showTag = false }: { size?: number; showTag?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <div
          className="rounded-md flex items-center justify-center"
          style={{ width: size, height: size, background: "var(--color-primary)", boxShadow: "var(--glow-primary-sm)" }}
        >
          <SpectrMark size={size} />
        </div>
        <span className="font-bold tracking-tight" style={{ fontSize: size * 0.7, color: "var(--color-foreground)" }}>
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
