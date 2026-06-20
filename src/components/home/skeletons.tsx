import { memo } from "react";
import { CircleSlash } from "lucide-react";
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
export const ErrorMessage = memo(({ message }: { message: string }) => (
  <div className="min-h-screen bg-black flex items-center justify-center p-4">
    <div className="glass-elevated rounded-2xl p-8 max-w-md w-full text-center">
      <h1 className="text-2xl font-bold text-white mb-2">Error Loading Artists</h1>
      <p className="text-white/50">{message}</p>
    </div>
  </div>
));
export const NoResultsMessage = memo(({ searchQuery }: { searchQuery: string }) => (
  <div className="text-center py-20 flex flex-col items-center">
    <CircleSlash className="w-16 h-16 text-white/20 mb-4" />
    <p className="text-lg font-medium text-white/70">No Artists Found</p>
    <p className="text-white/35 mt-1">
      {searchQuery ? `Your search for "${searchQuery}" didn't return any results.` : "Try adjusting your filters."}
    </p>
  </div>
));
