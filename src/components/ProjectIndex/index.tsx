"use client";

import RevealText from "@/components/RevealText";
import { PROJECTS, openProject, selectProject } from "@/lib/projects";

export default function ProjectIndex() {
  return (
    <nav className="project-index" aria-label="Project index">
      <RevealText as="p" className="project-index__heading">
        Index
      </RevealText>
      <ul className="project-index__list">
        {PROJECTS.map((project, index) => (
          <li key={project.id}>
            <button
              type="button"
              className="project-index__item"
              onClick={() => {
                selectProject(index);
                openProject(index);
              }}
            >
              <RevealText>{project.label}</RevealText>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
