import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BarChart2, Mic, Zap } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import { SpectrLogo } from "@/components/spectr/Logo";

export const Route = createFileRoute("/")({ component: LandingPage });

function GlowButton({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="landing-glow-btn"
    >
      {children}
    </Link>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="landing-feature-card">
      <div className="landing-feature-icon">{icon}</div>
      <div>
        <h3 className="font-bold text-base text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{body}</p>
      </div>
    </div>
  );
}

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

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-24 pb-20">
        <SpectrLogo size={44} showTag />

        <h1 className="landing-hero-headline">
          Turn Expertise Into Content.{" "}
          <span style={{ color: "var(--color-primary)" }}>Automatically.</span>
        </h1>

        <p className="mt-6 text-lg font-normal max-w-xl leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          Record it, transform it, publish it. SPECTR takes your raw knowledge and turns it into publish-ready articles, posts, and video scripts.
        </p>

        <div className="mt-10">
          <GlowButton to="/access">Try SPECTR Now</GlowButton>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 pb-28 flex flex-col items-center">
        <h2 className="text-2xl font-bold text-center mb-10 tracking-tight">
          Everything you need to go from idea to published.
        </h2>

        <div className="landing-features-grid">
          <FeatureCard
            icon={<Zap size={20} />}
            title="Transform Any Input."
            body="Paste a transcript, upload a document, or drop in your notes. SPECTR turns it into a polished article, post, or video script in seconds."
          />
          <FeatureCard
            icon={<Mic size={20} />}
            title="Record and Transcribe."
            body="Speak your thoughts directly into SPECTR. Your voice is transcribed in real time and instantly ready to transform."
          />
          <FeatureCard
            icon={<BarChart2 size={20} />}
            title="Track and Distribute."
            body="Schedule your content, monitor performance, and double down on what works. All in one place."
          />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 pb-32 flex flex-col items-center text-center">
        <div className="landing-cta-card">
          <h2 className="text-3xl font-bold tracking-tight">Ready to transform your content?</h2>
          <p className="mt-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Have questions? Email{" "}
            <a
              href="mailto:debojeetdam.business@gmail.com"
              className="font-semibold"
              style={{ color: "var(--color-primary)" }}
            >
              debojeetdam.business@gmail.com
            </a>
          </p>
          <div className="mt-8">
            <GlowButton to="/access">Try SPECTR Now</GlowButton>
          </div>
        </div>
      </section>

    </div>
  );
}
