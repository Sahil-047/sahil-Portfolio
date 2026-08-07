"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import RevealText from "@/components/RevealText";
import { SITE } from "@/lib/site";

type InfoProps = {
  onIndexClick?: () => void;
  onInfoClick?: () => void;
  onContactClick?: () => void;
};

const labelClass =
  "m-0 mb-1.5 font-[family-name:var(--font-body)] text-[clamp(0.7rem,1.2vw,0.8rem)] font-medium tracking-[-0.03em]";
const valueClass =
  "m-0 font-[family-name:var(--font-body)] text-[clamp(0.85rem,1.5vw,0.95rem)] font-semibold leading-snug tracking-[-0.04em]";
const bioClass =
  "m-0 font-[family-name:var(--font-body)] text-[clamp(1.15rem,2.4vw,1.35rem)] font-semibold leading-relaxed tracking-[-0.04em]";

function AboutPortrait() {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-neutral-950">
      {!failed && (
        // Portrait optional until public/images/about.jpg is added
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={SITE.aboutImage}
          alt={SITE.name}
          className="absolute inset-0 h-full w-full object-cover grayscale"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export default function Info({
  onIndexClick,
  onInfoClick,
  onContactClick,
}: InfoProps) {
  return (
    <main
      id="page-content"
      className="relative z-[10] flex h-dvh max-h-dvh flex-col overflow-hidden bg-transparent px-3 py-4 sm:px-4 sm:py-5"
    >
      <div
        aria-hidden
        className="film-grain pointer-events-none absolute inset-0 -z-[1] opacity-40"
      />

      <header className="relative z-30 mb-4 grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 sm:mb-5">
        <RevealText
          as="p"
          className="cursor-default justify-self-start pl-1.5 font-[family-name:var(--font-display)] text-[clamp(1.05rem,2vw,.65rem)] font-semibold uppercase leading-none tracking-[-0.05em]"
        >
          {SITE.name}
        </RevealText>

        <button
          type="button"
          onClick={onIndexClick}
          className="cursor-pointer justify-self-center leading-none"
        >
          <RevealText className="inline-block whitespace-nowrap font-[family-name:var(--font-body)] text-[clamp(1.05rem,2vw,0.65rem)] font-semibold leading-none tracking-[-0.05em]">
            ← Index
          </RevealText>
        </button>

        <div className="justify-self-end">
          <Navbar
            active="info"
            onInfoClick={onInfoClick}
            onContactClick={onContactClick}
          />
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,42%)] lg:items-stretch lg:gap-10 xl:gap-14">
        <div className="flex min-h-0 flex-1 flex-col">
          <RevealText
            as="h1"
            className="m-0 !block cursor-default font-[family-name:var(--font-display)] text-[clamp(3.25rem,12vw,9.5rem)] font-bold uppercase leading-[0.85em] tracking-[-0.09em]"
          >
            About
          </RevealText>

          <div className="mt-auto flex max-w-[min(100%,32rem)] flex-col gap-4 pl-1.5 pt-6">
            {SITE.bio.map((paragraph) => (
              <RevealText
                key={paragraph.slice(0, 24)}
                as="p"
                className={bioClass}
              >
                {paragraph}
              </RevealText>
            ))}
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-5 sm:max-w-md sm:self-end lg:max-w-none lg:self-stretch">
          <AboutPortrait />

          <div className="grid grid-cols-2 gap-8 sm:gap-10">
            <div>
              <RevealText as="p" className={labelClass}>
                Tools
              </RevealText>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {SITE.frontendTools.map((line) => (
                  <li key={line}>
                    <RevealText as="p" className={valueClass}>
                      {line}
                    </RevealText>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <RevealText as="p" className={labelClass}>
                Backend Tools
              </RevealText>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {SITE.backendTools.map((line) => (
                  <li key={line}>
                    <RevealText as="p" className={valueClass}>
                      {line}
                    </RevealText>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-auto flex items-end justify-between gap-8 sm:gap-10">
            <div className="grid min-w-0 flex-1 grid-cols-2 items-end gap-8 sm:gap-10">
              <div className="pointer-events-auto flex flex-col gap-1">
                <RevealText as="p" className={labelClass}>
                  Contact
                </RevealText>
                <a
                  href={`mailto:${SITE.email}`}
                  className={`${valueClass} text-neutral-900 no-underline`}
                >
                  <RevealText className={valueClass}>{SITE.email}</RevealText>
                </a>
              </div>

              <div className="flex flex-col gap-1">
                <RevealText as="p" className={labelClass}>
                  Available
                </RevealText>
                <RevealText as="p" className={valueClass}>
                  {SITE.available}
                </RevealText>
              </div>
            </div>

            <RevealText as="p" className={`${valueClass} mb-0 shrink-0`}>
              © {SITE.year}
            </RevealText>
          </div>
        </aside>
      </div>
    </main>
  );
}
