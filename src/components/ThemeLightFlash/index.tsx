"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

type ThemeLightFlashProps = {
  id: number;
  x: number;
  y: number;
  onThemeReady: () => void;
  onComplete: () => void;
};

const START_R = 16;

/** One wipe per transition id (survives Strict Mode remounts) */
let playingId: number | null = null;

/**
 * Dark → light: solid white expands once from the theme toggle corner.
 * DOM node is created on document.body so React remounts don't replay it.
 */
export default function ThemeLightFlash({
  id,
  x,
  y,
  onThemeReady,
  onComplete,
}: ThemeLightFlashProps) {
  const readyRef = useRef(onThemeReady);
  const completeRef = useRef(onComplete);
  readyRef.current = onThemeReady;
  completeRef.current = onComplete;

  useEffect(() => {
    if (playingId === id) return;
    playingId = id;

    document.documentElement.setAttribute("data-theme-transitioning", "true");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.createElement("div");
    root.setAttribute("aria-hidden", "true");
    root.className = "pointer-events-none fixed inset-0 z-[200]";
    root.style.background = "#ffffff";
    root.style.opacity = "1";
    document.body.appendChild(root);

    const cleanupFlag = () => {
      document.documentElement.removeAttribute("data-theme-transitioning");
    };

    const removeRoot = () => {
      if (root.parentNode) root.parentNode.removeChild(root);
    };

    const w = window.innerWidth;
    const h = window.innerHeight;
    const maxR =
      Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) + 80;

    const applyClip = (r: number) => {
      const clip = `circle(${Math.max(0, r)}px at ${x}px ${y}px)`;
      root.style.clipPath = clip;
      (
        root.style as CSSStyleDeclaration & { webkitClipPath: string }
      ).webkitClipPath = clip;
    };

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      readyRef.current();
    };

    const finish = () => {
      if (playingId === id) playingId = null;
      cleanupFlag();
      removeRoot();
      completeRef.current();
    };

    applyClip(reduce ? maxR : START_R);

    if (reduce) {
      applyClip(maxR);
      commit();
      gsap.to(root, {
        opacity: 0,
        duration: 0.25,
        onComplete: finish,
      });
      return;
    }

    const state = { r: START_R };
    gsap.timeline({ onComplete: finish })
      .to(state, {
        r: maxR,
        duration: 0.95,
        ease: "power3.inOut",
        onUpdate: () => applyClip(state.r),
      })
      .add(() => {
        root.style.clipPath = "none";
        (
          root.style as CSSStyleDeclaration & { webkitClipPath: string }
        ).webkitClipPath = "none";
        commit();
      })
      .to({}, { duration: 0.14 })
      .to(root, {
        opacity: 0,
        duration: 0.5,
        ease: "power2.out",
      });

    // No cleanup kill — body node owns the single wipe for this id
  }, [id, x, y]);

  return null;
}
