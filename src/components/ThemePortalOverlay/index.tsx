"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export type ThemePortalTransition = {
  from: "light" | "dark";
  to: "light" | "dark";
  x: number;
  y: number;
  id: number;
};

type ThemePortalOverlayProps = {
  transition: ThemePortalTransition;
  onThemeReady: (theme: "light" | "dark") => void;
  onComplete: () => void;
};

const START_R = 72;

type Plume = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  seed: number;
};

/**
 * 1) Portal expands from the toggle until the page is covered
 * 2) Theme commits (hidden under full cover)
 * 3) Fog dissolves naturally, then the veil lifts
 */
export default function ThemePortalOverlay({
  transition,
  onThemeReady,
  onComplete,
}: ThemePortalOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const veilRef = useRef<HTMLDivElement | null>(null);
  const fogRef = useRef<HTMLCanvasElement | null>(null);
  const committed = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    const veil = veilRef.current;
    const canvas = fogRef.current;
    if (!root || !veil || !canvas) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { to, x: oxPx, y: oyPx } = transition;
    const toDark = to === "dark";

    document.documentElement.setAttribute("data-theme-transitioning", "true");

    const w = window.innerWidth;
    const h = window.innerHeight;
    const maxR =
      Math.hypot(Math.max(oxPx, w - oxPx), Math.max(oyPx, h - oyPx)) + 120;

    veil.style.background = toDark ? "#010206" : "#f7f7f8";
    veil.style.opacity = "1";
    root.style.opacity = "1";
    // Soft feathered mask — hard clipPath was shimmering at the top-right rim
    root.style.clipPath = "none";
    (
      root.style as CSSStyleDeclaration & { webkitClipPath: string }
    ).webkitClipPath = "none";

    const applyRadius = (r: number) => {
      const soft = Math.max(28, r * 0.18);
      const inner = Math.max(0, r - soft);
      const mask = `radial-gradient(circle ${r + soft}px at ${oxPx}px ${oyPx}px, #000 ${inner}px, transparent ${r + soft}px)`;
      root.style.maskImage = mask;
      root.style.webkitMaskImage = mask;
      root.style.maskMode = "alpha";
      root.style.webkitMaskSize = "100% 100%";
      root.style.maskSize = "100% 100%";
      root.style.maskRepeat = "no-repeat";
      root.style.webkitMaskRepeat = "no-repeat";
    };

    applyRadius(reduce ? maxR : START_R);

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Finer grid = less blocky corner shimmer after upscale
    const gw = Math.max(72, Math.floor(w / 10));
    const gh = Math.max(40, Math.floor(h / 10));
    let dens = new Float32Array(gw * gh);
    let densTmp = new Float32Array(gw * gh);
    let vx = new Float32Array(gw * gh);
    let vy = new Float32Array(gw * gh);
    const buf = document.createElement("canvas");
    const bctx = buf.getContext("2d", { alpha: true });
    if (!bctx) return;
    buf.width = gw;
    buf.height = gh;
    const img = bctx.createImageData(gw, gh);

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const ix = (i: number, j: number) => i + j * gw;

    const hash = (a: number, b: number) => {
      const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const noise = (px: number, py: number) => {
      const xi = Math.floor(px);
      const yi = Math.floor(py);
      const xf = px - xi;
      const yf = py - yi;
      const u = xf * xf * (3 - 2 * xf);
      const v = yf * yf * (3 - 2 * yf);
      const aa = hash(xi, yi);
      const bb = hash(xi + 1, yi);
      const cc = hash(xi, yi + 1);
      const dd = hash(xi + 1, yi + 1);
      return aa + (bb - aa) * u + (cc - aa) * v + (aa - bb - cc + dd) * u * v;
    };

    const sample = (arr: Float32Array, fx: number, fy: number) => {
      const x0 = Math.min(gw - 2, Math.max(0, Math.floor(fx)));
      const y0 = Math.min(gh - 2, Math.max(0, Math.floor(fy)));
      const tx = fx - x0;
      const ty = fy - y0;
      const a = arr[ix(x0, y0)];
      const b = arr[ix(x0 + 1, y0)];
      const c = arr[ix(x0, y0 + 1)];
      const d = arr[ix(x0 + 1, y0 + 1)];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };

    const ox = (oxPx / Math.max(w, 1)) * (gw - 1);
    const oy = (oyPx / Math.max(h, 1)) * (gh - 1);

    // Soft seed around portal — no hard blob at the corner
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const d = Math.hypot(i - ox, j - oy) / Math.max(gw * 0.35, 1);
        const soft = Math.exp(-d * d * 1.8);
        dens[ix(i, j)] = soft * 1.1 + noise(i * 0.12, j * 0.12) * 0.15;
        vx[ix(i, j)] = 0;
        vy[ix(i, j)] = 0;
      }
    }

    const plumes: Plume[] = [];
    const spawnPlume = (nearOrigin = false) => {
      const ang = Math.random() * Math.PI * 2;
      const spd = toDark ? 0.35 + Math.random() * 0.85 : 0.15 + Math.random() * 0.35;
      plumes.push({
        x: nearOrigin ? ox + (Math.random() - 0.5) * 6 : Math.random() * (gw - 1),
        y: nearOrigin ? oy + (Math.random() - 0.5) * 6 : Math.random() * (gh - 1),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        r: toDark ? 4 + Math.random() * 9 : 3 + Math.random() * 5,
        life: toDark ? 1.2 + Math.random() * 1.4 : 0.8 + Math.random() * 0.8,
        seed: Math.random() * 100,
      });
    };
    for (let i = 0; i < (toDark ? 10 : 4); i++) spawnPlume(true);

    let raf = 0;
    let alive = true;
    const t0 = performance.now();
    let fogAmount = 1;
    let coverBoost = 1.05;
    let portalR = START_R;
    let dissolving = false;
    let spawnAcc = 0;

    const paintSmoke = (t: number) => {
      const data = img.data;
      data.fill(0);
      const fade = fogAmount;
      if (fade < 0.01) {
        ctx.clearRect(0, 0, w, h);
        return;
      }

      // Portal radius in grid units — feather density at rim (kills corner shimmer)
      const gridR = (portalR / Math.max(w, h)) * Math.max(gw, gh);
      const feather = Math.max(3, gridR * 0.22);

      for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
          const id = ix(i, j);
          const n =
            noise(i * 0.07 + t * 0.08, j * 0.07 - t * 0.07) * 0.45 +
            noise(i * 0.03 - t * 0.04, j * 0.03 + t * 0.035) * 0.35;
          let d = (dens[id] * coverBoost + n * 0.4) * fade;
          const dist = Math.hypot(i - ox, j - oy);
          const rim = 1 - Math.min(1, Math.max(0, (dist - (gridR - feather)) / feather));
          d *= rim * rim;
          if (d < 0.025) continue;

          const p = id * 4;
          const a = Math.min(1, d * 0.55 + d * d * 0.5);
          if (toDark) {
            data[p] = 30 + d * 32;
            data[p + 1] = 50 + d * 45;
            data[p + 2] = 90 + d * 60;
            data[p + 3] = Math.min(185, 18 + a * 150);
          } else {
            data[p] = 242 + d * 12;
            data[p + 1] = 244 + d * 10;
            data[p + 2] = 248;
            data[p + 3] = Math.min(195, 22 + a * 155);
          }
        }
      }
      bctx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      // Stable blur — avoid reassigning filter string thrash mid-frame
      ctx.filter = "blur(28px)";
      ctx.globalAlpha = Math.min(1, 0.4 + fade * 0.55);
      ctx.drawImage(buf, 0, 0, w, h);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
    };

    const step = (t: number, dt: number) => {
      // Random wandering force field (stronger toward dark)
      const force = toDark ? 0.55 : 0.22;
      for (let j = 1; j < gh - 1; j++) {
        for (let i = 1; i < gw - 1; i++) {
          const id = ix(i, j);
          const n1 = noise(i * 0.05 + t * 0.15, j * 0.05 + 10);
          const n2 = noise(i * 0.05 + 20, j * 0.05 - t * 0.13);
          vx[id] += (n1 - 0.5) * force * dt * 60;
          vy[id] += (n2 - 0.5) * force * dt * 60;
          // Mild outward drift from portal while covering
          if (!dissolving) {
            const dx = i - ox;
            const dy = j - oy;
            const len = Math.hypot(dx, dy) + 0.001;
            vx[id] += (dx / len) * 0.08 * dt * 60;
            vy[id] += (dy / len) * 0.08 * dt * 60;
          }
          vx[id] *= 0.96;
          vy[id] *= 0.96;
        }
      }

      // Wandering plumes inject density (dark mode: more random motion)
      spawnAcc += dt;
      const spawnEvery = toDark ? 0.12 : 0.28;
      if (!dissolving && spawnAcc > spawnEvery) {
        spawnAcc = 0;
        spawnPlume(Math.random() > 0.45);
      }

      for (let p = plumes.length - 1; p >= 0; p--) {
        const pl = plumes[p];
        const wander =
          noise(pl.x * 0.2 + pl.seed, t * 0.4 + pl.seed) - 0.5;
        const wander2 =
          noise(pl.y * 0.2 + pl.seed * 2, t * 0.35) - 0.5;
        pl.vx += wander * (toDark ? 1.8 : 0.7) * dt * 60;
        pl.vy += wander2 * (toDark ? 1.8 : 0.7) * dt * 60;
        pl.vx *= 0.98;
        pl.vy *= 0.98;
        pl.x += pl.vx * dt * 60;
        pl.y += pl.vy * dt * 60;
        pl.life -= dt * (dissolving ? 1.6 : 0.55);

        if (
          pl.life <= 0 ||
          pl.x < -4 ||
          pl.y < -4 ||
          pl.x > gw + 4 ||
          pl.y > gh + 4
        ) {
          plumes.splice(p, 1);
          continue;
        }

        const rad = pl.r * (0.6 + pl.life * 0.5);
        const i0 = Math.max(1, Math.floor(pl.x - rad));
        const i1 = Math.min(gw - 2, Math.ceil(pl.x + rad));
        const j0 = Math.max(1, Math.floor(pl.y - rad));
        const j1 = Math.min(gh - 2, Math.ceil(pl.y + rad));
        const amp = (toDark ? 0.22 : 0.12) * Math.min(1, pl.life);
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const dd = Math.hypot(i - pl.x, j - pl.y) / rad;
            if (dd > 1) continue;
            const k = (1 - dd) * (1 - dd);
            dens[ix(i, j)] = Math.min(1.8, dens[ix(i, j)] + k * amp);
            vx[ix(i, j)] += pl.vx * k * 0.08;
            vy[ix(i, j)] += pl.vy * k * 0.08;
          }
        }
      }

      const decay = dissolving ? 0.97 : 0.994;
      for (let j = 1; j < gh - 1; j++) {
        for (let i = 1; i < gw - 1; i++) {
          const id = ix(i, j);
          const sx = i - vx[id] * 0.55;
          const sy = j - vy[id] * 0.55;
          densTmp[id] = sample(dens, sx, sy) * decay;
        }
      }
      // Soft edge clamp — avoid hard zero border flicker at corners
      for (let i = 0; i < gw; i++) {
        densTmp[ix(i, 0)] = densTmp[ix(i, 1)] * 0.9;
        densTmp[ix(i, gh - 1)] = densTmp[ix(i, gh - 2)] * 0.9;
      }
      for (let j = 0; j < gh; j++) {
        densTmp[ix(0, j)] = densTmp[ix(1, j)] * 0.9;
        densTmp[ix(gw - 1, j)] = densTmp[ix(gw - 2, j)] * 0.9;
      }

      const swap = dens;
      dens = densTmp;
      densTmp = swap;
    };

    let last = performance.now();
    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - t0) * 0.001;
      step(t, dt);
      paintSmoke(t);
      raf = requestAnimationFrame(loop);
    };
    if (!reduce) raf = requestAnimationFrame(loop);
    else paintSmoke(0);

    const state = { r: START_R, fog: 1, veil: 1, boost: 1.05 };
    committed.current = false;

    const cleanupFlag = () => {
      document.documentElement.removeAttribute("data-theme-transitioning");
    };

    const tl = gsap.timeline({
      onComplete: () => {
        alive = false;
        cancelAnimationFrame(raf);
        cleanupFlag();
        onComplete();
      },
    });

    if (reduce) {
      applyRadius(maxR);
      onThemeReady(to);
      committed.current = true;
      tl.to(root, {
        opacity: 0,
        duration: 0.25,
        onComplete: cleanupFlag,
      });
      return () => {
        alive = false;
        tl.kill();
        cancelAnimationFrame(raf);
        cleanupFlag();
      };
    }

    tl.to(state, {
      r: maxR,
      duration: 1.4,
      ease: "power2.inOut",
      onUpdate: () => {
        portalR = state.r;
        applyRadius(state.r);
      },
    });

    tl.add(() => {
      portalR = maxR + 80;
      applyRadius(portalR);
      if (!committed.current) {
        committed.current = true;
        onThemeReady(to);
      }
      dissolving = true;
    });

    tl.to(state, {
      fog: 0,
      boost: 0.12,
      duration: 1.2,
      ease: "power1.out",
      onUpdate: () => {
        fogAmount = state.fog;
        coverBoost = state.boost;
      },
    });

    tl.to(
      state,
      {
        veil: 0,
        duration: 0.75,
        ease: "power2.inOut",
        onUpdate: () => {
          veil.style.opacity = String(state.veil);
          root.style.opacity = String(0.2 + state.veil * 0.8);
        },
      },
      "-=0.5",
    );

    return () => {
      alive = false;
      tl.kill();
      cancelAnimationFrame(raf);
      cleanupFlag();
    };
  }, [transition, onThemeReady, onComplete]);

  return (
    <div
      ref={rootRef}
      className="theme-portal-overlay pointer-events-none fixed inset-0 z-[200]"
      aria-hidden
    >
      <div ref={veilRef} className="absolute inset-0" />
      <canvas ref={fogRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
