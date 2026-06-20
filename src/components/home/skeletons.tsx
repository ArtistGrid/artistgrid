import { memo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const GallerySkeleton = memo(() => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
    {Array.from({ length: 18 }).map((_, i) => (
      <div key={i} className="glass rounded-2xl p-3">
        <Skeleton className="aspect-square w-full mb-3 bg-white/[0.08] rounded-xl" />
        <Skeleton className="h-4 w-3/4 bg-white/[0.08] rounded-lg" />
      </div>
    ))}
  </div>
));
