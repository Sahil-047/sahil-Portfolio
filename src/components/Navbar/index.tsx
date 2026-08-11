"use client";

import { useId } from "react";
import RevealText from "@/components/RevealText";
import { useTheme } from "@/components/ThemeProvider";

type NavbarProps = {
  active?: "info" | null;
  onInfoClick?: () => void;
  onContactClick?: () => void;
};

const navTextClass =
  "inline-block whitespace-nowrap font-[family-name:var(--font-body)] text-[clamp(1.05rem,2vw,0.65rem)] font-semibold leading-none tracking-[-0.05em]";

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

  return (
    <svg
      viewBox="0 0 64 64"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
      className="block"
    >
      <defs>
        <mask id={maskId}>
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
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

export default function Navbar({
  active = null,
  onInfoClick,
  onContactClick,
}: NavbarProps) {
  const { isDark, toggleTheme } = useTheme();

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
      <button
        type="button"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-pressed={isDark}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          toggleTheme({
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
          });
        }}
        data-fluid-portal
        className="nav-theme-toggle group ml-0.5 flex size-[1.05rem] cursor-pointer items-center justify-center will-change-transform"
      >
        <RevealText className="flex items-center justify-center leading-none">
          <ThemeIcon isDark={isDark} />
        </RevealText>
      </button>
    </nav>
  );
}
