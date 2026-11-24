/**
 * The tour spotlight's glide, in every browser. CSS cannot animate an SVG path `d` outside Chrome, and animating
 * the ring's width and height is layout work, so the spotlight is tweened here instead: when the step changes,
 * every box eases from where it was shown to its new place over GLIDE_MS (ease-out quartic), and each frame is
 * written straight to the DOM (the dim path `d`, each ring's transform, width and height). React never
 * re-renders per frame.
 *
 * Within a step (scrolling, resizing, content moving) the spotlight follows its target at once. The first
 * appearance and reduced motion snap, with no tween.
 */
import { useLayoutEffect, useRef } from "react";

export type Box = { x: number; y: number; w: number; h: number };

/** Corner radius of the spotlight; matches .demo-ring in styles.css. */
export const RING_RADIUS = 18;
const GLIDE_MS = 420;

/** The dim layer: the whole viewport with a rounded cut-out per box (even-odd fill). */
export function buildDimPath(vw: number, vh: number, holes: Box[] | null | undefined): string {
  const outer = `M0 0H${vw}V${vh}H0Z`;
  const cut = (holes ?? [])
    .map((b) => {
      const r = Math.max(0, Math.min(RING_RADIUS, b.w / 2, b.h / 2));
      return (
        `M${b.x + r} ${b.y}h${b.w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${b.h - 2 * r}` +
        `a${r} ${r} 0 0 1 ${-r} ${r}h${-(b.w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}` +
        `v${-(b.h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`
      );
    })
    .join("");
  return outer + cut;
}

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: Box, b: Box, t: number): Box => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param holes the boxes to show now (null: no spotlight)
 * @param stepKey changes when the tour moves to another step; only then does the spotlight glide
 * @returns refs for the dim path and the ring elements (by index)
 */
export function useGlidingSpotlight(holes: Box[] | null, stepKey: number, vw: number, vh: number) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const ringRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shown = useRef<Box[]>([]);
  const lastKey = useRef(stepKey);
  const tween = useRef<{
    from: Box[];
    to: Box[];
    start: number;
    raf: number;
    safety: number;
  } | null>(null);
  const size = useRef({ vw, vh });
  size.current = { vw, vh };

  const write = (boxes: Box[]) => {
    shown.current = boxes;
    pathRef.current?.setAttribute("d", buildDimPath(size.current.vw, size.current.vh, boxes));
    boxes.forEach((b, k) => {
      const el = ringRefs.current[k];
      if (!el) return;
      el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
      el.style.width = `${b.w}px`;
      el.style.height = `${b.h}px`;
    });
  };

  const frame = () => {
    const tw = tween.current;
    if (!tw) return;
    const t = Math.min(1, (performance.now() - tw.start) / GLIDE_MS);
    const e = easeOutQuart(t);
    write(tw.to.map((b, k) => mix(tw.from[k], b, e)));
    if (t < 1) tw.raf = requestAnimationFrame(frame);
    else finish();
  };
  /** Lands on the target and stops. Also runs from a timer, in case animation frames are paused. */
  const finish = () => {
    const tw = tween.current;
    if (!tw) return;
    cancelAnimationFrame(tw.raf);
    window.clearTimeout(tw.safety);
    tween.current = null;
    write(tw.to);
  };

  // New targets: glide on a step change, follow at once within a step.
  useLayoutEffect(() => {
    const target = holes ?? [];
    const stepChanged = stepKey !== lastKey.current;
    lastKey.current = stepKey;
    const prev = shown.current;
    const canGlide = prev.length > 0 && prev.length === target.length && !reducedMotion();
    if (tween.current) {
      // Mid glide: aim the running glide at the latest boxes so it lands on them.
      if (tween.current.to.length === target.length) {
        tween.current.to = target;
        return;
      }
      cancelAnimationFrame(tween.current.raf);
      window.clearTimeout(tween.current.safety);
      tween.current = null;
    }
    if (stepChanged && canGlide) {
      tween.current = { from: prev, to: target, start: performance.now(), raf: 0, safety: 0 };
      tween.current.raf = requestAnimationFrame(frame);
      tween.current.safety = window.setTimeout(finish, GLIDE_MS + 120);
      write(prev); // React just rendered the target; show the start of the glide before this paint
    } else {
      write(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holes, stepKey]);

  // Any other re-render (or a viewport change) mid glide: restore the glide's current frame before paint.
  useLayoutEffect(() => {
    if (tween.current) write(shown.current);
  });

  useLayoutEffect(
    () => () => {
      if (tween.current) {
        cancelAnimationFrame(tween.current.raf);
        window.clearTimeout(tween.current.safety);
      }
    },
    [],
  );

  return { pathRef, ringRefs };
}
