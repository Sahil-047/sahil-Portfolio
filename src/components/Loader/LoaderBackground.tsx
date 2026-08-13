"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Dark-mode loading atmosphere: deep blue void, stars, drifting smoke.
 */
function dismissBootScreen() {
  document.getElementById("boot-screen")?.remove();
}

export default function LoaderBackground() {
  const starsRef = useRef<HTMLCanvasElement | null>(null);
  const smokeRef = useRef<HTMLCanvasElement | null>(null);

  // Stars
  useLayoutEffect(() => {
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
      ctx.fillStyle = "#060b18";
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        const a = reduce ? s.a : s.a * (0.7 + 0.3 * Math.sin(t * 1.2 + s.tw));
        ctx.fillStyle = `rgba(220,235,255,${a})`;
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      stars.length = 0;
      // ~3× denser field than before (/2800 → /900)
      const total = Math.floor((w * h) / 900);
      for (let i = 0; i < total; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() < 0.55 ? 1 : Math.random() < 0.88 ? 1.5 : 2.2,
          a: 0.45 + Math.random() * 0.55,
          tw: Math.random() * Math.PI * 2,
        });
      }
      paint(0);
    };
    resize();
    window.addEventListener("resize", resize);
    dismissBootScreen();

    const loop = (now: number) => {
      frame++;
      if (reduce) return;
      if (frame < 8) {
        raf = requestAnimationFrame(loop);
        return;
      }
      if (frame % 4 === 0) paint((now - t0) * 0.001);
      raf = requestAnimationFrame(loop);
    };
    if (!reduce) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Smoke
  useLayoutEffect(() => {
    const canvas = smokeRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let gw = 96;
    let gh = 54;
    let amb = new Float32Array(gw * gh);
    let tmp = new Float32Array(gw * gh);
    let viewW = 1;
    let viewH = 1;
    let raf = 0;
    let frame = 0;
    const t0 = performance.now();

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

    const ambientTarget = (i: number, j: number, t: number) => {
      const u = i / gw;
      const v = j / gh;
      const diag = (u + (1 - v)) * 0.5;
      const across = u - (1 - v);
      const wobble =
        Math.sin(diag * 12 + t * 0.85) * 0.14 +
        Math.sin(across * 15 - t * 1.05) * 0.12;
      // Wide bands + full-frame base so edges/corners stay filled (no vignette)
      const band =
        Math.exp(-Math.pow((across - wobble * 0.35) * 1.55, 2)) * 0.72 +
        Math.exp(-Math.pow((across - 0.35 - wobble * 0.25) * 1.8, 2)) * 0.58 +
        Math.exp(-Math.pow((across + 0.3 - wobble * 0.2) * 1.95, 2)) * 0.5 +
        Math.exp(-Math.pow((across + 0.55 - wobble * 0.15) * 2.2, 2)) * 0.38;
      const flow =
        fbm(diag * 3.2 - t * 0.22, across * 2.6 + t * 0.18) * 0.72 +
        fbm(u * 2.4 + t * 0.12, v * 2.1 - t * 0.1) * 0.55 +
        fbm(u * 4.1 - t * 0.08, v * 3.6 + t * 0.14) * 0.32;
      // Soft sheet across the whole frame (corners included)
      const sheet =
        0.42 +
        fbm(u * 1.6 + t * 0.06, v * 1.4 - t * 0.05) * 0.38 +
        fbm((1 - u) * 1.8 - t * 0.04, (1 - v) * 1.5 + t * 0.07) * 0.28;
      return Math.min(1.2, sheet * 0.75 + band * 0.7 + flow * 0.55);
    };

    const resize = () => {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(viewW * dpr);
      canvas.height = Math.floor(viewH * dpr);
      canvas.style.width = `${viewW}px`;
      canvas.style.height = `${viewH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gw = Math.max(64, Math.floor(viewW / 14));
      gh = Math.max(36, Math.floor(viewH / 14));
      amb = new Float32Array(gw * gh);
      tmp = new Float32Array(gw * gh);
      buf.width = gw;
      buf.height = gh;
      img = bctx.createImageData(gw, gh);
      // Seed full frame so first paint isn't edge-dark
      for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
          amb[ix(i, j)] = ambientTarget(i, j, 0);
        }
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const step = (t: number) => {
      // Include border cells so blur never reveals a dark vignette ring
      for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
          const id = ix(i, j);
          const target = ambientTarget(i, j, t);
          amb[id] += (target - amb[id]) * 0.05;
          const jig = (fbm(i * 0.08 + t * 0.3, j * 0.08 - t * 0.25) - 0.5) * 0.8;
          const si = Math.min(gw - 1, Math.max(0, (i + jig) | 0));
          const sj = Math.min(gh - 1, Math.max(0, (j - 0.25 - jig * 0.5) | 0));
          tmp[id] = amb[ix(si, sj)] * 0.97 + amb[id] * 0.03;
        }
      }
      amb.set(tmp);
    };

    const render = (t: number) => {
      const data = img.data;
      data.fill(0);
      for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
          const dens = Math.min(1.55, amb[ix(i, j)] * 1.35);
          if (dens < 0.015) continue;
          const n =
            noise(i * 0.08 + t * 0.1, j * 0.08 - t * 0.08) * 0.42;
          const d = Math.min(1.7, dens + n);
          const p = (j * gw + i) * 4;
          data[p] = 36 + d * 42;
          data[p + 1] = 52 + d * 58;
          data[p + 2] = 90 + d * 78;
          data[p + 3] = Math.min(220, 48 + d * 155);
        }
      }
      bctx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, viewW, viewH);
      ctx.imageSmoothingEnabled = true;
      ctx.filter = "blur(22px)";
      ctx.globalAlpha = 0.95;
      ctx.drawImage(buf, 0, 0, viewW, viewH);
      ctx.filter = "blur(10px)";
      ctx.globalAlpha = 0.55;
      ctx.drawImage(buf, 0, 0, viewW, viewH);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
    };

    render(0);
    dismissBootScreen();

    if (reduce) {
      return () => window.removeEventListener("resize", resize);
    }

    const animate = (now: number) => {
      const t = (now - t0) * 0.001;
      frame++;
      // Hold the first painted frame so the sim doesn't pop
      if (frame < 3) {
        raf = requestAnimationFrame(animate);
        return;
      }
      step(t);
      if (frame % 2 === 0) render(t);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="loader__background" aria-hidden="true">
      <canvas ref={starsRef} className="loader__stars" />
      <div className="loader__haze" />
      <canvas ref={smokeRef} className="loader__smoke" />
      <div className="loader__grain" />
    </div>
  );
}
