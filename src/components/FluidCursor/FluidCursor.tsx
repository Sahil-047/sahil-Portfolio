"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import AtmosphereBackground from "@/components/AtmosphereBackground";
import { useTheme } from "@/components/ThemeProvider";

interface TrailPoint {
  x: number;
  y: number;
  radius: number;
  born: number;
}

const TRAIL_LIFE_MS = 560;
const MIN_STEP = 2.5;
const BASE_RADIUS = 58;
const MAX_RADIUS = 86;
const MAX_POINTS = 96;
/** Snappy follow — still exp-smoothed so it stays buttery */
const POINTER_FOLLOW = 28;
const RADIUS_FOLLOW = 22;
const MASK_SCALE = 0.4;
const MASK_EVERY_N = 2;
const MAX_STEPS_PER_FRAME = 28;

type FluidCursorProps = {
  children: ReactNode;
};

/**
 * Canvas veil + text masks. Tuned for smooth pointer follow and dense trail;
 * mask PNG encode is throttled so the hole motion stays fluid.
 */
export default function FluidCursor({ children }: FluidCursorProps) {
  const veilRef = useRef<HTMLCanvasElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const underRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const { isDark } = useTheme();
  const darkRef = useRef(isDark);
  darkRef.current = isDark;

  const pointer = useRef({ x: -100, y: -100 });
  const smooth = useRef({ x: -100, y: -100 });
  const prevSmooth = useRef({ x: -100, y: -100 });
  const smoothRadius = useRef(BASE_RADIUS);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const veil = veilRef.current;
    const content = contentRef.current;
    const under = underRef.current;
    if (!veil || !content || !under) return;

    const vctx = veil.getContext("2d", { alpha: true, desynchronized: true });
    if (!vctx) return;

    const hide = document.createElement("canvas");
    const hctx = hide.getContext("2d", { alpha: true });
    const show = document.createElement("canvas");
    const sctx = show.getContext("2d", { alpha: true });
    if (!hctx || !sctx) return;

    let animId = 0;
    let lastTs = 0;
    let masked = false;
    let maskTick = 0;
    const trail: TrailPoint[] = [];

    const punchCircle = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      r: number,
    ) => {
      if (r < 1.2) return;
      const rr = Math.max(1, Math.round(r));
      c.beginPath();
      c.arc(Math.round(x), Math.round(y), rr, 0, Math.PI * 2);
      c.fill();
    };

    const applyMask = (
      el: HTMLElement,
      url: string,
      vw: number,
      vh: number,
    ) => {
      el.style.setProperty("-webkit-mask-image", `url(${url})`);
      el.style.setProperty("mask-image", `url(${url})`);
      el.style.setProperty("-webkit-mask-size", `${vw}px ${vh}px`);
      el.style.setProperty("mask-size", `${vw}px ${vh}px`);
      el.style.setProperty("-webkit-mask-position", "0px 0px");
      el.style.setProperty("mask-position", "0px 0px");
      el.style.setProperty("-webkit-mask-repeat", "no-repeat");
      el.style.setProperty("mask-repeat", "no-repeat");
      el.style.setProperty("-webkit-mask-mode", "luminance");
      el.style.setProperty("mask-mode", "luminance");
    };

    const clearMask = (el: HTMLElement) => {
      el.style.setProperty("-webkit-mask-image", "none");
      el.style.setProperty("mask-image", "none");
    };

    under.style.opacity = "0";
    vctx.imageSmoothingEnabled = false;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = window.innerWidth;
      const h = window.innerHeight;
      veil.width = Math.floor(w * dpr);
      veil.height = Math.floor(h * dpr);
      veil.style.width = `${w}px`;
      veil.style.height = `${h}px`;
      vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      vctx.imageSmoothingEnabled = false;

      hide.width = Math.max(1, Math.floor(w * MASK_SCALE));
      hide.height = Math.max(1, Math.floor(h * MASK_SCALE));
      show.width = hide.width;
      show.height = hide.height;
      hctx.imageSmoothingEnabled = false;
      sctx.imageSmoothingEnabled = false;
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const handlePointerMove = (e: MouseEvent | TouchEvent | PointerEvent) => {
      // Coalesced samples = butter-smooth path on fast flicks
      if ("getCoalescedEvents" in e && typeof e.getCoalescedEvents === "function") {
        const samples = e.getCoalescedEvents();
        const last = samples[samples.length - 1] ?? e;
        pointer.current.x = last.clientX;
        pointer.current.y = last.clientY;
        return;
      }
      if ("touches" in e) {
        if (!e.touches[0]) return;
        pointer.current.x = e.touches[0].clientX;
        pointer.current.y = e.touches[0].clientY;
      } else {
        pointer.current.x = e.clientX;
        pointer.current.y = e.clientY;
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    window.addEventListener("touchmove", handlePointerMove, { passive: true });

    const render = (ts: number) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const now = ts;
      const dt = lastTs ? Math.min(0.048, (now - lastTs) / 1000) : 1 / 60;
      lastTs = now;

      const px = pointer.current.x;
      const py = pointer.current.y;

      if (px > -50) {
        if (smooth.current.x < -50) {
          smooth.current.x = px;
          smooth.current.y = py;
          prevSmooth.current.x = px;
          prevSmooth.current.y = py;
        } else {
          const k = 1 - Math.exp(-POINTER_FOLLOW * dt);
          smooth.current.x += (px - smooth.current.x) * k;
          smooth.current.y += (py - smooth.current.y) * k;
        }

        const sx = smooth.current.x;
        const sy = smooth.current.y;
        const dx = sx - prevSmooth.current.x;
        const dy = sy - prevSmooth.current.y;
        const dist = Math.hypot(dx, dy);

        // Velocity → radius, eased so size changes stay smooth
        const speed = dist / Math.max(dt, 1 / 120);
        const targetR = Math.min(
          MAX_RADIUS,
          Math.max(BASE_RADIUS - 6, BASE_RADIUS + 18 - speed * 0.04),
        );
        const rk = 1 - Math.exp(-RADIUS_FOLLOW * dt);
        smoothRadius.current += (targetR - smoothRadius.current) * rk;

        if (dist > 0.2) {
          const steps = Math.min(
            MAX_STEPS_PER_FRAME,
            Math.max(1, Math.ceil(dist / MIN_STEP)),
          );
          const inv = 1 / steps;
          for (let i = 1; i <= steps; i++) {
            const t = i * inv;
            trail.push({
              x: prevSmooth.current.x + dx * t,
              y: prevSmooth.current.y + dy * t,
              radius: smoothRadius.current,
              born: now,
            });
          }
          prevSmooth.current.x = sx;
          prevSmooth.current.y = sy;
          while (trail.length > MAX_POINTS) trail.shift();
        } else {
          // Idle — no new points so the trail seals shut
          prevSmooth.current.x = sx;
          prevSmooth.current.y = sy;
        }
      }

      while (trail.length && now - trail[0].born > TRAIL_LIFE_MS) {
        trail.shift();
      }

      const mw = hide.width;
      const mh = hide.height;
      const msx = mw / vw;
      const msy = mh / vh;

      vctx.globalCompositeOperation = "source-over";
      vctx.globalAlpha = 1;

      // Dark mode: clear veil so Spline bg is fully visible
      if (darkRef.current) {
        vctx.clearRect(0, 0, vw, vh);
        if (masked) {
          clearMask(content);
          clearMask(under);
          under.style.opacity = "0";
          masked = false;
          maskTick = 0;
        }
        animId = requestAnimationFrame(render);
        return;
      }

      vctx.fillStyle = "#ffffff";
      vctx.fillRect(0, 0, vw, vh);
      vctx.globalCompositeOperation = "destination-out";
      vctx.fillStyle = "#000000";

      const len = trail.length;
      const buildMasks = len > 0 && (maskTick % MASK_EVERY_N === 0 || !masked);
      maskTick += 1;

      if (buildMasks) {
        hctx.globalCompositeOperation = "source-over";
        hctx.globalAlpha = 1;
        hctx.fillStyle = "#ffffff";
        hctx.fillRect(0, 0, mw, mh);
        hctx.globalCompositeOperation = "destination-out";
        hctx.fillStyle = "#000000";

        sctx.globalCompositeOperation = "source-over";
        sctx.globalAlpha = 1;
        sctx.fillStyle = "#000000";
        sctx.fillRect(0, 0, mw, mh);
      }

      for (let i = 0; i < len; i++) {
        const p = trail[i];
        const age = (now - p.born) / TRAIL_LIFE_MS;
        if (age >= 1) continue;
        const along = len <= 1 ? 1 : i / (len - 1);
        // Smoothstep fade — even seal, no radius pop at the tail
        const fade = 1 - age;
        const soft = fade * fade * (3 - 2 * fade);
        const headBoost = 0.78 + along * 0.22;
        const r = p.radius * headBoost * soft;
        if (r < 1.2) continue;

        const pr = r + 1.5;
        punchCircle(vctx, p.x, p.y, pr);

        if (buildMasks) {
          punchCircle(hctx, p.x * msx, p.y * msy, pr * msx * 1.05);
          if (soft > 0.12) {
            sctx.fillStyle = "#ffffff";
            punchCircle(sctx, p.x * msx, p.y * msy, pr * msx);
          }
        }
      }

      vctx.globalCompositeOperation = "source-over";
      vctx.globalAlpha = 1;

      if (len > 0) {
        if (buildMasks) {
          hctx.globalCompositeOperation = "source-over";
          sctx.globalCompositeOperation = "source-over";
          applyMask(content, hide.toDataURL("image/png"), vw, vh);
          applyMask(under, show.toDataURL("image/png"), vw, vh);
          under.style.opacity = "1";
          masked = true;
        }
      } else if (masked) {
        clearMask(content);
        clearMask(under);
        under.style.opacity = "0";
        masked = false;
        maskTick = 0;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("touchmove", handlePointerMove);
      cancelAnimationFrame(animId);
      clearMask(content);
      clearMask(under);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <>
      <AtmosphereBackground />

      <div
        ref={underRef}
        id="fluid-text-under"
        className={`pointer-events-none fixed inset-0 z-0 ${isDark ? "opacity-0" : ""}`}
        aria-hidden
      />

      <canvas
        ref={veilRef}
        className={`pointer-events-none fixed inset-0 z-[1] h-full w-full ${
          isDark ? "opacity-0" : ""
        }`}
        aria-hidden
      />

      <div
        ref={contentRef}
        className="fluid-page-content fixed inset-0 z-[2] overflow-visible"
      >
        {children}
      </div>
    </>
  );
}
