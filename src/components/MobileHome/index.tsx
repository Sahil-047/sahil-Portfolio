"use client";

import Navbar from "@/components/Navbar";
import RevealText from "@/components/RevealText";
import { PROJECTS, openProject } from "@/lib/projects";
import { SITE } from "@/lib/site";

type MobileHomeProps = {
  onInfoClick?: () => void;
  onContactClick?: () => void;
};

/**
 * Phone layout: stacked project cards, no carousel / coverflow / index.
 */
export default function MobileHome({
  onInfoClick,
  onContactClick,
}: MobileHomeProps) {
  return (
    <main id="page-content" className="mobile-home">
      <div
        aria-hidden
        className="film-grain pointer-events-none absolute inset-0 -z-[1] opacity-40"
      />
      <div
        id="smoke-front-root"
        className="pointer-events-none absolute inset-0 z-[25]"
        aria-hidden
      />

      <header className="relative z-30 mb-8 flex w-full items-center justify-between gap-4">
        <RevealText
          as="p"
          className="cursor-default font-[family-name:var(--font-display)] text-[0.95rem] font-semibold uppercase leading-none tracking-[-0.05em]"
        >
          {SITE.name}
        </RevealText>
        <Navbar onInfoClick={onInfoClick} onContactClick={onContactClick} />
      </header>

      <RevealText
        as="h1"
        className="mobile-home__title m-0 !block w-full cursor-default font-[family-name:var(--font-display)] font-bold uppercase"
      >
        Creative
        <br />
        Developer
      </RevealText>

      <RevealText
        as="p"
        className="mobile-home__lede mt-5 max-w-[20rem] cursor-default font-[family-name:var(--font-body)] font-semibold leading-relaxed tracking-[-0.04em]"
      >
        Building high-performance websites with more to discover beneath the
        surface.
      </RevealText>

      <ul className="mobile-home__list">
        {PROJECTS.map((project) => (
          <li key={project.id} className="mobile-home__item">
            <article
              className="mobile-home__card"
              onClick={() => {
                const i = PROJECTS.findIndex((p) => p.id === project.id);
                if (i >= 0) openProject(i);
              }}
            >
              <div className="mobile-home__frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={project.image}
                  alt=""
                  className="mobile-home__shot"
                  draggable={false}
                />
                <span className="mobile-home__grain" aria-hidden />
              </div>
              <RevealText
                as="p"
                className="mobile-home__label font-[family-name:var(--font-body)]"
              >
                {project.label}
              </RevealText>
            </article>
          </li>
        ))}
      </ul>

      <div className="mobile-home__fade" aria-hidden />
      <footer className="mobile-home__footer" aria-label="Site footer">
        <div>
          <RevealText as="p" className="mobile-home__foot-label">
            Contact
          </RevealText>
          <a href={`mailto:${SITE.email}`} className="mobile-home__foot-value">
            <RevealText>{SITE.email}</RevealText>
          </a>
        </div>
        <RevealText as="p" className="mobile-home__foot-label">
          © {SITE.year}
        </RevealText>
      </footer>
    </main>
  );
}
