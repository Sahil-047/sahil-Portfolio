"use client";

import { useEffect, useId, useRef } from "react";

type LoaderIconProps = {
  className?: string;
};

function MoonDisc({
  maskId,
  className,
  fill,
}: {
  maskId: string;
  className?: string;
  fill: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      width="64"
      height="64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask id={maskId}>
          <rect width="64" height="64" fill="black" />
          <circle cx="32" cy="32" r="24" fill="white" />
          {/*
            Single shadow disc — slides TR ↔ BL through the center
            (exact motion from croissant.mp4). Starts as the reference crescent.
          */}
          <circle
            className="loader__moon-shadow"
            cx="48"
            cy="16"
            r="16"
            fill="black"
          />
        </mask>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="20"
        fill={fill}
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

/**
 * Moon crescent with continuous RGB chromatic fringe + occasional glitch hits.
 */
export default function LoaderIcon({ className }: LoaderIconProps) {
  const uid = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const t0 = performance.now();

    const tick = (now: number) => {
      const t = (now - t0) * 0.001;
      // Soft continuous chromatic drift
      const drift = Math.sin(t * 2.4) * 0.55;
      const driftY = Math.cos(t * 1.7) * 0.35;

      // Burst glitch every ~1.6–2.4s
      const burstPhase = (t * 0.55) % 1;
      const burst =
        burstPhase > 0.86
          ? Math.sin(((burstPhase - 0.86) / 0.14) * Math.PI) *
            (1.2 + Math.sin(t * 37) * 0.8)
          : 0;
      const tear = burst * (Math.sin(t * 53) > 0 ? 1 : -1);

      const rx = (-1.1 + drift - tear * 1.8).toFixed(2);
      const ry = (0.2 + driftY + tear * 0.6).toFixed(2);
      const cx = (1.1 - drift + tear * 1.6).toFixed(2);
      const cy = (-0.25 - driftY - tear * 0.5).toFixed(2);
      const gx = (tear * 0.9).toFixed(2);
      const gy = ((Math.sin(t * 41) * burst) * 1.2).toFixed(2);

      root.style.setProperty("--moon-r-x", `${rx}px`);
      root.style.setProperty("--moon-r-y", `${ry}px`);
      root.style.setProperty("--moon-c-x", `${cx}px`);
      root.style.setProperty("--moon-c-y", `${cy}px`);
      root.style.setProperty("--moon-g-x", `${gx}px`);
      root.style.setProperty("--moon-g-y", `${gy}px`);
      root.style.setProperty("--moon-glitch", burst.toFixed(3));

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span
      ref={rootRef}
      className={`loader__moon-rgb${className ? ` ${className}` : ""}`}
    >
      <MoonDisc
        maskId={`${uid}-r`}
        className="loader__moon-rgb__layer loader__moon-rgb__layer--r"
        fill="#ff3d7a"
      />
      <MoonDisc
        maskId={`${uid}-c`}
        className="loader__moon-rgb__layer loader__moon-rgb__layer--c"
        fill="#3ad0ff"
      />
      <MoonDisc
        maskId={`${uid}-g`}
        className="loader__moon-rgb__layer loader__moon-rgb__layer--g"
        fill="#5dff9a"
      />
      <MoonDisc
        maskId={`${uid}-core`}
        className="loader__moon-rgb__layer loader__moon-rgb__layer--core"
        fill="currentColor"
      />
    </span>
  );
}
