"use client";

import { useState } from "react";
import Loader from "@/components/Loader";
import Home from "@/components/Home";
import FluidCursor from "@/components/FluidCursor/FluidCursor";

export default function Page() {
  const [showLoader, setShowLoader] = useState(true);

  return (
    <>
      {showLoader && <Loader onComplete={() => setShowLoader(false)} />}
      {!showLoader && (
        <FluidCursor>
          <Home />
        </FluidCursor>
      )}
    </>
  );
}
