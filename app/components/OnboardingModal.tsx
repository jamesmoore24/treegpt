"use client";

import { cn } from "@/lib/utils";

interface OnboardingModalProps {
  step: number;
  onStepChange: (step: number) => void;
}

export function OnboardingModal({ step, onStepChange }: OnboardingModalProps) {
  if (step >= 3) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      {step === 1 && (
        <div 
          className="bg-white dark:bg-gray-800 p-8 rounded-lg max-w-2xl mx-4 text-center cursor-pointer" 
          onClick={() => onStepChange(2)}
        >
          <h2 className="text-2xl font-bold mb-4">Welcome to OmniRoute</h2>
          <p className="mb-8">
            This is an experimental website that tries to intelligently route queries to models depending on the query&apos;s complexity.
          </p>
          <p className="text-sm text-muted-foreground">Click anywhere to continue</p>
        </div>
      )}
      {step === 2 && (
        <div 
          className="bg-white dark:bg-gray-800 p-8 rounded-lg max-w-2xl mx-4 text-center cursor-pointer"
          onClick={() => onStepChange(3)}
        >
          <h2 className="text-2xl font-bold mb-4">How it works</h2>
          <p className="mb-8">
            Every time you prompt you must select which half of the screen produced the better answer to continue. To make sure you aren&apos;t selecting randomly we will compare your answers relative to the population. If you select answers that are consistently in the minority you will be limited from using the service.
          </p>
          <p className="text-xl font-semibold">Have fun prompting!</p>
          <p className="text-sm text-muted-foreground mt-4">Click anywhere to start</p>
        </div>
      )}
    </div>
  );
}