"use client";

import { Zap } from "lucide-react";

interface LivesCounterProps {
  queriesLeft: number;
}

export function LivesCounter({ queriesLeft }: LivesCounterProps) {
  return (
    <div className="flex items-center gap-1">
      <Zap className="h-4 w-4 text-yellow-400" />
      <span className="text-sm font-medium">{queriesLeft}</span>
    </div>
  );
}
