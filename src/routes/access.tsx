import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/access")({ component: AccessPage });

const ACCESS_CODE = "071704";
const LS_KEY = "spectr-access-verified";

function AccessPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (localStorage.getItem(LS_KEY) === "true") { navigate({ to: "/login" }); return; }
    setTimeout(() => inputRef.current?.focus(), 120);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [navigate]);

  const handleComplete = (c: string) => {
    setStatus("verifying");
    timerRef.current = setTimeout(() => {
      if (c === ACCESS_CODE) {
        localStorage.setItem(LS_KEY, "true");
        navigate({ to: "/login" });
      } else {
        setStatus("error");
        setShaking(true);
        setTimeout(() => setShaking(false), 400);
        setCode("");
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }, 900);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (status === "error") setStatus("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    setCode(v);
    if (v.length === 6) handleComplete(v);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (!pasted) return;
    if (status === "error") setStatus("idle");
    setCode(pasted);
    if (pasted.length === 6) handleComplete(pasted);
  };

  const isErr = status === "error";
  const isVerifying = status === "verifying";
  const activeIdx = isVerifying || isErr ? -1 : Math.min(code.length, 5);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div style={{
        width: 640, boxSizing: "border-box", padding: "48px 48px 44px",
        borderRadius: 36, background: "rgba(255,255,255,0.16)",
        border: "1px solid rgba(255,255,255,0.4)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 10px 30px rgba(6,42,92,0.14)", textAlign: "center",
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 24px rgba(6,42,92,0.25)" }}>
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24">
              <polygon points="12,3 21,21 12,21" fill="#0a66c2" />
              <polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55" />
            </svg>
          </div>
          <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em" }}>SPECTR</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 15, color: "rgba(255,255,255,0.88)" }}>
          Content Transformation Engine
        </div>

        <h1 style={{ margin: "40px 0 0", fontSize: 34, fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          To access the platform, you must have an access code.
        </h1>
        <div style={{ marginTop: 12, fontSize: 16, color: "rgba(255,255,255,0.9)" }}>
          Have an access code? Enter it below.
        </div>

        {/* OTP boxes */}
        <div style={{ position: "relative", margin: "34px auto 0", width: 492, height: 80 }}>
          <div className={shaking ? "spectr-shake" : ""} style={{ display: "flex", gap: 12 }}>
            {[0,1,2,3,4,5].map((i) => {
              const ch = code[i] || "";
              const isActive = i === activeIdx && !ch;
              return (
                <div key={i} style={{
                  width: 72, height: 80, borderRadius: 18, boxSizing: "border-box",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 32, fontWeight: 300, flexShrink: 0,
                  transition: "all 0.15s ease",
                  background: `rgba(255,255,255,${ch ? 0.26 : 0.16})`,
                  border: `1.5px solid ${isErr ? "#ffb4ab" : i === activeIdx ? "#ffffff" : "rgba(255,255,255,0.4)"}`,
                  boxShadow: (i === activeIdx && !isErr) ? "0 0 0 4px rgba(255,255,255,0.28)" : isErr ? "0 0 0 4px rgba(217,45,32,0.28)" : "none",
                  color: "#ffffff",
                }}>
                  {ch}
                  {isActive && <span className="spectr-blink" style={{ width: 2, height: 32, background: "#ffffff", borderRadius: 1, display: "inline-block" }} />}
                </div>
              );
            })}
          </div>
          <input
            ref={inputRef}
            aria-label="Access code"
            type="text"
            maxLength={6}
            autoComplete="off"
            value={code}
            onChange={handleInput}
            onPaste={handlePaste}
            disabled={isVerifying}
            style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", opacity: 0, cursor: "text", border: 0, background: "transparent" }}
          />
        </div>

        {/* Status line */}
        <div style={{ marginTop: 22, height: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 14.5 }}>
          {isVerifying && (
            <>
              <svg className="spectr-spin" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round">
                <path d="M12 3a9 9 0 1 0 9 9" opacity="0.95" />
              </svg>
              <span>Checking your code</span>
            </>
          )}
          {isErr && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              height: 30, padding: "0 14px", borderRadius: 999,
              background: "#fef3f2", color: "#b42318", fontWeight: 600,
            }}>
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16.5h.01" />
              </svg>
              That code is not valid. Check it and try again.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
