"use client";

import RevealText from "@/components/RevealText";
import { SITE } from "@/lib/site";

type MobileInfoProps = {
  onIndexClick?: () => void;
};

/**
 * Phone About layout: Index, large ABOUT, grainy portrait, bio stack.
 */
export default function MobileInfo({ onIndexClick }: MobileInfoProps) {
  return (
    <main id="page-content" className="mobile-info">
      <div
        aria-hidden
        className="film-grain pointer-events-none absolute inset-0 -z-[1] opacity-40"
      />

      <header className="mobile-info__header">
        <button
          type="button"
          onClick={onIndexClick}
          className="mobile-info__back cursor-pointer leading-none"
        >
          <RevealText className="mobile-info__back-text font-[family-name:var(--font-body)]">
            ← Index
          </RevealText>
        </button>
      </header>

      <RevealText
        as="h1"
        className="mobile-info__title m-0 !block cursor-default font-[family-name:var(--font-display)] font-bold uppercase"
      >
        About
      </RevealText>

      <div className="mobile-info__frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/projects/portfolio.jpeg"
          alt=""
          className="mobile-info__shot"
          draggable={false}
        />
        <span className="mobile-info__grain" aria-hidden />
      </div>

      <div className="mobile-info__bio">
        {SITE.bio.map((paragraph) => (
          <RevealText
            key={paragraph.slice(0, 24)}
            as="p"
            className="mobile-info__p font-[family-name:var(--font-body)]"
          >
            {paragraph}
          </RevealText>
        ))}
      </div>

      <section className="mobile-info__skills" aria-label="Skills">
        <div>
          <RevealText as="p" className="mobile-home__foot-label">
            Tools
          </RevealText>
          <ul className="mobile-info__skill-list">
            {SITE.frontendTools.map((line) => (
              <li key={line}>
                <RevealText as="p" className="mobile-home__foot-value">
                  {line}
                </RevealText>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <RevealText as="p" className="mobile-home__foot-label">
            Backend Tools
          </RevealText>
          <ul className="mobile-info__skill-list">
            {SITE.backendTools.map((line) => (
              <li key={line}>
                <RevealText as="p" className="mobile-home__foot-value">
                  {line}
                </RevealText>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="mobile-home__footer" aria-label="Site footer">
        <div>
          <RevealText as="p" className="mobile-home__foot-label">
            Contact
          </RevealText>
          <a href={`mailto:${SITE.email}`} className="mobile-home__foot-value">
            <RevealText>{SITE.email}</RevealText>
          </a>
        </div>
        <div>
          <RevealText as="p" className="mobile-home__foot-label">
            Available
          </RevealText>
          <RevealText as="p" className="mobile-home__foot-value">
            {SITE.available}
          </RevealText>
        </div>
        <RevealText as="p" className="mobile-home__foot-label">
          © {SITE.year}
        </RevealText>
      </footer>
    </main>
  );
}
