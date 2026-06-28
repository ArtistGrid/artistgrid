import { memo } from "react";
import { Search, X, SlidersHorizontal, Info, HandCoins, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { useSettingsModal } from "@/src/App";
import type { ArtistFilterOptions } from "@/src/types";
import { trackEvent, DISCORD_INVITE } from "@/src/lib/home-constants";

export const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

export const FilterControls = memo(
  ({
    options,
    onFilterChange,
  }: {
    options: ArtistFilterOptions;
    onFilterChange: (key: keyof ArtistFilterOptions, value: boolean) => void;
  }) => {
    const hasActiveFilter =
      options.showWorking || options.showUpdated || options.showStarred || !options.showAlts || options.sortByTrends;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="glass-flat rounded-xl text-white/70 hover:text-white relative h-10 w-10"
            aria-label="Filter options"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {hasActiveFilter && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 glass-elevated border-0 rounded-2xl text-white/80 p-1">
          <DropdownMenuLabel className="text-white/40 text-xs font-medium uppercase tracking-wider px-2 py-1.5">
            Display
          </DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={options.showWorking}
            onCheckedChange={(c) => onFilterChange("showWorking", !!c)}
            className="rounded-xl"
          >
            Working links only
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={options.showUpdated}
            onCheckedChange={(c) => onFilterChange("showUpdated", !!c)}
            className="rounded-xl"
          >
            Updated trackers only
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={options.showStarred}
            onCheckedChange={(c) => onFilterChange("showStarred", !!c)}
            className="rounded-xl"
          >
            Starred trackers only
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={options.showAlts}
            onCheckedChange={(c) => onFilterChange("showAlts", !!c)}
            className="rounded-xl"
          >
            Show alt trackers
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator className="bg-white/[0.08] my-1" />
          <DropdownMenuLabel className="text-white/40 text-xs font-medium uppercase tracking-wider px-2 py-1.5">
            Sort
          </DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={options.sortByTrends}
            onCheckedChange={(c) => onFilterChange("sortByTrends", !!c)}
            className="rounded-xl"
          >
            Sort by popularity
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);

export const HeaderActions = memo(({ onInfoClick, onDonateClick }: { onInfoClick: () => void; onDonateClick: () => void }) => {
  const { setSettingsOpen } = useSettingsModal();
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          trackEvent("Header Click", { button: "Discord" });
          window.open(DISCORD_INVITE, "_blank", "noopener,noreferrer");
        }}
        aria-label="Discord"
        className="glass-flat rounded-xl text-white/50 hover:text-white h-10 w-10"
      >
        <DiscordIcon className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDonateClick}
        aria-label="Donate"
        className="glass-flat rounded-xl text-white/50 hover:text-white h-10 w-10"
      >
        <HandCoins className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSettingsOpen(true)}
        aria-label="Settings"
        className="glass-flat rounded-xl text-white/50 hover:text-white h-10 w-10"
      >
        <Settings className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onInfoClick}
        aria-label="About"
        className="glass-flat rounded-xl text-white/50 hover:text-white h-10 w-10"
      >
        <Info className="w-4 h-4" />
      </Button>
    </>
  );
});

export const HomeHeaderCenter = memo(
  ({ searchQuery, setSearchQuery }: { searchQuery: string; setSearchQuery: (q: string) => void }) => (
    <div className="relative flex-1 min-w-0">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
      <Input
        type="text"
        placeholder="Search artists..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="glass-flat rounded-xl w-full pl-10 pr-9 h-11 text-sm text-white placeholder:text-white/25 border-0 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:bg-white/[0.07]"
        aria-label="Search artists"
        autoFocus
      />
      {searchQuery && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-white/30 hover:text-white hover:bg-transparent"
          onClick={() => setSearchQuery("")}
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
);
