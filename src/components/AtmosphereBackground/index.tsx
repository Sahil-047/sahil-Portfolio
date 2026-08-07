"use client";

/**
 * Soft right-side blue bloom + RGB film grain (no 3D moon).
 * Matches the cinematic atmosphere reference — CSS only.
 */
export default function AtmosphereBackground() {
  return (
    <div className="galaxy-rgb pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div className="galaxy-rgb__base" />
      <div className="galaxy-rgb__glow galaxy-rgb__glow--core" />
      <div className="galaxy-rgb__glow galaxy-rgb__glow--halo" />
      <div className="galaxy-rgb__glow galaxy-rgb__glow--wash" />
      <div className="galaxy-rgb__mist" />
      <div className="galaxy-rgb__grain galaxy-rgb__grain--r" />
      <div className="galaxy-rgb__grain galaxy-rgb__grain--g" />
      <div className="galaxy-rgb__grain galaxy-rgb__grain--b" />
      <div className="galaxy-rgb__grain galaxy-rgb__grain--mono" />
    </div>
  );
}
