import { useEffect, useState } from "react";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export function GitHubStars() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    fetch("https://api.github.com/repos/jamesmoore24/treegpt")
      .then((res) => res.json())
      .then((data) => setStars(data.stargazers_count))
      .catch((error) => console.error("Error fetching GitHub stars:", error));
  }, []);

  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              window.open("https://github.com/jamesmoore24/treegpt", "_blank")
            }
          >
            <div className="flex items-center gap-1">
              <GitHubLogoIcon className="h-4 w-4" />
              {stars !== null && (
                <span className="text-xs font-medium">{stars}</span>
              )}
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Star us on GitHub!</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
