import * as React from "react";
import { cn } from "@/lib/utils";

function Badge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex w-fit items-center rounded-full border border-transparent px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
