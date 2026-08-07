"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import LoaderBackground from "./LoaderBackground";
import LoaderIcon from "./LoaderIcon";

gsap.registerPlugin(useGSAP);

type LoaderProps = {
  onComplete: () => void;
};

/** Diagonal ends matching croissant.mp4 lunar path (top-right ↔ bottom-left). */
const SHADOW_TR = { cx: 50, cy: 14 };
const SHADOW_BL = { cx: 14, cy: 50 };

function setShadowPos(
  shadow: Element,
  t: number,
) {
  const cx = gsap.utils.interpolate(SHADOW_TR.cx, SHADOW_BL.cx, t);
  const cy = gsap.utils.interpolate(SHADOW_TR.cy, SHADOW_BL.cy, t);
  shadow.setAttribute("cx", String(cx));
  shadow.setAttribute("cy", String(cy));
}

export default function Loader({ onComplete }: LoaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      const content = contentRef.current;
      const percentEl = percentRef.current;
      if (!root || !content || !percentEl) return;

      const shadow = root.querySelector(".loader__moon-shadow");

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reducedMotion) {
        percentEl.textContent = "100%";
        gsap.to(root, {
          opacity: 0,
          duration: 0.4,
          onComplete,
        });
        return;
      }

      const phase = { t: 0.08 }; // start near TR crescent
      if (shadow) setShadowPos(shadow, phase.t);

      // Softer, slower lunar cycle driven by a float (smoother than attr tweening)
      const moonPhase = shadow
        ? gsap.to(phase, {
            t: 1,
            duration: 2.1,
            ease: "power1.inOut",
            yoyo: true,
            repeat: -1,
            onUpdate: () => setShadowPos(shadow, phase.t),
          })
        : null;

      const counter = { value: 0 };

      const tl = gsap.timeline({ onComplete });

      tl.fromTo(
        content,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: "power1.out" },
      );

      tl.to(
        counter,
        {
          value: 100,
          duration: 4,
          ease: "power1.inOut",
          onUpdate: () => {
            percentEl.textContent = `${Math.round(counter.value)}%`;
          },
        },
        0.15,
      );

      // Finish toward full cover from wherever the phase currently is
      tl.add(() => {
        moonPhase?.kill();
        if (shadow) {
          gsap.to(phase, {
            t: 0.5, // center = fully covered
            duration: 0.85,
            ease: "power1.inOut",
            onUpdate: () => setShadowPos(shadow, phase.t),
          });
        }
      });

      tl.to(
        content,
        {
          opacity: 0,
          duration: 0.55,
          ease: "power1.inOut",
        },
        "+=0.85",
      ).to(
        root,
        {
          opacity: 0,
          duration: 0.65,
          ease: "power1.inOut",
        },
        "-=0.25",
      );
    },
    { scope: rootRef },
  );

  return (
    <div
      ref={rootRef}
      className="loader"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
    >
      <LoaderBackground />
      <div ref={contentRef} className="loader__content">
        <LoaderIcon className="loader__icon" />
        <span ref={percentRef} className="loader__percent">
          0%
        </span>
      </div>
    </div>
  );
}
