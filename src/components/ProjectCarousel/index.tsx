"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useTheme } from "@/components/ThemeProvider";
import DarkProjectCarousel from "@/components/DarkProjectCarousel";
import RevealImage from "@/components/RevealImage";
import { PROJECTS, PROJECT_SELECT_EVENT, openProject } from "@/lib/projects";

gsap.registerPlugin(useGSAP);

const LOOPS = 3;
const EDGE_SAMPLES = 8;
const MAX_INSET = 0.4;
const REST_BEND = 0;
const BEND_CAP = 0.95;
const MAX_BLUR = 26;
const ENERGY_GAIN = 0.55;
const ENERGY_DECAY = 0.84;
const ENERGY_SOFT = 2;
const ENERGY_HARD = 48;
const WHEEL_SCALE = 1.4;
const BEND_FOLLOW = 0.42;
const BLUR_FOLLOW = 0.5;
const BLUR_FILTER_ID = "project-carousel-motion-blur";

/**
 * Light: infinite vertical strip with scroll warp.
 * Dark: delegates to DarkProjectCarousel (3D coverflow tilt).
 */
export default function ProjectCarousel() {
  const { isDark } = useTheme();

  if (isDark) return <DarkProjectCarousel />;
  return <LightWarpCarousel />;
}

function LightWarpCarousel() {
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

      gsap.ticker.lagSmoothing(0);

      let setHeight = 0;
      let wrapping = false;
      let placed = false;
      let scrollEnergy = 0;
      let scrollSign = 1;
      let bend = reduceMotion ? 0 : REST_BEND;
      let blur = 0;
      let lastBend = 0;
      let idleTween: gsap.core.Tween | null = null;
      const cards = [
        ...list.querySelectorAll<HTMLElement>(".project-carousel__card"),
      ];
      let metrics = cards.map((el) => ({ el, top: 0, height: 0 }));

      if (feBlur && !reduceMotion) {
        list.style.filter = `url(#${BLUR_FILTER_ID})`;
        feBlur.setAttribute("stdDeviation", "0 0");
      }

      const strengthFromEnergy = (energy: number) => {
        const t = gsap.utils.clamp(
          0,
          1,
          gsap.utils.mapRange(ENERGY_SOFT, ENERGY_HARD, 0, 1, energy),
        );
        return t * BEND_CAP;
      };

      const clearWarp = () => {
        cards.forEach((card) => {
          card.style.clipPath = "";
          card.style.willChange = "";
        });
      };

      const applyBlur = (amount: number) => {
        if (!feBlur || reduceMotion) return;
        const y = amount < 0.08 ? 0 : amount;
        feBlur.setAttribute("stdDeviation", `0 ${y.toFixed(2)}`);
      };

      const measure = () => {
        setHeight = list.scrollHeight / LOOPS;
        metrics = cards.map((el) => ({
          el,
          top: (el.parentElement as HTMLElement).offsetTop,
          height: el.offsetHeight,
        }));
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
        if (b >= 0) return b * MAX_INSET * (1 - curve);
        return -b * MAX_INSET * curve;
      };

      const applyWarp = () => {
        if (reduceMotion) {
          if (lastBend !== 0) clearWarp();
          lastBend = 0;
          bend = 0;
          return;
        }

        if (Math.abs(bend) < 0.003) {
          if (lastBend !== 0) clearWarp();
          lastBend = 0;
          return;
        }
        lastBend = bend;

        const scrollTop = track.scrollTop;
        const trackH = track.clientHeight;
        const centerY = scrollTop + trackH * 0.5;
        const half = Math.max(trackH * 0.5, 1);

        for (const { el, top, height } of metrics) {
          if (top + height < scrollTop - 48 || top > scrollTop + trackH + 48) {
            if (el.style.clipPath) el.style.clipPath = "";
            continue;
          }

          el.style.willChange = "clip-path";
          const left: string[] = [];
          const right: string[] = [];
          for (let i = 0; i <= EDGE_SAMPLES; i++) {
            const p = i / EDGE_SAMPLES;
            const ny = (top + p * height - centerY) / half;
            const x = insetAt(ny, bend) * 100;
            left.push(`${x.toFixed(2)}% ${p * 100}%`);
            right.push(`${(100 - x).toFixed(2)}% ${p * 100}%`);
          }
          el.style.clipPath = `polygon(${[...left, ...right.reverse()].join(",")})`;
        }
      };

      const onTick = () => {
        scrollEnergy *= ENERGY_DECAY;
        if (!reduceMotion) {
          const goal =
            scrollEnergy > 0.25
              ? scrollSign * strengthFromEnergy(scrollEnergy)
              : REST_BEND;
          bend += (goal - bend) * BEND_FOLLOW;
          if (Math.abs(bend) < 0.002) bend = 0;
          const blurGoal = (Math.abs(bend) / BEND_CAP) * MAX_BLUR;
          blur += (blurGoal - blur) * BLUR_FOLLOW;
          if (blur < 0.06) blur = 0;
          applyBlur(blur);
        }
        applyWarp();
      };

      const scheduleRest = () => {
        idleTween?.kill();
        idleTween = gsap.delayedCall(0.08, () => {
          scrollEnergy = 0;
        });
      };

      const onWheel = (e: WheelEvent) => {
        if (e.ctrlKey) return;
        e.preventDefault();
        track.scrollTop += e.deltaY * WHEEL_SCALE;
        normalize();

        if (!reduceMotion && e.deltaY !== 0) {
          const nextSign = e.deltaY > 0 ? 1 : -1;
          if (nextSign !== scrollSign) scrollEnergy *= 0.2;
          scrollSign = nextSign;
          scrollEnergy = Math.min(
            ENERGY_HARD,
            scrollEnergy + Math.abs(e.deltaY) * ENERGY_GAIN,
          );
          scheduleRest();
        }
      };

      const onScroll = () => {
        normalize();
      };

      measure();
      applyWarp();
      gsap.ticker.add(onTick);

      const ro = new ResizeObserver(() => {
        measure();
        applyWarp();
      });
      ro.observe(list);

      const onSelect = (e: Event) => {
        const index = (e as CustomEvent<{ index: number }>).detail?.index;
        if (typeof index !== "number") return;
        const target = cards[index + PROJECTS.length];
        if (!target) return;
        const top =
          target.offsetTop - (track.clientHeight - target.offsetHeight) / 2;
        track.scrollTop = top;
        normalize();
        applyWarp();
      };

      window.addEventListener("wheel", onWheel, { passive: false });
      track.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener(PROJECT_SELECT_EVENT, onSelect);

      return () => {
        gsap.ticker.remove(onTick);
        gsap.ticker.lagSmoothing(500, 33);
        idleTween?.kill();
        ro.disconnect();
        window.removeEventListener("wheel", onWheel);
        track.removeEventListener("scroll", onScroll);
        window.removeEventListener(PROJECT_SELECT_EVENT, onSelect);
        list.style.filter = "none";
        clearWarp();
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
      className="project-carousel pointer-events-none absolute inset-y-0 z-20"
      aria-label="Projects"
    >
      <svg
        className="pointer-events-none absolute h-0 w-0 overflow-hidden"
        aria-hidden
      >
        <defs>
          <filter
            id={BLUR_FILTER_ID}
            x="-20%"
            y="-60%"
            width="140%"
            height="220%"
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

      <div className="project-carousel__stage h-full w-full">
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
                  className="project-carousel__card pointer-events-auto relative w-full cursor-pointer overflow-hidden bg-neutral-950"
                  data-project={project.id}
                  onClick={() => {
                    const i = PROJECTS.findIndex((p) => p.id === project.id);
                    if (i >= 0) openProject(i);
                  }}
                >
                  <RevealImage src={project.image} className="absolute inset-0 h-full w-full object-cover" />
                  <span className="sr-only">{project.label}</span>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
