/**
 * Demo chrome and guided tour. Mounted only when demo mode is on (see __root.tsx), so the real app never loads it.
 * The tour dims the page with a spotlight cut out around its target. Only the target and the tour card take clicks.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ExternalLink, Flag, Play, RotateCcw, X } from "lucide-react";
import { DEMO_KEYS, demoEvent, exitDemo, startDemo } from "./mode";
import { TOUR, TOUR_TOTAL, type TourStep } from "./tour";
import { DEMO_END } from "./seed/recruiter.config";

type Status = "running" | "paused" | "skipped" | "closing" | "done";
interface TourState {
  i: number;
  status: Status;
}

const PAD = 10;
const BAR = 44;
/** Tour card width: a little narrower on smaller laptops so it fits beside wide sections. */
const cardWidth = () => (typeof window !== "undefined" && window.innerWidth < 1360 ? 320 : 360);

function loadTour(): TourState {
  try {
    const raw = sessionStorage.getItem(DEMO_KEYS.tour);
    if (raw) return JSON.parse(raw) as TourState;
  } catch {
    /* fresh start */
  }
  return { i: 0, status: "running" };
}

type Box = { x: number; y: number; w: number; h: number };

function rectOf(sel: string): Box | null {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
}

function union(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const bt = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: bt - y };
}

const area = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Places the card next to the spotlight, never on top of a highlighted area when any free spot exists. */
function placeCard(holes: Box[] | null, cardH: number): { left: number; top: number } {
  const CARD_W = cardWidth();
  const vw = window.innerWidth,
    vh = window.innerHeight;
  const clampY = (y: number) => Math.max(BAR + 12, Math.min(vh - cardH - 12, y));
  const clampX = (x: number) => Math.max(12, Math.min(vw - CARD_W - 12, x));
  if (!holes?.length) return { left: (vw - CARD_W) / 2, top: Math.max(BAR + 12, (vh - cardH) / 2) };
  const gap = 16;
  const all = holes.length > 1 ? [union(holes), ...holes] : holes;
  const spots: { left: number; top: number }[] = [];
  for (const h of all)
    spots.push(
      { left: clampX(h.x + h.w + gap), top: clampY(h.y) },
      { left: clampX(h.x - gap - CARD_W), top: clampY(h.y) },
      { left: clampX(h.x), top: clampY(h.y + h.h + gap) },
      { left: clampX(h.x), top: clampY(h.y - gap - cardH) },
      { left: clampX(h.x + h.w + gap), top: clampY(h.y + h.h - cardH) },
      { left: clampX(h.x - gap - CARD_W), top: clampY(h.y + h.h - cardH) },
    );
  spots.push(
    { left: vw - CARD_W - 24, top: clampY(vh - cardH - 24) },
    { left: 24, top: clampY(vh - cardH - 24) },
    { left: vw - CARD_W - 24, top: BAR + 24 },
  );
  let best = spots[0],
    bestCost = Infinity;
  for (const p of spots) {
    const c = { x: p.left - 6, y: p.top - 6, w: CARD_W + 12, h: cardH + 12 };
    const cost = holes.reduce((s, h) => s + area(c, h), 0);
    if (cost < bestCost) {
      best = p;
      bestCost = cost;
      if (cost === 0) break;
    }
  }
  return best;
}

export default function DemoLayer() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [tour, setTourState] = useState<TourState>(loadTour);
  const [holes, setHoles] = useState<Box[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [cardH, setCardH] = useState(220);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const settled = useRef(false);

  const step: TourStep | undefined = TOUR[tour.i];
  const running = tour.status === "running" && !!step;

  const setTour = useCallback((t: TourState) => {
    sessionStorage.setItem(DEMO_KEYS.tour, JSON.stringify(t));
    setTourState(t);
  }, []);

  // Banner offset for the whole app.
  useEffect(() => {
    document.documentElement.classList.add("demo-on");
    return () => document.documentElement.classList.remove("demo-on");
  }, []);

  const goTo = useCallback(
    (i: number) => {
      if (i >= TOUR.length) {
        demoEvent("tour completed");
        setTour({ i: TOUR.length - 1, status: "closing" });
        return;
      }
      demoEvent("step reached", { step: TOUR[i].id });
      setTour({ i: Math.max(0, i), status: "running" });
    },
    [setTour],
  );

  const next = useCallback(() => goTo(tour.i + 1), [goTo, tour.i]);
  const back = useCallback(() => goTo(tour.i - 1), [goTo, tour.i]);
  /** Escape pauses quietly; Skip tour asks first, then leaves the visitor to explore on their own. */
  const skip = useCallback(() => {
    demoEvent("tour paused", { step: step?.id });
    setConfirmSkip(false);
    setTour({ i: tour.i, status: "paused" });
  }, [setTour, tour.i, step?.id]);
  const exploreFreely = useCallback(() => {
    demoEvent("tour skipped", { step: step?.id });
    setConfirmSkip(false);
    setTour({ i: tour.i, status: "skipped" });
  }, [setTour, tour.i, step?.id]);
  const finish = useCallback(() => {
    demoEvent("demo finished from banner");
    setConfirmSkip(false);
    setTour({ i: tour.i, status: "closing" });
  }, [setTour, tour.i]);

  useEffect(() => setConfirmSkip(false), [tour.i]);

  const replay = useCallback(() => {
    demoEvent("tour replayed");
    startDemo();
    sessionStorage.setItem(DEMO_KEYS.tour, JSON.stringify({ i: 0, status: "running" }));
    window.location.assign("/");
  }, []);

  // Activate the step: make sure we are on its route, then find its targets.
  useEffect(() => {
    if (!running || !step) return;
    settled.current = false;
    setHoles(null);
    setMissing(false);
    let navTimer: number | undefined;
    if (window.location.pathname !== step.route) {
      // A click may already be navigating there; give it a moment before sending the visitor ourselves.
      navTimer = window.setTimeout(() => {
        if (window.location.pathname !== step.route) router.history.push(step.go ?? step.route);
      }, 900);
    }
    if (!step.targets?.length) {
      settled.current = window.location.pathname === step.route;
      return () => window.clearTimeout(navTimer);
    }
    const started = Date.now();
    const poll = window.setInterval(() => {
      if (window.location.pathname !== step.route) return;
      const first = document.querySelector(step.targets![0]);
      if (first) {
        const r = first.getBoundingClientRect();
        if (r.top < BAR || r.bottom > window.innerHeight)
          first.scrollIntoView({ block: "center", behavior: "smooth" });
        settled.current = true;
        window.clearInterval(poll);
        window.setTimeout(() => {
          const boxes = step.targets!.map(rectOf).filter(Boolean) as Box[];
          setHoles(boxes.length ? boxes : null);
          const focusEl = step.click ? document.querySelector<HTMLElement>(step.click) : null;
          if (step.advance === "button") primaryRef.current?.focus({ preventScroll: true });
          else (focusEl ?? (first as HTMLElement)).focus?.({ preventScroll: true });
        }, 350);
      } else if (Date.now() - started > 7000) {
        window.clearInterval(poll);
        settled.current = true;
        setMissing(true);
      }
    }, 150);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(navTimer);
    };
  }, [running, step, router]);

  // Keep the spotlight on its target as the page moves (scrolling, streaming text, resizing).
  useEffect(() => {
    if (!running || !step?.targets?.length) return;
    const update = () => {
      if (!settled.current) return;
      const boxes = step.targets!.map(rectOf).filter(Boolean) as Box[];
      setHoles(boxes.length ? boxes : null);
    };
    const iv = window.setInterval(update, 200);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("resize", update);
    };
  }, [running, step]);

  // Advance when the visitor clicks the highlighted element.
  useEffect(() => {
    if (!running || step?.advance !== "click") return;
    const sel = step.click ?? step.targets?.[0];
    if (!sel) return;
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.(sel)) window.setTimeout(next, 60);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [running, step, next]);

  // Advance when a condition is met.
  useEffect(() => {
    if (!running || step?.advance !== "wait" || !step.done) return;
    const iv = window.setInterval(() => {
      if (step.done!()) next();
    }, 250);
    return () => window.clearInterval(iv);
  }, [running, step, next]);

  // Leaving the step's page pauses the tour and offers a Resume chip.
  useEffect(() => {
    if (running && step && settled.current && pathname !== step.route) {
      demoEvent("tour paused", { step: step.id, at: pathname });
      setTour({ i: tour.i, status: "paused" });
    }
  }, [pathname, running, step, tour.i, setTour]);

  // Keyboard: arrows move, Escape pauses, Enter continues.
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest?.("input, textarea, select");
      if (e.key === "Escape") {
        e.preventDefault();
        skip();
      } else if (typing) {
        return;
      } else if (e.key === "ArrowRight" && step?.advance === "button") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" && tour.i > 0) {
        e.preventDefault();
        back();
      } else if (
        e.key === "Enter" &&
        step?.advance === "button" &&
        document.activeElement === document.body
      ) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, step, tour.i, next, back, skip]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [tour.i, tour.status, holes, missing]);

  const vw = typeof window === "undefined" ? 1440 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  const waitingForTarget = running && !!step?.targets?.length && !holes && !missing;
  const holeKey = (holes ?? [])
    .map((b) => `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.w)},${Math.round(b.h)}`)
    .join("|");
  const pos = useMemo(() => placeCard(holes, cardH), [holeKey, cardH]); // eslint-disable-line react-hooks/exhaustive-deps

  const path = useMemo(() => {
    const outer = `M0 0H${vw}V${vh}H0Z`;
    const cut = (holes ?? []).map((b) => `M${b.x} ${b.y}h${b.w}v${b.h}h${-b.w}Z`).join("");
    return outer + cut;
  }, [holes, vw, vh]);

  const body = step ? (Array.isArray(step.body) ? step.body : [step.body]) : [];

  return (
    <>
      <div className="demo-bar" role="region" aria-label="Demo mode">
        <span className="demo-bar-msg">
          <strong>Demo mode.</strong> Nothing here is saved.
        </span>
        <span className="demo-bar-actions">
          <button type="button" onClick={replay}>
            <RotateCcw size={14} aria-hidden="true" />
            Replay tour
          </button>
          <button type="button" onClick={finish}>
            <Flag size={14} aria-hidden="true" />
            Finish demo
          </button>
          <button type="button" onClick={() => exitDemo()}>
            <X size={14} aria-hidden="true" />
            Exit demo
          </button>
        </span>
        <a
          className="demo-bar-credit"
          href={DEMO_END.primaryUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {DEMO_END.footerLabel}
        </a>
      </div>

      {running && step && (
        <div className="demo-tour" aria-live="polite">
          <svg className="demo-dim" width={vw} height={vh} aria-hidden="true">
            <path d={path} fillRule="evenodd" />
          </svg>
          {/* Explanation steps: the spotlight is visible but not clickable, so the tour stays in control. */}
          {step.advance === "button" &&
            holes?.map((b, k) => (
              <div
                key={k}
                className="demo-hole-block"
                style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
              />
            ))}
          {holes?.map((b, k) => (
            <div
              key={`r${k}`}
              className="demo-ring"
              style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
            />
          ))}
          {!waitingForTarget && (
            <div
              ref={cardRef}
              className="demo-card"
              data-step={step.id}
              data-advance={missing ? "button" : step.advance}
              data-click={step.click ?? step.targets?.[0] ?? ""}
              role="dialog"
              aria-modal="false"
              aria-labelledby="demo-card-title"
              style={{ left: pos.left, top: pos.top, width: cardWidth() }}
            >
              <div className="demo-card-top">
                <span className="demo-card-step">
                  Step {step.num} of {TOUR_TOTAL}
                </span>
                <button
                  type="button"
                  className="demo-card-skip"
                  onClick={() => setConfirmSkip(true)}
                >
                  Skip tour
                </button>
              </div>
              <div className="demo-progress" aria-hidden="true">
                <span style={{ width: `${(step.num / TOUR_TOTAL) * 100}%` }} />
              </div>
              <h2 id="demo-card-title" className="demo-card-title">
                {step.title}
              </h2>
              {body.map((p, k) => (
                <p key={k} className="demo-card-body">
                  {p}
                </p>
              ))}
              {missing && step.advance !== "button" && (
                <p className="demo-card-body demo-card-note">
                  This part of the page is not showing right now. Continue with Next.
                </p>
              )}
              {confirmSkip ? (
                <div className="demo-card-confirm" role="group" aria-label="Skip the tour">
                  <p className="demo-card-body">
                    Explore on your own? Generation uses sample outputs.
                  </p>
                  <div className="demo-card-actions">
                    <button
                      type="button"
                      className="gh-btn gh-btn--ghost gh-btn--small"
                      onClick={() => setConfirmSkip(false)}
                    >
                      Keep the tour
                    </button>
                    <button
                      type="button"
                      className="gh-btn gh-btn--primary gh-btn--small"
                      autoFocus
                      onClick={exploreFreely}
                    >
                      Explore
                    </button>
                  </div>
                </div>
              ) : (
                <div className="demo-card-actions">
                  {tour.i > 0 ? (
                    <button
                      type="button"
                      className="gh-btn gh-btn--ghost gh-btn--small"
                      onClick={back}
                    >
                      <ArrowLeft size={14} aria-hidden="true" />
                      Back
                    </button>
                  ) : (
                    <span />
                  )}
                  {step.advance === "button" || missing ? (
                    <button
                      ref={primaryRef}
                      type="button"
                      className="gh-btn gh-btn--primary gh-btn--small"
                      onClick={next}
                    >
                      {step.nextLabel ?? "Next"}
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="demo-card-hint">
                      {step.advance === "wait" ? "Waiting for you" : "Click the highlighted button"}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(tour.status === "paused" || tour.status === "skipped" || tour.status === "done") && (
        <button
          type="button"
          className="demo-resume"
          onClick={() => {
            demoEvent("tour resumed", { step: step?.id });
            setTour({ i: tour.i, status: "running" });
          }}
        >
          <Play size={14} aria-hidden="true" />
          Resume tour
        </button>
      )}

      {tour.status === "closing" && (
        <div className="demo-end-wrap">
          <div
            className="demo-end"
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-end-title"
          >
            <h2 id="demo-end-title">{DEMO_END.title}</h2>
            <p>{DEMO_END.body}</p>
            <a
              className="gh-btn gh-btn--primary demo-end-primary"
              href={DEMO_END.primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              autoFocus
              onClick={() => demoEvent("closing link opened")}
            >
              {DEMO_END.primaryLabel}
              <ExternalLink size={15} aria-hidden="true" />
            </a>
            <div className="demo-end-row">
              <button type="button" className="gh-btn gh-btn--ghost" onClick={replay}>
                Replay the tour
              </button>
              <button type="button" className="gh-btn gh-btn--ghost" onClick={() => exitDemo()}>
                Exit demo
              </button>
            </div>
            <button
              type="button"
              className="demo-end-close"
              onClick={() => setTour({ i: tour.i, status: "done" })}
            >
              Keep exploring the demo
            </button>
          </div>
        </div>
      )}
    </>
  );
}
