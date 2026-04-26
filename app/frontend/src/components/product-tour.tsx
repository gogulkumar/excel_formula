"use client";

import { useEffect, useState } from "react";

const TOUR_STEPS = [
  "Upload a workbook, then choose the sheet you want to inspect.",
  "Click any formula cell to open the trace panel and view dependencies.",
  "Use Chat and Analysis to generate charts, edits, and KPI explanations.",
];
const LEGACY_TOUR_KEY = "formulalens-tour-seen";
const TOUR_KEY = "calcsense-tour-seen";

export function ProductTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = window.localStorage.getItem(TOUR_KEY) ?? window.localStorage.getItem(LEGACY_TOUR_KEY);
    if (seen) {
      window.localStorage.setItem(TOUR_KEY, seen);
      return;
    }
    setOpen(true);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/20 p-6 backdrop-blur-sm md:items-center">
      <div className="w-full max-w-lg rounded-[32px] border border-white/40 bg-white p-6 shadow-2xl">
        <div className="text-xs uppercase tracking-[0.24em] text-accent">Product Tour</div>
        <h2 className="mt-3 text-2xl font-medium tracking-tight">How CalcSense works</h2>
        <p className="mt-4 text-sm leading-7 text-text-secondary">{TOUR_STEPS[step]}</p>
        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-2">
            {TOUR_STEPS.map((_, idx) => (
              <span key={idx} className={`h-2.5 w-2.5 rounded-full ${idx === step ? "bg-accent" : "bg-border-medium"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-full border border-border-subtle px-4 py-2 text-sm text-text-secondary"
              onClick={() => {
                window.localStorage.setItem(TOUR_KEY, "1");
                setOpen(false);
              }}
            >
              Skip
            </button>
            <button
              className="rounded-full bg-accent px-4 py-2 text-sm text-white"
              onClick={() => {
                if (step === TOUR_STEPS.length - 1) {
                  window.localStorage.setItem(TOUR_KEY, "1");
                  setOpen(false);
                  return;
                }
                setStep((current) => current + 1);
              }}
            >
              {step === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
