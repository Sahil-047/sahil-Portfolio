"use client";

import { useEffect } from "react";
import type { Project } from "@/lib/projects";

type ProjectViewerProps = {
  project: Project;
  onClose: () => void;
};

/**
 * Full-viewport project stage — same tab, no extra windows.
 * Lives outside FluidCursor so the veil does not punch through the live site.
 */
export default function ProjectViewer({ project, onClose }: ProjectViewerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="project-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={project.label}
      onWheel={(e) => e.stopPropagation()}
    >
      <header className="project-viewer__bar">
        <button
          type="button"
          className="project-viewer__back"
          onClick={onClose}
        >
          ← Index
        </button>
        <p className="project-viewer__name">{project.label}</p>
      </header>

      {project.url?.trim() ? (
        <iframe
          className="project-viewer__frame"
          src={project.url}
          title={project.label}
          allow="fullscreen"
        />
      ) : (
        <div className="project-viewer__fallback">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={project.image} alt={project.label} />
        </div>
      )}
    </div>
  );
}
