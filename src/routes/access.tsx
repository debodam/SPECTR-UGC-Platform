import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SpectrLogo } from "@/components/spectr/Logo";

export const Route = createFileRoute("/access")({ component: AccessPage });

const ACCESS_CODE = "071704";
const LS_KEY = "spectr-access-verified";

function AccessPage() {
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  useEffect(() => {
    if (localStorage.getItem(LS_KEY) === "true") {
      navigate({ to: "/login" });
      return;
    }
    setTimeout(() => inputRefs.current[0]?.focus(), 120);
  }, [navigate]);

  const handleComplete = (code: string) => {
    if (code === ACCESS_CODE) {
      localStorage.setItem(LS_KEY, "true");
      navigate({ to: "/login" });
    } else {
      setError(true);
      setDigits(Array(6).fill(""));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  };

  const handleChange = (i: number, val: string) => {
    if (error) setError(false);
    const d = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) inputRefs.current[i + 1]?.focus();
    if (next.every((v) => v !== "")) handleComplete(next.join(""));
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    setError(false);
    const next = Array(6).fill("") as string[];
    pasted.split("").forEach((c, idx) => { next[idx] = c; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    if (next.every((v) => v !== "")) handleComplete(next.join(""));
  };

  const boxStyle = (i: number): React.CSSProperties => {
    let borderColor = "var(--color-border)";
    let boxShadow = "none";
    if (error) {
      borderColor = "var(--color-destructive)";
      boxShadow = "0 0 0 3px rgba(220,38,38,0.2)";
    } else if (focused === i) {
      borderColor = "var(--color-primary)";
      boxShadow = "var(--glow-primary-sm)";
    } else if (digits[i]) {
      borderColor = "var(--color-border)";
    }
    return {
      width: 54,
      height: 68,
      borderRadius: 14,
      border: `1.5px solid ${borderColor}`,
      background: "var(--color-card-2)",
      color: "var(--color-foreground)",
      fontSize: 28,
      fontWeight: 700,
      textAlign: "center",
      outline: "none",
      transition: "border-color 0.15s, box-shadow 0.15s",
      caretColor: "transparent",
      fontFamily: "var(--font-sans)",
      letterSpacing: 0,
      boxShadow,
    };
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="flex flex-col items-center text-center" style={{ maxWidth: 480 }}>
        <div className="mb-8">
          <SpectrLogo size={44} showTag />
        </div>

        <h1
          className="font-bold mb-3"
          style={{ fontSize: 22, lineHeight: 1.4, letterSpacing: "-0.02em" }}
        >
          To access the platform, you must have an access code.
        </h1>
        <p className="mb-8 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Have an access code? Enter it below.
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              value={d}
              maxLength={1}
              inputMode="numeric"
              autoComplete="off"
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              onFocus={() => setFocused(i)}
              onBlur={() => setFocused(null)}
              style={boxStyle(i)}
            />
          ))}
        </div>

        {error && (
          <p className="mt-4 text-sm font-semibold" style={{ color: "var(--color-destructive)" }}>
            Invalid access code.
          </p>
        )}
      </div>
    </div>
  );
}
