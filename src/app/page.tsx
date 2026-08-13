"use client";

import { useCallback, useEffect, useState } from "react";
import Loader from "@/components/Loader";
import Home from "@/components/Home";
import Info from "@/components/Info";
import FluidCursor from "@/components/FluidCursor/FluidCursor";
import AtmosphereBackground from "@/components/AtmosphereBackground";
import ProjectViewer from "@/components/ProjectViewer";
import { ThemeProvider } from "@/components/ThemeProvider";
import useIsMobile from "@/hooks/useIsMobile";
import { PROJECTS, PROJECT_OPEN_EVENT, type Project } from "@/lib/projects";

type View = "home" | "info";

function AppShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  if (isMobile === null) return null;
  if (isMobile) {
    return (
      <>
        <AtmosphereBackground />
        <div className="fixed inset-0 z-[2] overflow-visible">{children}</div>
      </>
    );
  }
  return <FluidCursor>{children}</FluidCursor>;
}

function projectFromHash(): Project | null {
  const match = window.location.hash.match(/^#work\/([^/]+)$/);
  if (!match) return null;
  return PROJECTS.find((p) => p.id === match[1]) ?? null;
}

export default function Page() {
  const [showLoader, setShowLoader] = useState(true);
  const [view, setView] = useState<View>("home");
  const [active, setActive] = useState<Project | null>(null);

  useEffect(() => {
    setActive(projectFromHash());

    const onOpen = (e: Event) => {
      const index = (e as CustomEvent<{ index: number }>).detail?.index;
      if (typeof index !== "number") return;
      const project = PROJECTS[index];
      if (!project) return;
      setActive(project);
      if (window.history.state?.project !== project.id) {
        window.history.pushState(
          { project: project.id },
          "",
          `#work/${project.id}`,
        );
      }
    };

    const onPop = () => setActive(projectFromHash());

    window.addEventListener(PROJECT_OPEN_EVENT, onOpen);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener(PROJECT_OPEN_EVENT, onOpen);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  const closeProject = useCallback(() => {
    if (window.history.state?.project) {
      window.history.back();
      return;
    }
    setActive(null);
    if (window.location.hash.startsWith("#work/")) {
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }, []);

  return (
    <ThemeProvider>
      {showLoader && <Loader onComplete={() => setShowLoader(false)} />}
      {!showLoader && (
        <>
          <AppShell>
            {view === "home" ? (
              <Home
                onInfoClick={() => setView("info")}
                onContactClick={() => setView("info")}
              />
            ) : (
              <Info
                onIndexClick={() => setView("home")}
                onInfoClick={() => setView("info")}
                onContactClick={() => setView("info")}
              />
            )}
          </AppShell>
          {active && (
            <ProjectViewer project={active} onClose={closeProject} />
          )}
        </>
      )}
    </ThemeProvider>
  );
}
