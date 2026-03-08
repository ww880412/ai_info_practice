import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className, value = 0, ...props }, ref) => {
  const safeValue = clamp(value);

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-accent", className)}
      {...props}
    >
      <div className="h-full bg-primary transition-all" style={{ width: `${safeValue}%` }} />
    </div>
  );
});
Progress.displayName = "Progress";

export { Progress };
