export const PROJECTS = [
  {
    id: "estrela",
    label: "Estrela Studio",
    image: "/images/projects/estrela.jpg",
  },
  {
    id: "yucca",
    label: "Yucca Packaging",
    image: "/images/projects/yucca.jpg",
  },
  {
    id: "zulik",
    label: "Zulik",
    image: "/images/projects/zulik.jpg",
  },
  {
    id: "payjustnow",
    label: "PayJustNow",
    image: "/images/projects/payjustnow.jpg",
  },
  {
    id: "vineyard",
    label: "Vineyard Hotel",
    image: "/images/projects/vineyard.jpg",
  },
] as const;

export type Project = (typeof PROJECTS)[number];
