import RevealText from "@/components/RevealText";
import { SITE } from "@/lib/site";

const labelClass =
  "m-0 font-[family-name:var(--font-body)] text-[clamp(0.7rem,1.2vw,0.8rem)] font-medium tracking-[-0.03em]";
const valueClass =
  "m-0 font-[family-name:var(--font-body)] text-[clamp(0.85rem,1.5vw,0.95rem)] font-semibold tracking-[-0.04em]";

export default function Footer() {
  return (
    <footer
      className="pointer-events-none absolute inset-x-3 bottom-4 z-30 sm:inset-x-4 sm:bottom-5"
      aria-label="Site footer"
    >
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-wrap items-end gap-10 sm:gap-16 md:gap-24">
          <div className="pointer-events-auto flex flex-col gap-1">
            <RevealText as="p" className={labelClass}>
              Contact
            </RevealText>
            <a
              href={`mailto:${SITE.email}`}
              className={`${valueClass} text-neutral-900 no-underline`}
            >
              <RevealText>{SITE.email}</RevealText>
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

        <RevealText as="p" className={`${labelClass} shrink-0`}>
          © {SITE.year}
        </RevealText>
      </div>
    </footer>
  );
}
