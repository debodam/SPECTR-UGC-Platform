import { useEffect, useRef } from "react";

interface Star {
  ox: number;
  oy: number;
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  glow: boolean;
  twinklePhase: number;
  twinkleSpeed: number;
}

const REPEL_RADIUS = 110;
const MAX_PUSH = 22;
const EASE = 0.08;

export function StarBackground({ interactive = false }: { interactive?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let stars: Star[] = [];
    let rafId = 0;
    let time = 0;
    let mouseX = -9999;
    let mouseY = -9999;
    let hasMouse = false;

    function makeStars() {
      const count = Math.min(190, Math.max(70, Math.floor((width * height) / 9000)));
      stars = Array.from({ length: count }, () => {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const sizeRoll = Math.random();
        const r =
          sizeRoll > 0.93 ? 1.3 + Math.random() * 1.1 : sizeRoll > 0.6 ? 0.8 + Math.random() * 0.5 : 0.3 + Math.random() * 0.5;
        return {
          ox: x,
          oy: y,
          x,
          y,
          r,
          baseAlpha: 0.2 + Math.random() * 0.7,
          glow: Math.random() > 0.88,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.3 + Math.random() * 0.6,
        };
      });
    }

    function drawStar(s: Star, alpha: number) {
      if (s.glow) {
        const glowR = s.r * 4.5;
        const gradient = ctx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
        gradient.addColorStop(0, `rgba(255,255,255,${alpha * 0.45})`);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx!.beginPath();
        ctx!.fillStyle = gradient;
        ctx!.arc(s.x, s.y, glowR, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.beginPath();
      ctx!.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx!.fill();
    }

    function renderStatic() {
      ctx!.fillStyle = "#000000";
      ctx!.fillRect(0, 0, width, height);
      for (const s of stars) drawStar(s, s.baseAlpha);
    }

    function tick() {
      time += 1;
      ctx!.fillStyle = "#000000";
      ctx!.fillRect(0, 0, width, height);

      for (const s of stars) {
        let targetX = s.ox;
        let targetY = s.oy;

        if (hasMouse) {
          const dx = s.ox - mouseX;
          const dy = s.oy - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < REPEL_RADIUS) {
            const force = 1 - dist / REPEL_RADIUS;
            const push = force * MAX_PUSH;
            const angle = Math.atan2(dy, dx);
            targetX = s.ox + Math.cos(angle) * push;
            targetY = s.oy + Math.sin(angle) * push;
          }
        }

        s.x += (targetX - s.x) * EASE;
        s.y += (targetY - s.y) * EASE;

        const twinkle = 0.75 + 0.25 * Math.sin(time * 0.02 * s.twinkleSpeed + s.twinklePhase);
        drawStar(s, s.baseAlpha * twinkle);
      }

      rafId = requestAnimationFrame(tick);
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeStars();
      if (!interactive) renderStatic();
    }

    function onMouseMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      hasMouse = true;
    }
    function onMouseLeave() {
      hasMouse = false;
    }

    resize();
    window.addEventListener("resize", resize);

    if (interactive) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseleave", onMouseLeave);
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (interactive) {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseleave", onMouseLeave);
        cancelAnimationFrame(rafId);
      }
    };
  }, [interactive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0"
      style={{ zIndex: -1, background: "#000", pointerEvents: "none" }}
    />
  );
}
