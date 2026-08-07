"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { Application, SPEObject } from "@splinetool/runtime";
import { registerSunSpin } from "@/lib/sunMotion";

const Spline = dynamic(() => import("@splinetool/react-spline"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-neutral-950" aria-hidden />
  ),
});

export const SPLINE_SCENE =
  "https://prod.spline.design/YffX37hXsM1ustxM/scene.splinecode";

const SUN_SCALE = 2.6;
const ORBIT_RADIUS = 90;
const SPIN_GAIN = 0.008;

const SUN_NAMES = [
  "Sun",
  "sun",
  "SUN",
  "Sphere",
  "Ball",
  "Orb",
  "Star",
  "Glow",
  "Planet",
];

function listObjects(spline: Application): SPEObject[] {
  try {
    const all = spline.getAllObjects?.();
    if (Array.isArray(all)) return all.filter(Boolean);
  } catch {
    /* runtime may throw before scene graph is ready */
  }

  try {
    const data = spline.data as { scene?: { children?: unknown[] } } | undefined;
    const children = data?.scene?.children;
    if (Array.isArray(children)) {
      // Soft walk: only names we can resolve via findObjectByName
      return [];
    }
  } catch {
    /* ignore */
  }

  return [];
}

function findSun(spline: Application): SPEObject | undefined {
  for (const name of SUN_NAMES) {
    try {
      const obj = spline.findObjectByName?.(name);
      if (obj) return obj;
    } catch {
      /* continue */
    }
  }

  const all = listObjects(spline);
  const named = all.find((o) =>
    /sun|sphere|ball|orb|star|glow|planet/i.test(o?.name ?? ""),
  );
  if (named) return named;

  let best: SPEObject | undefined;
  let bestScore = 0;
  for (const o of all) {
    if (!o?.scale) continue;
    const score =
      Math.abs(o.scale.x) * Math.abs(o.scale.y) * Math.abs(o.scale.z);
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

/**
 * Full-viewport Spline scene under the fluid veil.
 * Sun enlarges / sits right; card scroll orbits it (object + CSS fallback).
 */
export default function SplineBackground() {
  const appRef = useRef<Application | null>(null);
  const sunRef = useRef<SPEObject | null>(null);
  const angleRef = useRef(0);
  const homeRef = useRef({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    return registerSunSpin((deltaY) => {
      const sun = sunRef.current;
      const app = appRef.current;
      if (!sun || !app) return;

      angleRef.current += deltaY * SPIN_GAIN;
      const a = angleRef.current;
      const home = homeRef.current;

      sun.position.x = home.x + Math.cos(a) * ORBIT_RADIUS;
      sun.position.y = home.y + Math.sin(a) * ORBIT_RADIUS;
      sun.rotation.y = a;
      sun.rotation.z = a * 0.65;

      app.requestRender?.();
    });
  }, []);

  const onLoad = (spline: Application) => {
    appRef.current = spline;
    try {
      spline.setBackgroundColor?.("#050505");
    } catch {
      /* optional */
    }

    try {
      (spline as Application & { renderMode?: string }).renderMode =
        "continuous";
    } catch {
      /* optional */
    }

    let sun: SPEObject | undefined;
    try {
      sun = findSun(spline);
    } catch (err) {
      console.warn("[SplineBackground] findSun failed:", err);
    }

    if (!sun) {
      // CSS --spline-spin orbit still runs from carousel scroll
      return;
    }

    sun.scale.x *= SUN_SCALE;
    sun.scale.y *= SUN_SCALE;
    sun.scale.z *= SUN_SCALE;
    if (typeof sun.intensity === "number" && sun.intensity > 0) {
      sun.intensity *= 1.6;
    }

    // Nudge toward the right so ~¾ reads from the right edge
    const bump = Math.max(Math.abs(sun.scale.x) * 28, 120);
    sun.position.x += bump;

    homeRef.current = {
      x: sun.position.x,
      y: sun.position.y,
      z: sun.position.z,
    };
    sunRef.current = sun;
    spline.requestRender?.();

    if (process.env.NODE_ENV === "development") {
      console.info(
        "[SplineBackground] Driving sun object:",
        sun.name,
        sun.uuid,
      );
    }
  };

  return (
    <div className="galaxy-rgb pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div className="galaxy-rgb__spline absolute inset-0">
        <Spline
          scene={SPLINE_SCENE}
          className="galaxy-rgb__spline-canvas"
          renderOnDemand={false}
          onLoad={onLoad}
        />
      </div>
      <div className="galaxy-rgb__grain" />
    </div>
  );
}
