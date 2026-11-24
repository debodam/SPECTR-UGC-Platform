import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/spectr-store";
import { isDemo } from "@/demo/mode";

/** Real captures of the demo (Fastbreak AI data). Regenerate with `npm run shots:landing`. */
const SHOTS = [
  {
    key: "dashboard",
    label: "Dashboard",
    alt: "SPECTR Dashboard: a growth plan card with this week's plays, LinkedIn impressions, 12 week goal progress and posts ready to publish",
  },
  {
    key: "record",
    label: "Record",
    alt: "SPECTR Record screen: a recording in progress with the live transcript filling in next to the play's guided prompts",
  },
  {
    key: "transform",
    label: "Transform",
    alt: "SPECTR Transform screen: one recording turned into an article, with tabs for posts and a video script",
  },
  {
    key: "growth",
    label: "Growth",
    alt: "SPECTR Growth plan page: north star metric, forecast, content pillars and weekly cadence",
  },
] as const;
const SRC = (key: string) => `/landing/${key}.webp`;
const ADVANCE_MS = 4000;
/** Social cards need absolute image URLs. */
const SITE_URL = "https://tryspectr.online";
const DESCRIPTION =
  "Record it, transform it, publish it. SPECTR turns raw knowledge into articles, posts and video scripts. Try the 2 minute guided demo.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SPECTR - Turn expertise into content" },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "SPECTR" },
      { property: "og:title", content: "SPECTR - Turn expertise into content. Automatically." },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/landing/dashboard.webp` },
      { property: "og:image:width", content: "1600" },
      { property: "og:image:height", content: "1000" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SPECTR - Turn expertise into content. Automatically." },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: `${SITE_URL}/landing/dashboard.webp` },
    ],
    links: [{ rel: "preload", as: "image", href: SRC("dashboard"), type: "image/webp" }],
  }),
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const { state } = useApp();
  // Open app keeps the existing entry flow: the app if signed in, otherwise the access code page.
  const openApp = () => navigate({ to: state.isAuthenticated ? "/dashboard" : "/access" });

  // The landing page is outside the demo: only Exit demo (which turns demo mode off first) leads here.
  useEffect(() => {
    if (isDemo()) navigate({ to: "/dashboard", replace: true });
  }, [navigate]);

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  // The first shot is preloaded; the other three load after the first paint.
  const [restReady, setRestReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const raf = requestAnimationFrame(() => setRestReady(true));
    return () => {
      mq.removeEventListener("change", sync);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (paused || reduced || !restReady) return;
    const t = window.setInterval(() => setActive((i) => (i + 1) % SHOTS.length), ADVANCE_MS);
    return () => window.clearInterval(t);
  }, [paused, reduced, restReady]);

  const pick = (i: number) => {
    setActive(i);
    setPaused(true); // a choice stops the slideshow for the rest of the visit
  };

  return (
    <div className={`ld${reduced ? " ld--still" : ""}`}>
      <header className="ld-top">
        <div className="ld-brand">
          <span className="ld-logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <polygon points="12,3 21,21 12,21" fill="#0a66c2" />
              <polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55" />
            </svg>
          </span>
          <span className="ld-wordmark">SPECTR</span>
        </div>
        <a
          className="ld-credit"
          href="https://debodam.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Built by Debojeet Dam
        </a>
      </header>

      <main className="ld-main">
        <section className="ld-copy">
          <h1 className="ld-title">Turn expertise into content. Automatically.</h1>
          <p className="ld-sub">
            Record it, transform it, publish it. SPECTR turns raw knowledge into articles, posts and
            video scripts.
          </p>
          <div className="ld-ctas">
            <a href="/demo" className="ld-btn ld-btn--primary">
              Try the demo
            </a>
            <button type="button" className="ld-btn ld-btn--ghost" onClick={openApp}>
              Open app
            </button>
          </div>
          <p className="ld-trust">2 min guided tour. No signup. Fake data, nothing saved.</p>
        </section>

        <section className="ld-show" aria-label="Product screenshots">
          <div className="ld-frame">
            <div className="ld-frame-bar" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="ld-shots">
              {SHOTS.map((s, i) =>
                i === 0 || restReady ? (
                  <img
                    key={s.key}
                    src={SRC(s.key)}
                    alt={s.alt}
                    width={1600}
                    height={1000}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    fetchPriority={i === 0 ? "high" : "low"}
                    className={`ld-shot${i === active ? " is-on" : ""}`}
                    aria-hidden={i !== active}
                  />
                ) : null,
              )}
            </div>
          </div>
          <div className="ld-pills" role="group" aria-label="Choose a screen">
            {SHOTS.map((s, i) => (
              <button
                key={s.key}
                type="button"
                className={`ld-pill${i === active ? " is-on" : ""}`}
                aria-pressed={i === active}
                onClick={() => pick(i)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
