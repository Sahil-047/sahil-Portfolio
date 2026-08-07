"use client";

import Navbar from "@/components/Navbar";
import RevealText from "@/components/RevealText";
import ProjectCarousel from "@/components/ProjectCarousel";
import Footer from "@/components/Footer";
import { SITE } from "@/lib/site";

type HomeProps = {
  onInfoClick?: () => void;
  onContactClick?: () => void;
};

export default function Home({ onInfoClick, onContactClick }: HomeProps) {
  return (
    <main
      id="page-content"
      className="relative z-[10] h-dvh max-h-dvh overflow-hidden bg-transparent px-3 py-4 sm:px-4 sm:py-5"
    >
      <div
        aria-hidden
        className="film-grain pointer-events-none absolute inset-0 -z-[1] opacity-40"
      />

      <header className="relative z-30 mb-3 flex w-full items-center justify-between gap-4">
        <RevealText
          as="p"
          className="cursor-default pl-1.5 font-[family-name:var(--font-display)] text-[clamp(1.05rem,2vw,.65rem)] font-semibold uppercase leading-none tracking-[-0.05em]"
        >
          {SITE.name}
        </RevealText>
        <Navbar onInfoClick={onInfoClick} onContactClick={onContactClick} />
      </header>

      <div className="relative z-10 max-w-[min(100%,36rem)] lg:max-w-[min(52%,40rem)]">
        <RevealText
          as="h1"
          className="m-0 !block w-full cursor-default font-[family-name:var(--font-display)] text-[clamp(3.25rem,12vw,5.5rem)] font-bold uppercase leading-[0.9em] tracking-[-0.09em]"
        >
          Creative
          <br />
          Developer
        </RevealText>

        <RevealText
          as="p"
          className="mt-6 max-w-md cursor-default pl-1.5 font-[family-name:var(--font-body)] text-[clamp(1rem,2vw,.75rem)] font-semibold leading-relaxed tracking-[-0.05em]"
        >
          Building high performance websites with more to discover beneath the
          surface.
        </RevealText>
      </div>

      <ProjectCarousel />
      <Footer />
    </main>
  );
}
