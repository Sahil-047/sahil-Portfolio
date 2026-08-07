"use client";

import { useState } from "react";
import Loader from "@/components/Loader";
import Home from "@/components/Home";
import Info from "@/components/Info";
import FluidCursor from "@/components/FluidCursor/FluidCursor";
import { ThemeProvider } from "@/components/ThemeProvider";

type View = "home" | "info";

export default function Page() {
  const [showLoader, setShowLoader] = useState(true);
  const [view, setView] = useState<View>("home");

  return (
    <ThemeProvider>
      {showLoader && <Loader onComplete={() => setShowLoader(false)} />}
      {!showLoader && (
        <FluidCursor>
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
        </FluidCursor>
      )}
    </ThemeProvider>
  );
}
