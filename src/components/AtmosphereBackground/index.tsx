"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Dark atmosphere under the white veil (always visible through fluid holes).
 * In dark theme, smoke also paints on the front overlay host.
 */
export default function AtmosphereBackground() {
  const { isDark } = useTheme();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const starsRef = useRef<HTMLCanvasElement | null>(null);
  const smokeBackRef = useRef<HTMLCanvasElement | null>(null);
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
      ctx.fillStyle = "#010206";
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
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const count = Math.floor((w * h) / (mobile ? 14000 : 9000));
      const darkCount = Math.floor((w * h) / (mobile ? 4800 : 2800));
      const total = isDark ? darkCount : count;
      for (let i = 0; i < total; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: isDark
            ? Math.random() < 0.7 ? 1 : Math.random() < 0.92 ? 1.5 : 2
            : Math.random() < 0.9 ? 1 : 1.5,
          a: isDark ? 0.35 + Math.random() * 0.6 : 0.25 + Math.random() * 0.55,
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
  }, [isDark]);

  // Optimized smoke: always under the veil (fluid reveal = dark world).
  // In dark theme, also blit to the front overlay host.
  useEffect(() => {
    const canvas = smokeBackRef.current;
    if (!canvas) return;

    const front = isDark ? smokeRef.current : null;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const frontCtx = front?.getContext("2d", { alpha: true }) ?? null;

    // Tiny grid â€” blit upscaled + CSS blur
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

    /** Diagonal ribbons BLâ†’TR â€” dense, slow drift & tangle */
    const ambientTarget = (i: number, j: number, t: number) => {
      const u = i / gw;
      const v = j / gh;
      const diag = (u + (1 - v)) * 0.5;
      const across = u - (1 - v);

      const wobble =
        Math.sin(diag * 12 + t * 0.85) * 0.14 +
        Math.sin(across * 15 - t * 1.05) * 0.12 +
        Math.sin(diag * 22 + across * 8 + t * 1.4) * 0.07;

      const band =
        Math.exp(-Math.pow((across - wobble * 0.35) * 2.4, 2)) * 0.55 +
        Math.exp(-Math.pow((across - 0.35 - wobble * 0.25) * 2.8, 2)) * 0.4 +
        Math.exp(-Math.pow((across + 0.3 - wobble * 0.2) * 3.1, 2)) * 0.32;

      const flow =
        fbm(diag * 3.2 - t * 0.22, across * 2.6 + t * 0.18) * 0.55 +
        fbm(u * 2.4 + t * 0.12, v * 2.1 - t * 0.1) * 0.35;

      const veil = Math.pow(Math.max(0, 1 - Math.abs(across) * 0.85), 1.2);
      return Math.min(0.85, (band * 0.55 + flow * 0.4) * (0.4 + veil * 0.55));
    };

    const resize = () => {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.15 : 1.5);
      canvas.width = Math.floor(viewW * dpr);
      canvas.height = Math.floor(viewH * dpr);
      canvas.style.width = `${viewW}px`;
      canvas.style.height = `${viewH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (front && frontCtx) {
        front.width = canvas.width;
        front.height = canvas.height;
        front.style.width = `${viewW}px`;
        front.style.height = `${viewH}px`;
        frontCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      gw = Math.max(mobile ? 40 : 64, Math.floor(viewW / (mobile ? 22 : 14)));
      gh = Math.max(mobile ? 24 : 36, Math.floor(viewH / (mobile ? 22 : 14)));
      amb = new Float32Array(gw * gh);
      splash = new Float32Array(gw * gh);
      vx = new Float32Array(gw * gh);
      vy = new Float32Array(gw * gh);
      ambTmp = new Float32Array(gw * gh);
      splashTmp = new Float32Array(gw * gh);
      buf.width = gw;
      buf.height = gh;
      img = bctx.createImageData(gw, gh);
    };

    const onPointer = (e: PointerEvent) => {
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.x = e.clientX / Math.max(1, viewW);
      pointer.y = e.clientY / Math.max(1, viewH);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });

    const step = (t: number) => {
      const dx = pointer.x - pointer.px;
      const dy = pointer.y - pointer.py;
      const spd = Math.hypot(dx, dy);
      pointer.px = pointer.x;
      pointer.py = pointer.y;

      const cx = Math.floor(pointer.x * (gw - 1));
      const cy = Math.floor(pointer.y * (gh - 1));
      const splashR = 5;
      if (spd > 0.0015) {
        for (let j = -splashR; j <= splashR; j++) {
          for (let i = -splashR; i <= splashR; i++) {
            const ii = cx + i;
            const jj = cy + j;
            if (ii < 1 || jj < 1 || ii >= gw - 1 || jj >= gh - 1) continue;
            const d = Math.hypot(i, j) / splashR;
            if (d > 1) continue;
            const k = (1 - d) * (1 - d);
            const id = ix(ii, jj);
            splash[id] = Math.min(2.8, splash[id] + k * spd * 42);
            vx[id] += dx * k * 18;
            vy[id] += dy * k * 18;
          }
        }
      }

      for (let j = 1; j < gh - 1; j++) {
        for (let i = 1; i < gw - 1; i++) {
          const id = ix(i, j);
          const target = ambientTarget(i, j, t);
          amb[id] += (target - amb[id]) * 0.045;
          vx[id] *= 0.965;
          vy[id] *= 0.965;

          const jig =
            (fbm(i * 0.08 + t * 0.3, j * 0.08 - t * 0.25) - 0.5) * 0.9;
          const si = i - vx[id] * 0.48 + jig;
          const sj = j - vy[id] * 0.48 - jig * 0.6;
          const i0 = Math.min(gw - 2, Math.max(1, si | 0));
          const j0 = Math.min(gh - 2, Math.max(1, sj | 0));
          splashTmp[ix(i, j)] = splash[ix(i0, j0)] * 0.94;
        }
      }
      splash.set(splashTmp);
    };

    const blit = (
      target: HTMLCanvasElement,
      targetCtx: CanvasRenderingContext2D,
    ) => {
      targetCtx.clearRect(0, 0, target.width, target.height);
      targetCtx.imageSmoothingEnabled = true;
      targetCtx.drawImage(buf, 0, 0, viewW, viewH);
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
          const dens = Math.min(1.2, base * 0.85 + sp * 1.1);
          if (dens < 0.022) continue;

          const dR = Math.min(
            1.2,
            base * 0.8 + splash[ix(Math.max(0, i - 1), j)] * 1.05,
          );
          const dB = Math.min(
            1.2,
            base * 0.8 + splash[ix(Math.min(gw - 1, i + 1), j)] * 1.05,
          );

          const edgeWob =
            0.9 +
            0.1 *
              Math.sin(u * 14 + t * 1.4 + v * 9) *
              Math.sin(v * 11 - t * 1.15 + u * 6);
          const densMul = edgeWob * 0.95;

          const aR = Math.min(1, dR * densMul);
          const aG = Math.min(1, dens * densMul);
          const aB = Math.min(1, dB * densMul);
          const a = Math.max(aR, aG, aB);
          if (a < 0.028) continue;

          const r = 28 + aR * 32;
          const g = 42 + aG * 48;
          const b = 72 + aB * 58;
          const alpha = Math.min(160, 28 + dens * 95 + Math.min(sp, 2.4) * 45);

          const p = (j * gw + i) * 4;
          data[p] = r;
          data[p + 1] = g;
          data[p + 2] = b;
          data[p + 3] = alpha;
        }
      }

      bctx.putImageData(img, 0, 0);
      blit(canvas, ctx);
      if (front && frontCtx) blit(front, frontCtx);
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
      if (mobile) {
        if (frame % 3 === 0) step(t);
        if (frame % 4 === 0) render(t);
      } else {
        step(t);
        if (frame % 2 === 0) render(t);
      }
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
        <canvas
          ref={smokeBackRef}
          className="galaxy-rgb__smoke-back"
          aria-hidden
        />
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
