import { memo } from "react";
import { CircleSlash } from "lucide-react";

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
