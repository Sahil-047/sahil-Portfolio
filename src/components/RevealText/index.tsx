"use client";

import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type RevealTextProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
};

const UNDER_ROOT_ID = "fluid-text-under";

/**
 * Dark glyphs in the page layer (hard-punched out of holes).
 * White clone portaled under the veil — positioned to the inner text box
 * for pixel alignment (avoids padding/class double-offset ghosting).
 */
export default function RevealText({
  as: Tag = "span",
  className = "",
  children,
}: RevealTextProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const baseRef = useRef<HTMLSpanElement | null>(null);
  const underRef = useRef<HTMLSpanElement | null>(null);
  const [underRoot, setUnderRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setUnderRoot(document.getElementById(UNDER_ROOT_ID));

    let raf = 0;
    const sync = () => {
      const base = baseRef.current;
      const under = underRef.current;
      if (base && under) {
        const r = base.getBoundingClientRect();
        // left/top (not only transform) — subpixel-stable vs dark glyphs
        under.style.left = `${r.left}px`;
        under.style.top = `${r.top}px`;
        under.style.width = `${r.width}px`;
        under.style.height = `${r.height}px`;
        under.style.transform = "none";
      }
      raf = requestAnimationFrame(sync);
    };

    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <Tag
        ref={rootRef as never}
        className={`reveal-root relative inline-block ${className}`.trim()}
      >
        <span ref={baseRef} className="reveal-base">
          {children}
        </span>
      </Tag>

      {underRoot &&
        createPortal(
          <span
            ref={underRef}
            className="reveal-fluid-overlay reveal-fluid-overlay--under pointer-events-none fixed select-none"
            style={{ left: 0, top: 0, width: 0, height: 0 }}
            aria-hidden
          >
            {/* Mirror typography without outer padding/margin (already in rect) */}
            <span className={`reveal-fluid-overlay__inner ${className}`.trim()}>
              <span className="reveal-fluid-overlay__rgb reveal-fluid-overlay__rgb--r">
                {children}
              </span>
              <span className="reveal-fluid-overlay__rgb reveal-fluid-overlay__rgb--c">
                {children}
              </span>
              <span className="reveal-fluid-overlay__core">{children}</span>
            </span>
          </span>,
          underRoot,
        )}
    </>
  );
}
