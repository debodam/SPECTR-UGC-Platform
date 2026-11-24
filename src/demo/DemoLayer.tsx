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
/** Corner radius of the spotlight; matches .demo-ring in styles.css. */
const RING_RADIUS = 18;
/** Space kept between the card and the viewport edges, and between the card and the spotlight. */
const MARGIN = 16;
const GAP = 14;
/** Room kept free below a scrolled target. */
const BOTTOM_PAD = 24;

/** Height of the demo banner, read from the same CSS variable the layout uses. */
const bannerH = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--demo-banner-h")) || 44;

/** Tour card width: narrower on smaller laptops, and never wider than the viewport allows. */
const cardWidth = () => {
  if (typeof window === "undefined") return 360;
  const w = window.innerWidth;
  return Math.min(w < 1360 ? 320 : 360, w - MARGIN * 2);
};

function loadTour(): TourState {
  try {
    const raw = sessionStorage.getItem(DEMO_KEYS.tour);
    if (raw) return JSON.parse(raw) as TourState;
  } catch {
    /* fresh start */
  }
  return { i: 0, status: "running" };
}

export type Box = { x: number; y: number; w: number; h: number };

const toBox = (r: DOMRect): Box => ({ x: r.left, y: r.top, w: r.width, h: r.height });

function intersect(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w),
    bt = Math.min(a.y + a.h, b.y + b.h);
  return r > x && bt > y ? { x, y, w: r - x, h: bt - y } : null;
}

function union(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const bt = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: bt - y };
}

const area = (a: Box, b: Box) => {
  const i = intersect(a, b);
  return i ? i.w * i.h : 0;
};

const isScroller = (el: Element) => {
  const o = getComputedStyle(el).overflowY;
  return (o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight + 1;
};

/** The part of the screen where a target can be seen: below the banner, inside every scrolling ancestor. */
function visibleArea(el: Element): Box {
  let box: Box = { x: 0, y: bannerH(), w: window.innerWidth, h: window.innerHeight - bannerH() };
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p);
    if (/(auto|scroll|hidden|clip)/.test(o.overflowY + o.overflowX)) {
      const i = intersect(box, toBox(p.getBoundingClientRect()));
      if (i) box = i;
    }
  }
  return box;
}

/** The spotlight for one target: padded, then clipped to what can actually be seen. */
function holeOf(sel: string): Box | null {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  const padded = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
  const vis = visibleArea(el);
  // Allow the padding to sit just outside a clipping container, but never off screen or under the banner.
  const screen = {
    x: 4,
    y: bannerH() + 4,
    w: window.innerWidth - 8,
    h: window.innerHeight - bannerH() - 8,
  };
  const grown = { x: vis.x - PAD, y: vis.y - PAD, w: vis.w + PAD * 2, h: vis.h + PAD * 2 };
  const clip = intersect(grown, screen) ?? screen;
  return intersect(padded, clip);
}

/**
 * Scrolls the first target to the middle of the space between the banner and a bottom margin, in every
 * scrolling ancestor. A target taller than that space is aligned to its top instead. Returns true if it moved.
 */
function bringIntoView(el: Element): boolean {
  let moved = false;
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (!isScroller(p)) continue;
    const r = el.getBoundingClientRect();
    const pr = p.getBoundingClientRect();
    const top = Math.max(pr.top, bannerH()) + MARGIN;
    const bottom = Math.min(pr.bottom, window.innerHeight) - BOTTOM_PAD;
    if (r.top >= top && r.bottom <= bottom) continue;
    const room = bottom - top;
    // Fits with the margins: center it there. Fits the area only without them: center in the whole area.
    // Taller than the area: align its top, and the spotlight shows the visible part.
    const areaTop = Math.max(pr.top, bannerH());
    const areaBottom = Math.min(pr.bottom, window.innerHeight);
    const delta =
      r.height <= room
        ? r.top + r.height / 2 - (top + bottom) / 2
        : r.height <= areaBottom - areaTop
          ? r.top + r.height / 2 - (areaTop + areaBottom) / 2
          : r.top - top;
    const before = p.scrollTop;
    p.scrollTop = before + delta;
    if (p.scrollTop !== before) moved = true;
  }
  return moved;
}

type Placement = "right" | "left" | "bottom" | "top" | "dock";

/**
 * Chooses where the card goes. Every candidate is clamped inside the viewport (16px margin, below the banner),
 * then scored: covering a spotlight costs the most, covering the step's "avoid" elements costs less, and among
 * free spots the one beside the spotlight with the most room wins. If nothing is free, the card docks at the
 * bottom center (or the top center if that is freer).
 */
export function placeCard(
  holes: Box[] | null,
  avoid: Box[],
  cardW: number,
  cardH: number,
): { left: number; top: number; placement: Placement } {
  const vw = window.innerWidth,
    vh = window.innerHeight;
  const minX = MARGIN,
    maxX = vw - MARGIN - cardW;
  const minY = bannerH() + MARGIN,
    maxY = Math.max(minY, vh - MARGIN - cardH);
  const cx = (x: number) => Math.max(minX, Math.min(maxX, x));
  const cy = (y: number) => Math.max(minY, Math.min(maxY, y));
  if (!holes?.length)
    return { left: cx((vw - cardW) / 2), top: cy((vh - cardH) / 2), placement: "dock" };

  const anchors = holes.length > 1 ? [union(holes), ...holes] : holes;
  const cands: { left: number; top: number; placement: Placement; room: number }[] = [];
  for (const a of anchors) {
    const midY = a.y + a.h / 2 - cardH / 2;
    const midX = a.x + a.w / 2 - cardW / 2;
    const roomR = vw - (a.x + a.w),
      roomL = a.x,
      roomB = vh - (a.y + a.h),
      roomT = a.y - bannerH();
    for (const top of [midY, a.y, a.y + a.h - cardH])
      cands.push({ left: cx(a.x + a.w + GAP), top: cy(top), placement: "right", room: roomR });
    for (const top of [midY, a.y, a.y + a.h - cardH])
      cands.push({ left: cx(a.x - GAP - cardW), top: cy(top), placement: "left", room: roomL });
    for (const left of [midX, a.x, a.x + a.w - cardW])
      cands.push({ left: cx(left), top: cy(a.y + a.h + GAP), placement: "bottom", room: roomB });
    for (const left of [midX, a.x, a.x + a.w - cardW])
      cands.push({ left: cx(left), top: cy(a.y - GAP - cardH), placement: "top", room: roomT });
  }
  // Corners of the viewport, for when every spot beside the spotlight crowds something important.
  for (const [left, top] of [
    [maxX, maxY],
    [minX, maxY],
    [maxX, minY],
    [minX, minY],
  ])
    cands.push({ left, top, placement: "dock", room: 0 });
  const order: Record<Placement, number> = { right: 0, left: 1, bottom: 2, top: 3, dock: 4 };
  const score = (c: { left: number; top: number; placement: Placement; room: number }) => {
    const card = { x: c.left - GAP / 2, y: c.top - GAP / 2, w: cardW + GAP, h: cardH + GAP };
    const covered = holes.reduce((s, h) => s + area(card, h), 0);
    const crowded = avoid.reduce((s, h) => s + area(card, h), 0);
    return covered * 1000 + crowded * 5 + order[c.placement] * 400 - Math.min(c.room, 600);
  };
  let best = cands[0],
    bestScore = Infinity;
  for (const c of cands) {
    const sc = score(c);
    if (sc < bestScore) {
      best = c;
      bestScore = sc;
    }
  }
  const coversHole = (l: number, t: number) =>
    holes.some((h) => area({ x: l, y: t, w: cardW, h: cardH }, h) > 0);
  if (!coversHole(best.left, best.top)) return best;
  const dockB = { left: cx((vw - cardW) / 2), top: maxY, placement: "dock" as const };
  const dockT = { left: cx((vw - cardW) / 2), top: minY, placement: "dock" as const };
  const cost = (d: { left: number; top: number }) =>
    holes.reduce((s, h) => s + area({ x: d.left, y: d.top, w: cardW, h: cardH }, h), 0);
  return cost(dockB) <= cost(dockT) ? dockB : dockT;
}

export default function DemoLayer() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [tour, setTourState] = useState<TourState>(loadTour);
  const [holes, setHoles] = useState<Box[] | null>(null);
  /** The step the current holes were measured for. Old holes stay on screen until the new ones are ready,
   * so the dim never flashes and the spotlight glides from one target to the next. */
  const [holesFor, setHolesFor] = useState(-1);
  const [missing, setMissing] = useState(false);
  const [cardH, setCardH] = useState(220);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const settled = useRef(false);
  const tourIndex = useRef(-1);

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
      // Pass over steps that no longer apply, in the direction of travel.
      const dir = i >= tour.i ? 1 : -1;
      while (i > 0 && i < TOUR.length - 1 && TOUR[i].skip?.()) i += dir;
      demoEvent("step reached", { step: TOUR[i].id });
      setTour({ i: Math.max(0, i), status: "running" });
    },
    [setTour, tour.i],
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

  const [avoidBoxes, setAvoidBoxes] = useState<Box[]>([]);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window === "undefined" ? 1440 : window.innerWidth,
    h: typeof window === "undefined" ? 900 : window.innerHeight,
  }));

  /** Measures the step's targets and the elements its card should keep clear of. */
  const measure = useCallback(() => {
    if (!settled.current || !step?.targets?.length) return;
    const boxes = step.targets.map(holeOf).filter(Boolean) as Box[];
    setHoles((prev) => {
      const same =
        prev &&
        prev.length === boxes.length &&
        prev.every(
          (b, k) =>
            Math.abs(b.x - boxes[k].x) < 0.5 &&
            Math.abs(b.y - boxes[k].y) < 0.5 &&
            Math.abs(b.w - boxes[k].w) < 0.5 &&
            Math.abs(b.h - boxes[k].h) < 0.5,
        );
      return same ? prev : boxes.length ? boxes : null;
    });
    setHolesFor(tourIndex.current);
    const av = (step.avoid ?? [])
      .flatMap((sel) => [...document.querySelectorAll(sel)])
      .map((el) => toBox(el.getBoundingClientRect()))
      .filter((b) => b.w > 0 && b.h > 0);
    setAvoidBoxes((prev) =>
      prev.length === av.length && prev.every((b, k) => b.x === av[k].x && b.y === av[k].y)
        ? prev
        : av,
    );
    setViewport((v) =>
      v.w === window.innerWidth && v.h === window.innerHeight
        ? v
        : { w: window.innerWidth, h: window.innerHeight },
    );
  }, [step]);

  // Activate the step: make sure we are on its route, then find its targets.
  useEffect(() => {
    if (!running || !step) return;
    settled.current = false;
    tourIndex.current = tour.i;
    if (!step.targets?.length) setHoles(null);
    setAvoidBoxes([]);
    setMissing(false);
    let navTimer: number | undefined;
    let settleTimer: number | undefined;
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
    // Same page: measure almost at once. New page: let its entrance transition finish first.
    const startPath = window.location.pathname;
    const poll = window.setInterval(() => {
      if (window.location.pathname !== step.route) return;
      const first = document.querySelector(step.targets![0]);
      if (first) {
        window.clearInterval(poll);
        // Let the page transition finish, then scroll the target to the middle and measure once it has stopped.
        settleTimer = window.setTimeout(
          () => {
            bringIntoView(first);
            settled.current = true;
            let frames = 0;
            const burst = () => {
              measure();
              if (++frames < 24) requestAnimationFrame(burst);
            };
            requestAnimationFrame(burst);
            const focusEl = step.click ? document.querySelector<HTMLElement>(step.click) : null;
            if (step.advance === "button") primaryRef.current?.focus({ preventScroll: true });
            else (focusEl ?? (first as HTMLElement)).focus?.({ preventScroll: true });
          },
          window.location.pathname === startPath ? 60 : 320,
        );
      } else if (Date.now() - started > 7000) {
        window.clearInterval(poll);
        settled.current = true;
        setMissing(true);
      }
    }, 120);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(navTimer);
      window.clearTimeout(settleTimer);
    };
  }, [running, step, router, measure]);

  // Keep the spotlight on its target as anything moves: resize, scroll, layout changes, fonts, animations.
  useEffect(() => {
    if (!running) return;
    let queued = 0;
    const update = () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        measure();
      });
    };
    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      update();
    };
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    for (const sel of step?.targets ?? []) {
      const el = document.querySelector(sel);
      if (el) ro.observe(el);
    }
    window.addEventListener("resize", onResize);
    document.addEventListener("scroll", update, true);
    document.addEventListener("transitionend", update, true);
    document.addEventListener("animationend", update, true);
    void document.fonts?.ready.then(update);
    // A slow safety net for changes no event reports (text streaming into a panel).
    const iv = window.setInterval(update, 400);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(queued);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("scroll", update, true);
      document.removeEventListener("transitionend", update, true);
      document.removeEventListener("animationend", update, true);
      window.clearInterval(iv);
    };
  }, [running, step, measure, holesFor]);

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
  }, [tour.i, tour.status, holes, missing, confirmSkip, viewport]);

  const vw = viewport.w;
  const vh = viewport.h;
  const cardW = cardWidth();
  const waitingForTarget =
    running && !!step?.targets?.length && (holesFor !== tour.i || !holes) && !missing;
  const pos = useMemo(
    () => placeCard(holes, avoidBoxes, cardW, cardH),
    [holes, avoidBoxes, cardW, cardH, vw, vh], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const path = useMemo(() => {
    const outer = `M0 0H${vw}V${vh}H0Z`;
    // Rounded like the ring (.demo-ring, 18px), so no undimmed corner shows outside it.
    const cut = (holes ?? [])
      .map((b) => {
        const r = Math.min(RING_RADIUS, b.w / 2, b.h / 2);
        return (
          `M${b.x + r} ${b.y}h${b.w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${b.h - 2 * r}` +
          `a${r} ${r} 0 0 1 ${-r} ${r}h${-(b.w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}` +
          `v${-(b.h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`
        );
      })
      .join("");
    return outer + cut;
  }, [holes, vw, vh]);

  const body = step ? (Array.isArray(step.body) ? step.body : [step.body]) : [];

  return (
    <>
      <div className="demo-bar" role="region" aria-label="Demo mode">
        <span className="demo-bar-msg">
          <strong>Demo mode.</strong>
          <span className="demo-bar-note"> Nothing here is saved.</span>
        </span>
        <span className="demo-bar-actions">
          <button type="button" onClick={replay} aria-label="Replay tour">
            <RotateCcw size={14} aria-hidden="true" />
            <span className="demo-btn-label">Replay tour</span>
          </button>
          <button type="button" onClick={finish} aria-label="Finish demo">
            <Flag size={14} aria-hidden="true" />
            <span className="demo-btn-label">Finish demo</span>
          </button>
          <button type="button" onClick={() => exitDemo()} aria-label="Exit demo">
            <X size={14} aria-hidden="true" />
            <span className="demo-btn-label">Exit demo</span>
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
                hidden={holesFor !== tour.i}
              />
            ))}
          {holes?.map((b, k) => (
            <div
              key={`r${k}`}
              className="demo-ring"
              style={{ transform: `translate3d(${b.x}px, ${b.y}px, 0)`, width: b.w, height: b.h }}
            />
          ))}
          {!waitingForTarget && (
            // The wrapper glides to the new position; the blurred card inside never moves itself.
            <div
              className="demo-card-pos"
              style={{ transform: `translate3d(${pos.left}px, ${pos.top}px, 0)`, width: cardW }}
            >
              <div
                ref={cardRef}
                className="demo-card"
                data-step={step.id}
                data-advance={missing ? "button" : step.advance}
                data-click={step.click ?? step.targets?.[0] ?? ""}
                role="dialog"
                aria-modal="false"
                aria-labelledby="demo-card-title"
                data-placement={pos.placement}
                data-targets={(step.targets ?? []).join("||")}
                style={{ width: cardW }}
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
                  <span style={{ transform: `scaleX(${step.num / TOUR_TOTAL})` }} />
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
                    ) : step.nextWhenDone ? (
                      <button
                        type="button"
                        className="gh-btn gh-btn--primary gh-btn--small"
                        disabled
                        title="Available when the take finishes"
                      >
                        {step.nextLabel ?? "Next"}
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="demo-card-hint">
                        {step.advance === "wait"
                          ? "Waiting for you"
                          : "Click the highlighted button"}
                      </span>
                    )}
                  </div>
                )}
              </div>
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
