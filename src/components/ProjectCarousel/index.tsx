"use client";

import { useEffect, useRef } from "react";

const PROJECTS = [
  { id: "estrela", label: "Estrela Studio" },
  { id: "yucca", label: "Yucca Packaging" },
  { id: "zulik", label: "Zulik" },
  { id: "payjustnow", label: "PayJustNow" },
  { id: "vineyard", label: "Vineyard Hotel" },
] as const;

/**
 * Vertical black-card strip beside Info/Contact (from page top).
 * Page stays fixed — wheel/trackpad anywhere drives this track.
 */
export default function ProjectCarousel() {
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onWheel = (e: WheelEvent) => {
      // Ignore pinch-zoom style ctrl+wheel
      if (e.ctrlKey) return;

      const max = track.scrollHeight - track.clientHeight;
      if (max <= 0) return;

      e.preventDefault();
      track.scrollTop = Math.min(max, Math.max(0, track.scrollTop + e.deltaY));
    };

    // Non-passive so we can prevent page/body scroll and own the gesture
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <aside
      className="project-carousel pointer-events-none absolute top-4 right-3 bottom-4 z-20 w-[min(42vw,28rem)] max-w-[calc(100%-1.5rem)] sm:top-5 sm:right-4 sm:bottom-5 sm:w-[min(38vw,26rem)]"
      aria-label="Projects"
    >
      <div
        ref={trackRef}
        className="project-carousel__track h-full overflow-y-auto overscroll-none mr-[calc(100%-50%)]"
        tabIndex={0}
        aria-hidden={false}
      >
        <ul className="m-0 flex list-none flex-col gap-4 p-0 sm:gap-5">
          {PROJECTS.map((project) => (
            <li key={project.id}>
              <article
                className="project-carousel__card pointer-events-auto relative aspect-[4/5] w-full bg-neutral-950"
                data-project={project.id}
              >
                <span className="sr-only">{project.label}</span>
              </article>
            </li>
          ))}
        </ul>
        <div className="h-[18vh]" aria-hidden />
      </div>
    </aside>
  );
}
