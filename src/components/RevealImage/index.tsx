"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const UNDER_ROOT_ID = "fluid-text-under";

type RevealImageProps = {
  src: string;
  className?: string;
};

/**
 * Grainy B&W in the page layer (punched by fluid holes).
 * Full-color clone under the veil — revealed through the portal.
 */
export default function RevealImage({ src, className = "" }: RevealImageProps) {
  const baseRef = useRef<HTMLImageElement | null>(null);
  const underRef = useRef<HTMLDivElement | null>(null);
  const [underRoot, setUnderRoot] = useState<HTMLElement | null>(null);
  const [hot, setHot] = useState(false);

  useEffect(() => {
    setUnderRoot(document.getElementById(UNDER_ROOT_ID));

    let raf = 0;
    const sync = () => {
      const base = baseRef.current;
      const under = underRef.current;
      if (base && under) {
        // Measure the untransformed card so hover scale doesn't shift the underlay
        const slot = base.parentElement ?? base;
        const r = slot.getBoundingClientRect();
        under.style.left = `${r.left}px`;
        under.style.top = `${r.top}px`;
        under.style.width = `${r.width}px`;
        under.style.height = `${r.height}px`;
        const clip = getComputedStyle(slot).clipPath;
        under.style.clipPath = clip && clip !== "none" ? clip : "";
      }
      raf = requestAnimationFrame(sync);
    };

    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const card = baseRef.current?.parentElement;
    if (!card) return;
    const enter = () => setHot(true);
    const leave = () => setHot(false);
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointerleave", leave);
    return () => {
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={baseRef}
        src={src}
        alt=""
        className={`project-carousel__card-img ${className}`.trim()}
        draggable={false}
      />
      <span className="project-carousel__card-grain" aria-hidden />

      {underRoot &&
        createPortal(
          <div
            ref={underRef}
            className={`reveal-fluid-image pointer-events-none fixed overflow-hidden${
              hot ? " is-hot" : ""
            }`}
            style={{ left: 0, top: 0, width: 0, height: 0 }}
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className="reveal-fluid-image__color absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
          </div>,
          underRoot,
        )}
    </>
  );
}
