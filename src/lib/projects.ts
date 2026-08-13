export const PROJECTS = [
  {
    id: "paintsaas",
    label: "PaintSaaS",
    image: "/images/projects/paintsaas.png",
  },
  {
    id: "gyanin",
    label: "Gyanin Academy",
    image: "/images/projects/gyanin.png",
  },
  {
    id: "tri",
    label: "Tri",
    image: "/images/projects/tri.png",
  },
  {
    id: "khan-trading",
    label: "Khan Trading World",
    image: "/images/projects/khan-trading.png",
  },
  {
    id: "atelier",
    label: "Atelier",
    image: "/images/projects/atelier.png",
  },
] as const;

export type Project = (typeof PROJECTS)[number];
