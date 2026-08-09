"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Optimized dark-mode atmosphere:
 * - ambient fog wanders randomly (capped, never piles up)
 * - mouse splash is temporary and clears quickly
 * - low-res sim + scaled blit (no dual full-res ImageData)
 */
export default function AtmosphereBackground() {
  const { isDark } = useTheme();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const starsRef = useRef<HTMLCanvasElement | null>(null);
  const smokeRef = useRef<HTMLCanvasElement | null>(null);
  const glitch = useRef({ px: 0, py: 0 });
  const [frontHost, setFrontHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById("smoke-front-root");
    if (el) {
      setFrontHost(el);
      return;
    }
    const id = window.setInterval(() => {
      const found = document.getElementById("smoke-front-root");
      if (found) {
        setFrontHost(found);
        window.clearInterval(id);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  // Grain RGB (throttled CSS vars)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let raf = 0;
    let tRx = -1.2,
      tRy = 0.4,
      tGx = 0.6,
      tGy = -0.8,
      tBx = 1.1,
      tBy = 0.7,
      tBoost = 0;
    let cRx = tRx,
      cRy = tRy,
      cGx = tGx,
      cGy = tGy,
      cBx = tBx,
      cBy = tBy,
      cBoost = 0;
    let frame = 0;

    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      const ny = (e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
      const dx = e.clientX - glitch.current.px;
      const dy = e.clientY - glitch.current.py;
      glitch.current.px = e.clientX;
      glitch.current.py = e.clientY;
      const speed = Math.min(1, Math.hypot(dx, dy) / 26);
      tRx = -1.2 - nx * 3.5 - speed * 3;
      tRy = 0.4 + ny * 2.2 + speed * 1.4;
      tGx = 0.6 + nx * 0.5;
      tGy = -0.8 - ny * 0.5;
      tBx = 1.1 + nx * 3.8 + speed * 3.2;
      tBy = 0.7 - ny * 2.5 - speed * 1.6;
      tBoost = speed;
    };

    const tick = () => {
      frame++;
      cRx += (tRx - cRx) * 0.18;
      cRy += (tRy - cRy) * 0.18;
      cGx += (tGx - cGx) * 0.18;
      cGy += (tGy - cGy) * 0.18;
      cBx += (tBx - cBx) * 0.18;
      cBy += (tBy - cBy) * 0.18;
      cBoost += (tBoost - cBoost) * 0.14;
      tBoost *= 0.9;
      if (frame % 2 === 0) {
        root.style.setProperty("--rgb-r-x", `${cRx.toFixed(2)}px`);
        root.style.setProperty("--rgb-r-y", `${cRy.toFixed(2)}px`);
        root.style.setProperty("--rgb-g-x", `${cGx.toFixed(2)}px`);
        root.style.setProperty("--rgb-g-y", `${cGy.toFixed(2)}px`);
        root.style.setProperty("--rgb-b-x", `${cBx.toFixed(2)}px`);
        root.style.setProperty("--rgb-b-y", `${cBy.toFixed(2)}px`);
        root.style.setProperty("--rgb-glitch", cBoost.toFixed(3));
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Stars — paint once, twinkle every few frames
  useEffect(() => {
    const canvas = starsRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const stars: { x: number; y: number; r: number; a: number; tw: number }[] =
      [];
    let raf = 0;
    let frame = 0;
    const t0 = performance.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const paint = (t: number) => {
      ctx.fillStyle = "#02040a";
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        const a = reduce ? s.a : s.a * (0.7 + 0.3 * Math.sin(t * 1.2 + s.tw));
        ctx.fillStyle = `rgba(220,235,255,${a})`;
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = w;
      canvas.height = h;
      stars.length = 0;
      const count = Math.floor((w * h) / 14000);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() < 0.9 ? 1 : 1.5,
          a: 0.25 + Math.random() * 0.55,
          tw: Math.random() * Math.PI * 2,
        });
      }
      paint((performance.now() - t0) * 0.001);
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = (now: number) => {
      frame++;
      if (!reduce && frame % 4 === 0) paint((now - t0) * 0.001);
      raf = requestAnimationFrame(loop);
    };
    if (!reduce) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Optimized smoke: ambient wander + ephemeral splash
  useEffect(() => {
    if (!isDark || !frontHost) return;
    const canvas = smokeRef.current;
    if (!canvas) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Tiny grid — blit upscaled + CSS blur
    let gw = 96;
    let gh = 54;
    let amb = new Float32Array(gw * gh);
    let splash = new Float32Array(gw * gh);
    let vx = new Float32Array(gw * gh);
    let vy = new Float32Array(gw * gh);
    let ambTmp = new Float32Array(gw * gh);
    let splashTmp = new Float32Array(gw * gh);

    let viewW = 1;
    let viewH = 1;
    let raf = 0;
    let frame = 0;
    const pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5 };
    const t0 = performance.now();

    // Offscreen buffer at grid size
    const buf = document.createElement("canvas");
    const bctx = buf.getContext("2d", { alpha: true });
    if (!bctx) return;
    let img = bctx.createImageData(gw, gh);

    const ix = (i: number, j: number) => i + j * gw;

    const hash = (x: number, y: number) => {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };

    const noise = (x: number, y: number) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const u = xf * xf * (3 - 2 * xf);
      const v = yf * yf * (3 - 2 * yf);
      const a = hash(xi, yi);
      const b = hash(xi + 1, yi);
      const c = hash(xi, yi + 1);
      const d = hash(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };

    const fbm = (x: number, y: number) => {
      let v = 0;
      let a = 0.5;
      let fx = x;
      let fy = y;
      for (let i = 0; i < 3; i++) {
        v += a * noise(fx, fy);
        fx *= 2.02;
        fy *= 2.02;
        a *= 0.5;
      }
      return v;
    };

    /** Diagonal ribbons BL→TR — dense, slow drift & tangle */
    const ambientTarget = (i: number, j: number, t: number) => {
      const u = i / gw;
      const v = j / gh;
      const diag = (u + (1 - v)) * 0.5;
      const across = u - (1 - v);

      const wobble =
        Math.sin(diag * 12 + t * 0.85) * 0.14 +
        Math.sin(across * 15 - t * 1.05) * 0.12 +
        Math.sin(diag * 22 + across * 8 + t * 1.4) * 0.07;

      const wx = u * 3.0 + t * 0.12 + Math.sin(v * 4 + t * 0.55) * 0.45;
      const wy = v * 2.7 - t * 0.11 + Math.cos(u * 3.5 + t * 0.65) * 0.4;
      const n = fbm(wx + wobble, wy - wobble);
      const n2 = fbm(wx * 1.7 - t * 0.08, wy * 1.6 + t * 0.09);

      // Wider overlapping strands = denser coverage
      const strandA = Math.exp(-Math.pow((across + wobble * 1.2) * 1.55, 2));
      const strandB = Math.exp(
        -Math.pow((across - 0.32 + Math.sin(t * 0.45 + diag * 5) * 0.18) * 1.65, 2),
      );
      const strandC = Math.exp(
        -Math.pow((across + 0.36 + Math.cos(t * 0.55 - diag * 4) * 0.2) * 1.5, 2),
      );
      const tangle = Math.min(1.35, strandA * 0.95 + strandB * 0.85 + strandC * 0.8);

      const along = 0.4 + 0.6 * Math.sin(diag * Math.PI);
      return Math.min(
        0.92,
        (0.18 + 1.05 * tangle * along) * (0.45 + 0.55 * n) * (0.75 + 0.25 * n2),
      );
    };

    const resize = () => {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      const aspect = viewW / Math.max(viewH, 1);
      gw = 96;
      gh = Math.max(40, Math.round(gw / aspect));
      amb = new Float32Array(gw * gh);
      splash = new Float32Array(gw * gh);
      vx = new Float32Array(gw * gh);
      vy = new Float32Array(gw * gh);
      ambTmp = new Float32Array(gw * gh);
      splashTmp = new Float32Array(gw * gh);
      buf.width = gw;
      buf.height = gh;
      img = bctx.createImageData(gw, gh);

      const t = 0;
      for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
          amb[ix(i, j)] = ambientTarget(i, j, t);
        }
      }

      // Display canvas stays modest; CSS scales + blurs
      const scale = 0.28;
      canvas.width = Math.max(1, Math.floor(viewW * scale));
      canvas.height = Math.max(1, Math.floor(viewH * scale));
    };
    resize();
    window.addEventListener("resize", resize);

    const splat = (nx: number, ny: number, dx: number, dy: number, amount: number) => {
      const cx = (nx * (gw - 1)) | 0;
      const cy = (ny * (gh - 1)) | 0;
      const rad = Math.max(5, (6 + amount * 8) | 0);
      const force = amount * 28; // slower splash push
      const inj = Math.min(3.2, amount * 5.2); // denser visible blob
      const t = (performance.now() - t0) * 0.001;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len;
      const py = dx / len;
      for (let j = -rad; j <= rad; j++) {
        for (let i = -rad; i <= rad; i++) {
          const x = cx + i;
          const y = cy + j;
          if (x < 1 || x >= gw - 1 || y < 1 || y >= gh - 1) continue;
          const d2 = i * i + j * j;
          if (d2 > rad * rad) continue;
          const fall = Math.exp(-d2 / (rad * rad * 0.62));
          const jig =
            Math.sin(i * 1.4 + j * 1.8 + t * 5.5) * 0.4 +
            Math.cos(i * 2.0 - j * 1.1 - t * 4.2) * 0.3;
          splash[ix(x, y)] = Math.min(3.2, splash[ix(x, y)] + inj * fall);
          vx[ix(x, y)] += (dx * force + px * jig * force * 0.7) * fall;
          vy[ix(x, y)] += (dy * force + py * jig * force * 0.7) * fall;
        }
      }
    };

    const onPointer = (e: PointerEvent) => {
      const nx = e.clientX / Math.max(viewW, 1);
      const ny = e.clientY / Math.max(viewH, 1);
      const dx = nx - pointer.px;
      const dy = ny - pointer.py;
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.x = nx;
      pointer.y = ny;
      if (reduce) return;
      const speed = Math.hypot(dx, dy);
      if (speed < 0.002) return;
      splat(nx, ny, dx, dy, Math.min(1.0, speed * 22));
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const step = (t: number) => {
      for (let j = 1; j < gh - 1; j++) {
        for (let i = 1; i < gw - 1; i++) {
          const u = i / gw;
          const v = j / gh;
          const across = u - (1 - v);
          const flowX = 0.12;
          const flowY = -0.1;
          const jigX =
            Math.sin(v * 12 + t * 1.8 + u * 5) * 0.16 +
            Math.sin(across * 16 - t * 2.2) * 0.13 +
            Math.cos(u * 8 + v * 9 + t * 1.5) * 0.1 +
            (fbm(u * 3 + t * 0.18, v * 3 - t * 0.14) - 0.5) * 0.18;
          const jigY =
            Math.cos(u * 11 - t * 1.9 + v * 6) * 0.15 +
            Math.sin(across * 14 + t * 2.0) * 0.12 +
            Math.sin(u * 9 - v * 10 + t * 1.6) * 0.09 +
            (fbm(u * 2.8 - 2 + t * 0.16, v * 2.8 + t * 0.15) - 0.5) * 0.16;
          const weave = Math.sin(across * 7 + t * 0.9) * 0.08;

          vx[ix(i, j)] = vx[ix(i, j)] * 0.93 + flowX + jigX + weave;
          vy[ix(i, j)] = vy[ix(i, j)] * 0.93 + flowY + jigY - weave * 0.35;
        }
      }

      for (let j = 1; j < gh - 1; j++) {
        for (let i = 1; i < gw - 1; i++) {
          const target = ambientTarget(i, j, t);
          let a = amb[ix(i, j)];
          a += (target - a) * 0.035;
          const wob =
            Math.sin(i * 0.35 + j * 0.3 + t * 2.8) * 0.28 +
            Math.cos(i * 0.25 - j * 0.4 - t * 2.2) * 0.2;
          const si = i - vx[ix(i, j)] * 0.42 + wob;
          const sj = j - vy[ix(i, j)] * 0.42 - wob * 0.55;
          const i0 = Math.min(gw - 2, Math.max(1, si | 0));
          const j0 = Math.min(gh - 2, Math.max(1, sj | 0));
          a = a * 0.78 + amb[ix(i0, j0)] * 0.22;
          ambTmp[ix(i, j)] = Math.min(0.95, Math.max(0, a));
        }
      }
      amb.set(ambTmp);

      for (let j = 1; j < gh - 1; j++) {
        for (let i = 1; i < gw - 1; i++) {
          const s = splash[ix(i, j)];
          if (s < 0.004) {
            splashTmp[ix(i, j)] = 0;
            continue;
          }
          const jig =
            Math.sin(i * 0.7 + t * 4.5) * 0.35 + Math.cos(j * 0.65 - t * 3.8) * 0.28;
          const si = i - vx[ix(i, j)] * 0.48 + jig;
          const sj = j - vy[ix(i, j)] * 0.48 - jig * 0.6;
          const i0 = Math.min(gw - 2, Math.max(1, si | 0));
          const j0 = Math.min(gh - 2, Math.max(1, sj | 0));
          splashTmp[ix(i, j)] = splash[ix(i0, j0)] * 0.94;
        }
      }
      splash.set(splashTmp);
    };

    const render = (t: number) => {
      const data = img.data;
      data.fill(0);

      for (let j = 0; j < gh; j++) {
        const v = j / gh;
        for (let i = 0; i < gw; i++) {
          const u = i / gw;
          const base = amb[ix(i, j)];
          const sp = splash[ix(i, j)];
          const dens = Math.min(1.7, base * 1.15 + sp * 1.45);
          if (dens < 0.018) continue;

          const dR = Math.min(1.7, base * 1.1 + splash[ix(Math.max(0, i - 1), j)] * 1.35);
          const dB = Math.min(1.7, base * 1.1 + splash[ix(Math.min(gw - 1, i + 1), j)] * 1.35);

          const edgeWob =
            0.9 +
            0.1 *
              Math.sin(u * 14 + t * 1.4 + v * 9) *
              Math.sin(v * 11 - t * 1.15 + u * 6);
          const densMul = edgeWob * 1.12;

          const aR = Math.min(1, dR * densMul);
          const aG = Math.min(1, dens * densMul);
          const aB = Math.min(1, dB * densMul);
          const a = Math.max(aR, aG, aB);
          if (a < 0.022) continue;

          const r = 40 + aR * 42;
          const g = 58 + aG * 62;
          const b = 92 + aB * 78;
          const alpha = Math.min(230, 50 + dens * 155 + Math.min(sp, 2.4) * 70);

          const p = (j * gw + i) * 4;
          data[p] = r;
          data[p + 1] = g;
          data[p + 2] = b;
          data[p + 3] = alpha;
        }
      }

      bctx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(buf, 0, 0, canvas.width, canvas.height);
    };

    if (reduce) {
      step(0);
      render(0);
      return () => {
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointer);
      };
    }

    const animate = (now: number) => {
      const t = (now - t0) * 0.001;
      frame++;
      step(t);
      if (frame % 2 === 0) render(t);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [isDark, frontHost]);

  return (
    <>
      <div
        ref={rootRef}
        className="galaxy-rgb pointer-events-none fixed inset-0 z-0"
        aria-hidden
      >
        <canvas ref={starsRef} className="galaxy-rgb__stars absolute inset-0 h-full w-full" />
        <div className="galaxy-rgb__base" />
        <div className="galaxy-rgb__haze" />
        <div className="galaxy-rgb__grain galaxy-rgb__grain--r" />
        <div className="galaxy-rgb__grain galaxy-rgb__grain--g" />
        <div className="galaxy-rgb__grain galaxy-rgb__grain--b" />
        <div className="galaxy-rgb__grain galaxy-rgb__grain--mono" />
      </div>

      {isDark && frontHost
        ? createPortal(
            <canvas
              ref={smokeRef}
              className="galaxy-rgb__smoke-front pointer-events-none absolute inset-0 z-[25]"
              aria-hidden
            />,
            frontHost,
          )
        : null}
    </>
  );
}
