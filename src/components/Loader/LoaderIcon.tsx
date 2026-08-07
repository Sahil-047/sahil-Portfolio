"use client";

import { useId } from "react";

type LoaderIconProps = {
  className?: string;
};

export default function LoaderIcon({ className }: LoaderIconProps) {
  const maskId = useId().replace(/:/g, "");

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
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
