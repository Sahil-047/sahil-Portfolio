"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const PROJECTS = [
  { id: "estrela", label: "Estrela Studio" },
  { id: "yucca", label: "Yucca Packaging" },
  { id: "zulik", label: "Zulik" },
  { id: "payjustnow", label: "PayJustNow" },
  { id: "vineyard", label: "Vineyard Hotel" },
] as const;

const LOOPS = 3;
/** Samples per card edge — more = smoother barrel curve */
const EDGE_SAMPLES = 14;
/** Max side inset as a fraction of card width */
const MAX_INSET = 0.28;
/** Flat rectangles at rest — warp only while scrolling */
const REST_BEND = 0;
/** Peak vertical motion-blur (px stdDeviation) */
const MAX_BLUR = 14;
/** Soft cap — normal scrolling never fully maxes the warp */
const BEND_CAP = 0.85;
/** Scroll energy → bend: light ticks stay subtle, strong streaks bend more */
const ENERGY_GAIN = 0.4;
const ENERGY_DECAY = 0.86;
const ENERGY_SOFT = 6;
const ENERGY_HARD = 95;

/**
 * Centered vertical project strip (3 × 16:9 cards in view).
 * Wheel drives infinite scroll + fast convex/concave warp + motion blur.
 */
export default function ProjectCarousel() {
  const rootRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement | null>(null);

  useGSAP(
    () => {
      const track = trackRef.current;
      const list = listRef.current;
      const feBlur = blurRef.current;
      if (!track || !list) return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      let setHeight = 0;
      let wrapping = false;
      let placed = false;
      let scrollEnergy = 0;
      let scrollSign = 1;
      const bend = { value: reduceMotion ? 0 : REST_BEND };
      const blur = { value: 0 };
      const bendTo = gsap.quickTo(bend, "value", {
        duration: 0.1,
        ease: "power3.out",
      });
      const blurTo = gsap.quickTo(blur, "value", {
        duration: 0.08,
        ease: "power2.out",
      });
      let idleTween: gsap.core.Tween | null = null;

      const strengthFromEnergy = (energy: number) => {
        const t = gsap.utils.clamp(
          0,
          1,
          gsap.utils.mapRange(ENERGY_SOFT, ENERGY_HARD, 0, 1, energy),
        );
        // Ease-in so slow scroll stays near minimum bend
        return Math.pow(t, 1.25) * BEND_CAP;
      };

      const measure = () => {
        setHeight = list.scrollHeight / LOOPS;
        if (!placed && setHeight > 0) {
          track.scrollTop = setHeight;
          placed = true;
        }
      };

      const normalize = () => {
        if (wrapping || setHeight <= 0) return;
        if (track.scrollTop < setHeight) {
          wrapping = true;
          track.scrollTop += setHeight;
          wrapping = false;
        } else if (track.scrollTop >= setHeight * 2) {
          wrapping = true;
          track.scrollTop -= setHeight;
          wrapping = false;
        }
      };

      const insetAt = (ny: number, b: number) => {
        const t = gsap.utils.clamp(-1, 1, ny);
        const curve = Math.cos(t * Math.PI * 0.5);
        if (b >= 0) {
          return b * MAX_INSET * (1 - curve);
        }
        return -b * MAX_INSET * curve;
      };

      const applyWarp = () => {
        const cards = list.querySelectorAll<HTMLElement>(
          ".project-carousel__card",
        );
        const trackRect = track.getBoundingClientRect();
        const centerY = trackRect.top + trackRect.height * 0.5;
        const half = Math.max(trackRect.height * 0.5, 1);
        const b = bend.value;

        cards.forEach((card) => {
          if (reduceMotion || b === 0) {
            card.style.clipPath = "";
            return;
          }

          const r = card.getBoundingClientRect();
          if (r.bottom < trackRect.top - 40 || r.top > trackRect.bottom + 40) {
            card.style.clipPath = "";
            return;
          }

          const left: string[] = [];
          const right: string[] = [];

          for (let i = 0; i <= EDGE_SAMPLES; i++) {
            const p = i / EDGE_SAMPLES;
            const y = r.top + p * r.height;
            const ny = (y - centerY) / half;
            const x = insetAt(ny, b) * 100;
            left.push(`${x}% ${p * 100}%`);
            right.push(`${100 - x}% ${p * 100}%`);
          }

          card.style.clipPath = `polygon(${[...left, ...right.reverse()].join(",")})`;
        });
      };

      const applyBlur = () => {
        if (reduceMotion || !feBlur) {
          list.style.filter = "none";
          return;
        }
        const y = blur.value;
        feBlur.setAttribute("stdDeviation", `0 ${y}`);
        list.style.filter =
          y > 0.04 ? "url(#project-carousel-motion-blur)" : "none";
      };

      const onTick = () => {
        scrollEnergy *= ENERGY_DECAY;
        if (!reduceMotion && scrollEnergy > 0.4) {
          const strength = strengthFromEnergy(scrollEnergy);
          bendTo(scrollSign * strength);
          blurTo(strength * MAX_BLUR);
        }
        applyWarp();
        applyBlur();
      };

      const scheduleRest = () => {
        idleTween?.kill();
        idleTween = gsap.delayedCall(0.12, () => {
          if (reduceMotion) return;
          scrollEnergy = 0;
          bendTo(REST_BEND);
          blurTo(0);
        });
      };

      const onWheel = (e: WheelEvent) => {
        if (e.ctrlKey) return;
        e.preventDefault();
        track.scrollTop += e.deltaY;
        normalize();

        if (!reduceMotion && e.deltaY !== 0) {
          const nextSign = e.deltaY > 0 ? 1 : -1;
          if (nextSign !== scrollSign) {
            scrollEnergy *= 0.3;
          }
          scrollSign = nextSign;
          scrollEnergy = Math.min(
            ENERGY_HARD * 1.15,
            scrollEnergy + Math.abs(e.deltaY) * ENERGY_GAIN,
          );
          const strength = strengthFromEnergy(scrollEnergy);
          // Down → convex, up → concave — magnitude follows scroll strength
          bendTo(scrollSign * strength);
          blurTo(strength * MAX_BLUR);
          scheduleRest();
        }
      };

      const onScroll = () => {
        normalize();
        applyWarp();
      };

      measure();
      applyWarp();
      applyBlur();
      gsap.ticker.add(onTick);

      const ro = new ResizeObserver(() => {
        measure();
        applyWarp();
      });
      ro.observe(list);

      window.addEventListener("wheel", onWheel, { passive: false });
      track.addEventListener("scroll", onScroll, { passive: true });

      return () => {
        gsap.ticker.remove(onTick);
        idleTween?.kill();
        ro.disconnect();
        window.removeEventListener("wheel", onWheel);
        track.removeEventListener("scroll", onScroll);
        list.style.filter = "none";
      };
    },
    { scope: rootRef },
  );

  const items = Array.from({ length: LOOPS }, (_, loop) =>
    PROJECTS.map((project) => ({
      ...project,
      key: `${loop}-${project.id}`,
    })),
  ).flat();

  return (
    <aside
      ref={rootRef}
      className="project-carousel pointer-events-none absolute top-4 bottom-4 left-1/2 z-20 max-w-[calc(100%-1.5rem)] translate-x-1/3 sm:top-5 sm:bottom-5"
      aria-label="Projects"
    >
      <svg
        className="pointer-events-none absolute h-0 w-0 overflow-hidden"
        aria-hidden
      >
        <defs>
          <filter
            id="project-carousel-motion-blur"
            x="-10%"
            y="-35%"
            width="120%"
            height="170%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur
              ref={blurRef}
              in="SourceGraphic"
              stdDeviation="0 0"
            />
          </filter>
        </defs>
      </svg>

      <div
        ref={trackRef}
        className="project-carousel__track h-full overflow-y-auto overscroll-none"
        tabIndex={0}
      >
        <ul
          ref={listRef}
          className="project-carousel__list m-0 flex list-none flex-col p-0"
        >
          {items.map((project) => (
            <li key={project.key}>
              <article
                className="project-carousel__card pointer-events-auto relative w-full bg-neutral-950"
                data-project={project.id}
              >
                <span className="sr-only">{project.label}</span>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
