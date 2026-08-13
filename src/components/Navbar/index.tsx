"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import RevealText from "@/components/RevealText";
import { useTheme } from "@/components/ThemeProvider";

type NavbarProps = {
  active?: "info" | null;
  onInfoClick?: () => void;
  onContactClick?: () => void;
};

const navTextClass =
  "inline-block whitespace-nowrap font-[family-name:var(--font-body)] text-[clamp(1.05rem,2vw,0.65rem)] font-semibold leading-none tracking-[-0.05em]";

const UNDER_ROOT_ID = "fluid-text-under";

function ThemeIcon({ isDark }: { isDark: boolean }) {
  const uid = useId();
  const maskId = `nav-moon-mask-${uid.replace(/:/g, "")}`;

  if (isDark) {
    return (
      <svg
        viewBox="0 0 64 64"
        width="14"
        height="14"
        aria-hidden="true"
        focusable="false"
        className="block"
      >
        <circle cx="32" cy="32" r="14" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="4" strokeLinecap="round">
          <line x1="32" y1="4" x2="32" y2="12" />
          <line x1="32" y1="52" x2="32" y2="60" />
          <line x1="4" y1="32" x2="12" y2="32" />
          <line x1="52" y1="32" x2="60" y2="32" />
          <line x1="12.5" y1="12.5" x2="18" y2="18" />
          <line x1="46" y1="46" x2="51.5" y2="51.5" />
          <line x1="12.5" y1="51.5" x2="18" y2="46" />
          <line x1="46" y1="18" x2="51.5" y2="12.5" />
        </g>
      </svg>
    );
  }

  // Crescent optically centered so scale elevate doesn't look like XY drift
  return (
    <svg
      viewBox="-8 -8 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
      className="block"
    >
      <defs>
        <mask id={maskId}>
          <rect x="-8" y="-8" width="16" height="16" fill="black" />
          <circle r="5.25" fill="white" />
          <circle cx="2.85" cy="-1.1" r="4.6" fill="black" />
        </mask>
      </defs>
      <circle
        r="5.25"
        fill="currentColor"
        mask={`url(#${maskId})`}
        transform="rotate(-18)"
      />
    </svg>
  );
}

function ThemeToggleButton() {
  const { isDark, toggleTheme } = useTheme();
  const slotRef = useRef<HTMLSpanElement | null>(null);
  const underRef = useRef<HTMLSpanElement | null>(null);
  const [underRoot, setUnderRoot] = useState<HTMLElement | null>(null);
  const [hot, setHot] = useState(false);

  useEffect(() => {
    setUnderRoot(document.getElementById(UNDER_ROOT_ID));
  }, []);

  // Sync white underlay to the untransformed slot only — never to the scaled lift
  useEffect(() => {
    let raf = 0;
    const sync = () => {
      const slot = slotRef.current;
      const under = underRef.current;
      if (slot && under) {
        const r = slot.getBoundingClientRect();
        under.style.left = `${r.left}px`;
        under.style.top = `${r.top}px`;
        under.style.width = `${r.width}px`;
        under.style.height = `${r.height}px`;
      }
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-pressed={isDark}
        onPointerEnter={() => setHot(true)}
        onPointerLeave={() => setHot(false)}
        onFocus={() => setHot(true)}
        onBlur={() => setHot(false)}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          toggleTheme({
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
          });
        }}
        data-fluid-portal
        data-hot={hot ? "true" : undefined}
        className="nav-theme-toggle ml-0.5 flex size-[1.05rem] shrink-0 cursor-default items-center justify-center"
      >
        {/* Slot is never transformed — underlay measures this box */}
        <span
          ref={slotRef}
          className="nav-theme-toggle__slot relative grid size-full place-items-center"
        >
          <span
            className={`nav-theme-toggle__lift${hot ? " is-hot" : ""}`}
          >
            <ThemeIcon isDark={isDark} />
          </span>
        </span>
      </button>

      {underRoot &&
        createPortal(
          <span
            ref={underRef}
            className={`nav-theme-toggle__under pointer-events-none fixed z-0 grid place-items-center select-none${
              hot ? " is-hot" : ""
            }`}
            style={{ left: 0, top: 0, width: 0, height: 0 }}
            aria-hidden
          >
            <ThemeIcon isDark={isDark} />
          </span>,
          underRoot,
        )}
    </>
  );
}

export default function Navbar({
  active = null,
  onInfoClick,
  onContactClick,
}: NavbarProps) {
  return (
    <nav
      aria-label="Primary"
      className="relative flex items-center gap-3 px-1"
    >
      <button
        type="button"
        onClick={onInfoClick}
        aria-current={active === "info" ? "page" : undefined}
        className="cursor-pointer leading-none"
      >
        <RevealText
          className={`${navTextClass}${
            active === "info"
              ? " underline decoration-1 underline-offset-[0.2em]"
              : ""
          }`}
        >
          Info,
        </RevealText>
      </button>
      <button
        type="button"
        onClick={onContactClick}
        className="cursor-pointer leading-none"
      >
        <RevealText className={navTextClass}>Contact</RevealText>
      </button>
      <ThemeToggleButton />
    </nav>
  );
}
