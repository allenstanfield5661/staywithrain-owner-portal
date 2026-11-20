"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const MESSAGE = "Demo mode — sample preview only";

export function DemoActionButton({
  label,
  tone = "outline",
}: {
  label: string;
  tone?: "solid" | "outline";
}) {
  const [tick, setTick] = useState(0);
  const open = tick > 0;

  useEffect(() => {
    if (!tick) return;
    const timer = window.setTimeout(() => setTick(0), 3400);
    return () => window.clearTimeout(timer);
  }, [tick]);

  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium",
          tone === "solid" ? "bg-sea text-white hover:bg-sea/90" : "border border-border bg-card hover:bg-muted",
        )}
        onClick={() => setTick((current) => current + 1)}
      >
        {label}
      </button>
      {open ? (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl bg-sea px-4 py-3 text-center text-sm text-white shadow-lg"
        >
          {MESSAGE}
        </div>
      ) : null}
    </>
  );
}
