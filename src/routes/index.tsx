import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Mic, MessageCircle } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import { SpectrLogo } from "@/components/spectr/Logo";
import { OrbRings, OrbWaveform } from "@/components/spectr/Orb";

export const Route = createFileRoute("/")({ component: LandingPage });

const FORMATS = [
  { title: "LinkedIn Post", body: "Turns a recorded call into a post written the way you talk." },
  { title: "Article", body: "Expands one idea into a structured, publish-ready piece." },
  { title: "Video Script", body: "Storyboards your talking points into a script you can shoot same day." },
  { title: "Thread", body: "Breaks one insight into a multi-post thread, ready to queue." },
];

const STEPS = [
  { n: "01", title: "Record", body: "Speak your thoughts directly into SPECTR. Your voice is transcribed in real time." },
  { n: "02", title: "Transform", body: "Paste a transcript, upload a document, or use what you just recorded. SPECTR turns it into a polished draft in seconds." },
  { n: "03", title: "Publish", body: "Schedule your content, monitor performance, and double down on what works. All in one place." },
];

function LandingPage() {
  const { state } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.authLoading) return;
    if (state.isAuthenticated) {
      if (state.setupComplete && state.workspace?.companyId) {
        navigate({ to: "/transform" });
      } else {
        navigate({ to: "/companies" });
      }
    }
  }, [state.authLoading, state.isAuthenticated, state.setupComplete, navigate]);

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Nav ── */}
      <div className="flex items-center justify-between px-6 sm:px-14 py-7 flex-wrap gap-4">
        <SpectrLogo size={30} />
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wide" style={{ color: "#e5e5e5" }}>
            MENU
            <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs" style={{ border: "1px solid #333" }}>+</span>
          </div>
          <Link
            to="/access"
            className="inline-flex items-center justify-center font-bold text-xs tracking-widest px-5 py-2.5 rounded-full"
            style={{ border: "1px solid var(--color-primary)", boxShadow: "0 0 16px rgba(10,102,194,0.35)" }}
          >
            GET IN TOUCH
          </Link>
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="flex items-center justify-between gap-8 px-6 sm:px-14 pt-6 pb-24 flex-1 flex-col lg:flex-row">

        {/* Left: headline */}
        <div className="flex-1 min-w-0 max-w-[480px]">
          <h1 className="spectr-display" style={{ fontSize: "clamp(2.4rem, 4.2vw, 3.6rem)" }}>
            Turn your<br />voice into<br />content,<br />automatically.
          </h1>
          <p className="mt-8 text-xs leading-loose tracking-wide uppercase max-w-[400px]" style={{ color: "#8a8a8f" }}>
            SPECTR listens to what you record and turns it straight into publish-ready posts, articles and scripts. Backed by a transform engine built on your own voice, SPECTR keeps every output on-brand, fast to review and ready to send out across every channel you write for.
          </p>
        </div>

        {/* Center: orb */}
        <div className="flex-none flex flex-col items-center gap-5 w-[400px] max-w-[85vw]">
          <div className="spectr-orb-wrap" style={{ width: "100%" }}>
            <OrbRings size={420} />
            <OrbWaveform />
            <svg width="420" height="420" viewBox="0 0 420 420" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <g stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.85">
                <line x1="178" y1="150" x2="178" y2="158" />
                <line x1="188" y1="144" x2="188" y2="164" />
                <line x1="198" y1="148" x2="198" y2="160" />
                <line x1="208" y1="140" x2="208" y2="168" />
                <line x1="218" y1="148" x2="218" y2="160" />
                <line x1="228" y1="144" x2="228" y2="164" />
                <line x1="238" y1="150" x2="238" y2="158" />
              </g>
            </svg>
            <Link
              to="/access"
              className="absolute flex items-center justify-center rounded-full"
              style={{
                left: "50%", top: "246px", transform: "translate(-50%, -50%)",
                width: 52, height: 52, background: "var(--color-primary)",
                boxShadow: "var(--glow-primary)",
              }}
            >
              <Mic size={22} color="white" />
            </Link>
          </div>

          <p className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>Speak. SPECTR writes it up.</p>

          <Link
            to="/access"
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", boxShadow: "0 0 14px rgba(10,102,194,0.18)" }}
          >
            <MessageCircle size={17} style={{ color: "var(--color-primary)" }} />
          </Link>
        </div>

        {/* Right: output rail */}
        <div className="flex-none flex flex-col w-[230px]">
          <div className="text-xs font-extrabold tracking-wide mb-4">SPECTR for</div>
          <div className="h-px w-full mb-3" style={{ background: "var(--color-border)" }} />
          {FORMATS.map((f, i) => (
            <div key={f.title} className="pb-4 mb-4" style={{ borderBottom: i < FORMATS.length - 1 ? "1px solid #1c1c1c" : "none" }}>
              <div className="text-xs font-extrabold tracking-wide mb-1.5">{f.title.toUpperCase()}</div>
              <p className="text-xs leading-relaxed" style={{ color: "#8a8a8f" }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-6 sm:px-14 pb-24" style={{ borderTop: "1px solid var(--color-border)" }}>
        <h2 className="spectr-display mt-10 mb-12" style={{ fontSize: "clamp(1.5rem, 2.2vw, 2rem)" }}>
          From raw thought to published post.
        </h2>
        <div className="flex flex-col md:flex-row gap-10">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex-1 pl-6" style={{ borderLeft: `2px solid ${i === 0 ? "var(--color-primary)" : "var(--color-border)"}` }}>
              <div className="spectr-display" style={{ fontSize: 38, color: "var(--color-primary)" }}>{s.n}</div>
              <div className="mt-3 font-bold text-sm">{s.title}</div>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 pb-28 flex flex-col items-center text-center">
        <div className="landing-cta-card">
          <h2 className="spectr-display" style={{ fontSize: 26 }}>Ready to transform your content?</h2>
          <p className="mt-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Have questions? Email{" "}
            <a href="mailto:debojeetdam.business@gmail.com" className="font-semibold" style={{ color: "var(--color-primary)" }}>
              debojeetdam.business@gmail.com
            </a>
          </p>
          <div className="mt-8">
            <Link to="/access" className="landing-glow-btn">Try SPECTR Now</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
