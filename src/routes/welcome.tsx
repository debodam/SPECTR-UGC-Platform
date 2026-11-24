import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChartNoAxesColumn, Mic, Zap, type LucideIcon } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import { useEffect } from "react";
import { isDemo } from "@/demo/mode";

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "SPECTR - Turn expertise into content" }] }),
  component: Welcome,
});

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Zap,
    title: "Transform any input.",
    body: "Paste a transcript, upload a document, or drop in your notes. SPECTR turns it into a polished article, post, or video script in seconds.",
  },
  {
    icon: Mic,
    title: "Record and transcribe.",
    body: "Speak your thoughts directly into SPECTR. Your voice is transcribed in real time and instantly ready to transform.",
  },
  {
    icon: ChartNoAxesColumn,
    title: "Track and distribute.",
    body: "Schedule your content, monitor performance, and double down on what works. All in one place.",
  },
];

const CONTACT_EMAIL = "debojeetdam.business@gmail.com";

function Welcome() {
  const navigate = useNavigate();
  const { state } = useApp();
  const tryNow = () => navigate({ to: state.isAuthenticated ? "/" : "/access" });
  // The landing page is outside the demo: only Exit demo (which turns demo mode off first) leads here.
  useEffect(() => {
    if (isDemo()) navigate({ to: "/", replace: true });
  }, [navigate]);

  return (
    <div className="au-shell lp-shell">
      <div className="lp-scroll">
        <section className="lp-hero">
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 24px rgba(6,42,92,0.25)",
              }}
            >
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
          <h1 className="lp-title">Turn expertise into content. Automatically.</h1>
          <p className="lp-lede">
            Record it, transform it, publish it. SPECTR takes your raw knowledge and turns it into
            publish-ready articles, posts, and video scripts.
          </p>
          <div className="lp-ctas" style={{ marginTop: 44 }}>
            <button type="button" className="lp-cta" onClick={tryNow}>
              Try SPECTR now
            </button>
            <a href="/demo" className="lp-cta lp-cta--ghost">
              Try the demo
            </a>
          </div>
        </section>

        <section className="lp-features">
          <h2 className="lp-h2">Everything you need to go from idea to published.</h2>
          <div className="lp-grid">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="sx-glass lp-card">
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 8px 20px rgba(6,42,92,0.2)",
                  }}
                >
                  <Icon size={26} strokeWidth={1.9} color="#0a66c2" aria-hidden="true" />
                </div>
                <div
                  style={{ marginTop: 22, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}
                >
                  {title}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 15.5,
                    lineHeight: 1.6,
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  {body}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-contact-wrap">
          <div className="sx-glass lp-contact">
            <h2 className="lp-h2" style={{ fontSize: "clamp(28px, 3.4vw, 40px)" }}>
              Ready to transform your content?
            </h2>
            <div style={{ marginTop: 14, fontSize: 16.5, color: "rgba(255,255,255,0.92)" }}>
              Have questions? Email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                style={{
                  color: "#ffffff",
                  fontWeight: 600,
                  textDecoration: "underline",
                  overflowWrap: "anywhere",
                }}
              >
                {CONTACT_EMAIL}
              </a>
            </div>
            <div style={{ marginTop: 32 }}>
              <button type="button" className="lp-cta" onClick={tryNow}>
                Try SPECTR now
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
