export function SpectrLogo({ size = 32, showTag = false }: { size?: number; showTag?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <div
          className="rounded-md flex items-center justify-center font-bold text-white"
          style={{ width: size, height: size, background: "var(--color-primary)", fontSize: size * 0.5, boxShadow: "var(--glow-primary-sm)" }}
        >
          S
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
