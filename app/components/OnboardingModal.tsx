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
          <h2 className="text-2xl font-bold mb-4">Welcome to TreeGPT</h2>
          <p className="mb-8">
            This is a new chat interface built for speed and ease of use based
            on modelling conversation with LLMs as trees (DAGs) instead of
            linearly.
          </p>
          <p className="text-sm text-muted-foreground">
            Click anywhere to continue
          </p>
        </div>
      )}
      {step === 2 && (
        <div
          className="bg-white dark:bg-gray-800 p-8 rounded-lg max-w-2xl mx-4 text-center cursor-pointer"
          onClick={() => onStepChange(3)}
        >
          <h2 className="text-2xl font-bold mb-4">How it works</h2>
          <p className="mb-8">
            Every query and response represents a node in the tree. As a result,
            you have the ability to control the context easily by forming
            multiple nodes off of one response. This solves the problem of
            context loss in traditional chat interfaces if you have a long
            conversation and want to go on a tangent.
          </p>
          <p className="text-xl font-semibold">Have fun prompting!</p>
          <p className="text-sm text-muted-foreground mt-4">
            Click anywhere to start
          </p>
        </div>
      )}
    </div>
  );
}
