import { memo } from "react";
import { CircleSlash } from "lucide-react";
import { t } from "@/src/lib/i18n";
export const ErrorMessage = memo(({ message }: { message: string }) => (
  <div className="min-h-screen bg-black flex items-center justify-center p-4">
    <div className="glass-elevated rounded-2xl p-8 max-w-md w-full text-center">
      <h1 className="text-2xl font-bold text-white mb-2">{t("home.error.title")}</h1>
      <p className="text-white/50">{message}</p>
    </div>
  </div>
));
export const NoResultsMessage = memo(({ searchQuery }: { searchQuery: string }) => (
  <div className="text-center py-20 flex flex-col items-center">
    <CircleSlash className="w-16 h-16 text-white/20 mb-4" />
    <p className="text-lg font-medium text-white/70">{t("home.noResults.title")}</p>
    <p className="text-white/55 mt-1">
      {searchQuery ? t("home.noResults.search", { query: searchQuery }) : t("home.noResults.filters")}
    </p>
  </div>
));
