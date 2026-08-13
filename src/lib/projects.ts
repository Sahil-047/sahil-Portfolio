export type Project = {
  id: string;
  label: string;
  image: string;
  /** Live site URL. Empty = screenshot fallback (some hosts block iframes). */
  url?: string;
};

export const PROJECTS: Project[] = [
  {
    id: "paintsaas",
    label: "PaintSaaS",
    image: "/images/projects/paintsaas.png",
    url: "https://paintappstore.in/",
  },
  {
    id: "gyanin",
    label: "Gyanin Academy",
    image: "/images/projects/gyanin.png",
    url: "https://gyanin.academy/",
  },
  {
    id: "tri",
    label: "Tri",
    image: "/images/projects/tri.png",
    url: "https://tri-mu.vercel.app/",
  },
  {
    id: "khan-trading",
    label: "Khan Trading World",
    image: "/images/projects/khan-trading.png",
    url: "https://www.khantrader.in/",
  },
  {
    id: "asthetecss",
    label: "AsthetCSS",
    image: "/images/projects/atelier.png",
    url: "https://asthetcss.in/",
  },
];

export const PROJECT_SELECT_EVENT = "portfolio:select-project";
export const PROJECT_OPEN_EVENT = "portfolio:open-project";

export function selectProject(index: number) {
  window.dispatchEvent(
    new CustomEvent(PROJECT_SELECT_EVENT, { detail: { index } }),
  );
}

export function openProject(index: number) {
  window.dispatchEvent(
    new CustomEvent(PROJECT_OPEN_EVENT, { detail: { index } }),
  );
}
