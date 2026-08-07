"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import RevealText from "@/components/RevealText";

gsap.registerPlugin(useGSAP);

type NavbarProps = {
  onInfoClick?: () => void;
  onContactClick?: () => void;
};

export default function Navbar({ onInfoClick, onContactClick }: NavbarProps) {
  const navRef = useRef<HTMLElement>(null);
  const blobRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const nav = navRef.current;
      const blob = blobRef.current;
      if (!nav || !blob) return;

      const items = gsap.utils.toArray<HTMLElement>(".nav-fluid-item", nav);
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      gsap.set(blob, {
        xPercent: -50,
        yPercent: -50,
        scale: 0,
        opacity: 0,
      });

      if (reduced) return;

      const xTo = gsap.quickTo(blob, "x", {
        duration: 0.6,
        ease: "power3.out",
      });
      const yTo = gsap.quickTo(blob, "y", {
        duration: 0.6,
        ease: "power3.out",
      });

      const onMove = (e: MouseEvent) => {
        const rect = nav.getBoundingClientRect();
        xTo(e.clientX - rect.left);
        yTo(e.clientY - rect.top);
      };

      const onEnter = () => {
        gsap.to(blob, {
          opacity: 1,
          scale: 1,
          duration: 0.45,
          ease: "power3.out",
          overwrite: "auto",
        });
      };

      const onLeave = () => {
        gsap.to(blob, {
          opacity: 0,
          scale: 0.35,
          duration: 0.4,
          ease: "power2.inOut",
          overwrite: "auto",
        });
        gsap.to(items, {
          x: 0,
          y: 0,
          duration: 0.4,
          ease: "power3.out",
        });
      };

      const cleanups = items.map((el) => {
        const onItemMove = (e: MouseEvent) => {
          const r = el.getBoundingClientRect();
          const mx = (e.clientX - r.left) / r.width - 0.5;
          const my = (e.clientY - r.top) / r.height - 0.5;
          gsap.to(el, {
            x: mx * 7,
            y: my * 5,
            duration: 0.35,
            ease: "power2.out",
            overwrite: "auto",
          });
        };

        const onItemLeave = () => {
          gsap.to(el, {
            x: 0,
            y: 0,
            duration: 0.5,
            ease: "power3.out",
            overwrite: "auto",
          });
        };

        el.addEventListener("mousemove", onItemMove);
        el.addEventListener("mouseleave", onItemLeave);
        return () => {
          el.removeEventListener("mousemove", onItemMove);
          el.removeEventListener("mouseleave", onItemLeave);
        };
      });

      nav.addEventListener("mousemove", onMove);
      nav.addEventListener("mouseenter", onEnter);
      nav.addEventListener("mouseleave", onLeave);

      return () => {
        nav.removeEventListener("mousemove", onMove);
        nav.removeEventListener("mouseenter", onEnter);
        nav.removeEventListener("mouseleave", onLeave);
        cleanups.forEach((fn) => fn());
      };
    },
    { scope: navRef },
  );

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      className="relative flex items-center gap-3 overflow-visible px-2 py-3 font-[family-name:var(--font-body)] text-[clamp(0.8rem,1.4vw,0.95rem)] font-medium tracking-[-0.02em]"
    >
      <span
        ref={blobRef}
        aria-hidden
        className="nav-fluid-blob pointer-events-none absolute top-0 left-0 z-0 size-28 rounded-full sm:size-36"
      />

      <button
        type="button"
        onClick={onInfoClick}
        className="nav-fluid-item relative z-10 cursor-pointer"
      >
        <RevealText>Info,</RevealText>
      </button>
      <button
        type="button"
        onClick={onContactClick}
        className="nav-fluid-item relative z-10 cursor-pointer"
      >
        <RevealText>Contact</RevealText>
      </button>
      <button
        type="button"
        aria-label="Toggle theme"
        className="nav-fluid-item relative z-10 ml-1 flex size-7 cursor-pointer items-center justify-center text-neutral-900 sm:size-8"
      >
        <svg
          viewBox="0 0 64 64"
          width="18"
          height="18"
          aria-hidden="true"
          focusable="false"
          className="block"
        >
          <defs>
            <mask id="nav-moon-mask">
              <rect width="64" height="64" fill="black" />
              <circle cx="32" cy="32" r="22" fill="white" />
              <circle cx="44" cy="22" r="18" fill="black" />
            </mask>
          </defs>
          <circle
            cx="32"
            cy="32"
            r="22"
            fill="currentColor"
            mask="url(#nav-moon-mask)"
          />
        </svg>
      </button>
    </nav>
  );
}
