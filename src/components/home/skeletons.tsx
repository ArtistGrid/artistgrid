import { memo } from "react";
import { CircleSlash } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
export const GallerySkeleton = memo(() => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
    {Array.from({ length: 18 }).map((_, i) => (
      <div key={i} className="bg-neutral-900 rounded-xl p-3">
        <Skeleton className="aspect-square w-full mb-3 bg-neutral-700 rounded-lg" />
        <Skeleton className="h-4 w-3/4 bg-neutral-700 rounded-md" />
      </div>
    ))}
  </div>
));
export const HeaderSkeleton = memo(() => (
  <header className="sticky top-0 z-30 py-4 bg-black/70 backdrop-blur-lg border-b border-neutral-900 mb-8">
    <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 sm:px-6">
      <h1 className="text-2xl font-bold bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent hidden sm:block">
        ArtistGrid
      </h1>
      <Skeleton className="h-12 flex-1 rounded-xl bg-neutral-800" />
      <Skeleton className="h-10 w-10 rounded-lg bg-neutral-800" />
    </div>
  </header>
));
export const ErrorMessage = memo(({ message }: { message: string }) => (
  <div className="min-h-screen bg-black flex items-center justify-center p-4">
    <div className="text-center bg-neutral-900 border border-red-500/30 p-8 rounded-xl max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Error Loading Artists</h1>
      <p className="text-neutral-400">{message}</p>
    </div>
  </div>
));
export const NoResultsMessage = memo(({ searchQuery }: { searchQuery: string }) => (
  <div className="text-center py-20 flex flex-col items-center">
    <CircleSlash className="w-16 h-16 text-neutral-700 mb-4" />
    <p className="text-lg font-medium text-neutral-300">No Artists Found</p>
    <p className="text-neutral-500 mt-1">
      {searchQuery ? `Your search for "${searchQuery}" didn't return any results.` : "Try adjusting your filters."}
    </p>
  </div>
));
