"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import AtmosphereBackground from "@/components/AtmosphereBackground";
import { useTheme } from "@/components/ThemeProvider";

interface TrailPoint {
  x: number;
  y: number;
  radius: number;
  born: number;
  /** Motion blur: stamp stretches along travel direction at speed */
  angle: number;
  stretch: number;
}

const TRAIL_LIFE_MS = 620;
const MIN_STEP = 4;
const BASE_RADIUS = 26;
const MIN_RADIUS = 16;
const MAX_RADIUS = 40;
const PORTAL_RADIUS = 56;
const MAX_POINTS = 220;
/** Tight follow — almost 1:1, still exp-smoothed so it stays buttery */
const POINTER_FOLLOW = 52;
const RADIUS_FOLLOW = 36;
const MASK_SCALE = 0.4;
const MASK_EVERY_N = 1;
const MAX_STEPS_PER_FRAME = 28;
/** Metaball goo: blur then hard alpha threshold = crisp liquid silhouette */
const GOO_SCALE = 0.5;
const GOO_BLUR = 10;
const GOO_FILTER_ID = "fluid-goo-threshold";
/** Age fraction where ink starts blooming / fading in water */
const DISSOLVE_START = 0.22;
/** Motion blur strength: speed → directional stretch of stamps */
const STRETCH_PER_SPEED = 0.0009;
const STRETCH_MAX = 2.2;
/** px/s — below this the nib stays a small brush, never a portal */
const SLOW_SPEED = 90;

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
  const { isDark, isTransitioning } = useTheme();
  const darkRef = useRef(isDark);
  darkRef.current = isDark;
  const transitioningRef = useRef(isTransitioning);
  transitioningRef.current = isTransitioning;

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

    // Metaball pipeline: raw hard circles → blur + alpha threshold → goo
    const raw = document.createElement("canvas");
    const rctx = raw.getContext("2d", { alpha: true });
    const goo = document.createElement("canvas");
    const gctx = goo.getContext("2d", { alpha: true });
    if (!rctx || !gctx) return;

    const supportsGoo = (() => {
      gctx.filter = "blur(2px)";
      const ok = gctx.filter === "blur(2px)";
      gctx.filter = "none";
      return ok;
    })();

    let animId = 0;
    let lastTs = 0;
    let masked = false;
    let maskTick = 0;
    const trail: TrailPoint[] = [];
    /** Theme toggle hover — freeze hole open like a portal */
    const portal: { held: boolean; x: number; y: number; el: Element | null } =
      { held: false, x: 0, y: 0, el: null };

    const lockPortal = (el: Element) => {
      const rect = el.getBoundingClientRect();
      portal.held = true;
      portal.el = el;
      portal.x = rect.left + rect.width / 2;
      portal.y = rect.top + rect.height / 2;
      pointer.current.x = portal.x;
      pointer.current.y = portal.y;
    };

    const onPortalOver = (e: PointerEvent | FocusEvent) => {
      if (
        transitioningRef.current ||
        document.documentElement.hasAttribute("data-theme-transitioning")
      ) {
        return;
      }
      const el =
        e.target instanceof Element
          ? e.target.closest("[data-fluid-portal]")
          : null;
      if (!el) return;
      const from = e.relatedTarget;
      if (from instanceof Node && el.contains(from)) return;
      lockPortal(el);
    };

    const onPortalOut = (e: PointerEvent | FocusEvent) => {
      const el =
        e.target instanceof Element
          ? e.target.closest("[data-fluid-portal]")
          : null;
      if (!el) return;
      const to = e.relatedTarget;
      if (to instanceof Node && el.contains(to)) return;
      portal.held = false;
      portal.el = null;
    };

    /** Soft-edged ink brush — solid core, feathered rim */
    const makeBrush = (rgb: string) => {
      const size = 128;
      const b = document.createElement("canvas");
      b.width = size;
      b.height = size;
      const g = b.getContext("2d");
      if (!g) return b;
      const grad = g.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
      );
      grad.addColorStop(0, `rgba(${rgb},1)`);
      grad.addColorStop(0.74, `rgba(${rgb},1)`);
      grad.addColorStop(0.92, `rgba(${rgb},0.45)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      return b;
    };
    const inkBrush = makeBrush("0,0,0");
    const whiteBrush = makeBrush("255,255,255");

    const stampBlob = (
      c: CanvasRenderingContext2D,
      brush: HTMLCanvasElement,
      x: number,
      y: number,
      r: number,
    ) => {
      if (r < 1.2) return;
      c.drawImage(brush, x - r, y - r, r * 2, r * 2);
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
    vctx.imageSmoothingEnabled = true;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const maskEvery = mobile ? 3 : MASK_EVERY_N;
    const maxPts = mobile ? 72 : MAX_POINTS;
    const gooScale = mobile ? 0.32 : GOO_SCALE;
    const useGoo = supportsGoo && !mobile;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75);
      const w = window.innerWidth;
      const h = window.innerHeight;
      veil.width = Math.floor(w * dpr);
      veil.height = Math.floor(h * dpr);
      veil.style.width = `${w}px`;
      veil.style.height = `${h}px`;
      vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      vctx.imageSmoothingEnabled = true;

      hide.width = Math.max(1, Math.floor(w * (mobile ? 0.28 : MASK_SCALE)));
      hide.height = Math.max(1, Math.floor(h * (mobile ? 0.28 : MASK_SCALE)));
      show.width = hide.width;
      show.height = hide.height;
      hctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingEnabled = true;

      raw.width = Math.max(1, Math.floor(w * gooScale));
      raw.height = Math.max(1, Math.floor(h * gooScale));
      goo.width = raw.width;
      goo.height = raw.height;
      rctx.imageSmoothingEnabled = true;
      gctx.imageSmoothingEnabled = true;
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const handlePointerMove = (e: MouseEvent | TouchEvent | PointerEvent) => {
      // Portal hold owns the pointer — vibration applied in render
      if (portal.held) return;
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
    window.addEventListener("pointerover", onPortalOver, { passive: true });
    window.addEventListener("pointerout", onPortalOut, { passive: true });
    window.addEventListener("focusin", onPortalOver, { passive: true });
    window.addEventListener("focusout", onPortalOut, { passive: true });

    const render = (ts: number) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const now = ts;
      const dt = lastTs ? Math.min(0.048, (now - lastTs) / 1000) : 1 / 60;
      lastTs = now;

      // Theme portal cover owns the screen — stop fluid hole jitter
      const themeCovering =
        transitioningRef.current ||
        document.documentElement.hasAttribute("data-theme-transitioning");
      if (themeCovering) {
        if (portal.held) {
          portal.held = false;
          portal.el = null;
        }
        // Let the trail age out quietly — no new points while covering
      }

      if (portal.held && !themeCovering) {
        // Track elevated button center, then vibrate the hole
        if (portal.el) {
          const rect = portal.el.getBoundingClientRect();
          portal.x = rect.left + rect.width / 2;
          portal.y = rect.top + rect.height / 2;
        }
        const vibX =
          Math.sin(now * 0.018) * 2.2 +
          Math.sin(now * 0.031) * 1.1;
        const vibY =
          Math.cos(now * 0.021) * 1.9 +
          Math.sin(now * 0.027) * 1.0;
        pointer.current.x = portal.x + vibX;
        pointer.current.y = portal.y + vibY;
      }

      const px = pointer.current.x;
      const py = pointer.current.y;

      if (px > -50) {
        if (smooth.current.x < -50) {
          smooth.current.x = px;
          smooth.current.y = py;
          prevSmooth.current.x = px;
          prevSmooth.current.y = py;
        } else {
          const follow = portal.held ? POINTER_FOLLOW * 1.15 : POINTER_FOLLOW;
          const k = 1 - Math.exp(-follow * dt);
          smooth.current.x += (px - smooth.current.x) * k;
          smooth.current.y += (py - smooth.current.y) * k;
        }

        const sx = smooth.current.x;
        const sy = smooth.current.y;
        const dx = sx - prevSmooth.current.x;
        const dy = sy - prevSmooth.current.y;
        const dist = Math.hypot(dx, dy);

        // Slow brush = small nib (watercolor). Fast flick = a bit fuller, then a thin ribbon.
        const speed = dist / Math.max(dt, 1 / 120);
        const vibR = portal.held
          ? Math.sin(now * 0.022) * 2.8 + Math.sin(now * 0.035) * 1.4
          : 0;
        let targetR: number;
        if (portal.held) {
          targetR = PORTAL_RADIUS + vibR;
        } else {
          const slow = Math.min(1, speed / SLOW_SPEED);
          const flick = Math.min(1, Math.max(0, (speed - 420) / 1400));
          targetR = MIN_RADIUS + (BASE_RADIUS - MIN_RADIUS) * slow * (1 - flick * 0.55);
          targetR = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, targetR));
        }
        const rk = 1 - Math.exp(-(portal.held ? RADIUS_FOLLOW * 0.55 : RADIUS_FOLLOW) * dt);
        smoothRadius.current += (targetR - smoothRadius.current) * rk;

        if (portal.held) {
          // Keep refreshing the hole so it never seals while hovering
          trail.push({
            x: sx,
            y: sy,
            radius: smoothRadius.current,
            born: now,
            angle: 0,
            stretch: 1,
          });
          prevSmooth.current.x = sx;
          prevSmooth.current.y = sy;
          while (trail.length > maxPts) trail.shift();
        } else if (dist > 0.35) {
          const angle = Math.atan2(dy, dx);
          const stretch = Math.min(
            STRETCH_MAX,
            1 + speed * STRETCH_PER_SPEED,
          );
          const step = MIN_STEP + (speed < SLOW_SPEED ? 5 : 0);
          const steps = Math.min(
            MAX_STEPS_PER_FRAME,
            Math.max(1, Math.ceil(dist / step)),
          );
          const inv = 1 / steps;
          for (let i = 1; i <= steps; i++) {
            const t = i * inv;
            trail.push({
              x: prevSmooth.current.x + dx * t,
              y: prevSmooth.current.y + dy * t,
              radius: smoothRadius.current,
              born: now,
              angle,
              stretch,
            });
          }
          prevSmooth.current.x = sx;
          prevSmooth.current.y = sy;
          while (trail.length > maxPts) trail.shift();
        } else {
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

      const len = trail.length;
      const buildMasks = len > 0 && (maskTick % maskEvery === 0 || !masked);
      maskTick += 1;

      if (buildMasks) {
        hctx.globalCompositeOperation = "source-over";
        hctx.globalAlpha = 1;
        hctx.fillStyle = "#ffffff";
        hctx.fillRect(0, 0, mw, mh);
        hctx.globalCompositeOperation = "destination-out";

        sctx.globalCompositeOperation = "source-over";
        sctx.globalAlpha = 1;
        sctx.fillStyle = "#000000";
        sctx.fillRect(0, 0, mw, mh);
      }

      if (useGoo && len > 0) {
        // 1) Stamps into the raw field — ellipses stretched along motion
        const gw = raw.width;
        const gh = raw.height;
        const gsx = gw / vw;
        rctx.clearRect(0, 0, gw, gh);
        rctx.fillStyle = "#ffffff";

        for (let i = 0; i < len; i++) {
          const p = trail[i];
          const age = (now - p.born) / TRAIL_LIFE_MS;
          if (age >= 1) continue;
          const along = len <= 1 ? 1 : i / (len - 1);
          const headBoost = 0.62 + along * 0.38;

          // Watercolor: hold, then bloom outward while fading — not a portal pinch
          let shape: number;
          let ink = 1;
          if (age < DISSOLVE_START) {
            shape = 1;
          } else {
            const u = (age - DISSOLVE_START) / (1 - DISSOLVE_START);
            const eased = u * u * (3 - 2 * u);
            shape = 1 + eased * 0.7;
            ink = 1 - eased;
          }
          const r = p.radius * headBoost * shape;
          if (r < 1.2 || ink < 0.04) continue;

          const relax = 1 - Math.min(1, age * 1.6);
          const effStretch = 1 + (p.stretch - 1) * Math.max(0, relax);

          rctx.globalAlpha = ink;
          rctx.beginPath();
          rctx.ellipse(
            p.x * gsx,
            p.y * gsx,
            r * effStretch * gsx,
            r * gsx,
            p.angle,
            0,
            Math.PI * 2,
          );
          rctx.fill();
        }

        rctx.globalAlpha = 1;

        // 2) Blur + soft threshold = wet-on-wet wash, not a hard portal edge
        gctx.clearRect(0, 0, gw, gh);
        gctx.filter = `url(#${GOO_FILTER_ID})`;
        gctx.drawImage(raw, 0, 0);
        gctx.filter = "none";

        // 3) Punch the veil + build masks from the same silhouette
        vctx.drawImage(goo, 0, 0, vw, vh);
        if (buildMasks) {
          hctx.drawImage(goo, 0, 0, mw, mh);
          sctx.drawImage(goo, 0, 0, mw, mh);
        }
      } else {
        for (let i = 0; i < len; i++) {
          const p = trail[i];
          const age = (now - p.born) / TRAIL_LIFE_MS;
          if (age >= 1) continue;
          const along = len <= 1 ? 1 : i / (len - 1);
          const fade = 1 - age;
          const soft = fade * fade * (3 - 2 * fade);
          const headBoost = 0.45 + along * 0.55;
          const wobble =
            1 +
            0.06 * Math.sin(now * 0.005 + i * 0.85) +
            0.04 * Math.sin(now * 0.0087 + i * 1.6);
          const r = p.radius * headBoost * soft * wobble;
          if (r < 1.2) continue;

          const pr = r + 1.5;
          stampBlob(vctx, inkBrush, p.x, p.y, pr);

          if (buildMasks) {
            stampBlob(hctx, inkBrush, p.x * msx, p.y * msy, pr * msx * 1.05);
            if (soft > 0.12) {
              stampBlob(sctx, whiteBrush, p.x * msx, p.y * msy, pr * msx);
            }
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
      window.removeEventListener("pointerover", onPortalOver);
      window.removeEventListener("pointerout", onPortalOut);
      window.removeEventListener("focusin", onPortalOver);
      window.removeEventListener("focusout", onPortalOut);
      cancelAnimationFrame(animId);
      clearMask(content);
      clearMask(under);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <>
      <AtmosphereBackground />

      {/* Goo: blur + hard alpha threshold — fuses trail circles into liquid */}
      <svg
        className="pointer-events-none absolute h-0 w-0 overflow-hidden"
        aria-hidden
      >
        <defs>
          <filter
            id={GOO_FILTER_ID}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation={GOO_BLUR}
              result="blur"
            />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 14 -7"
            />
          </filter>
        </defs>
      </svg>

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
