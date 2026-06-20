import { memo } from "react";
import { Search, X, Filter, Info, HandCoins } from "lucide-react";
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
import type { ArtistFilterOptions } from "@/src/types";
import { trackEvent } from "@/src/lib/home-constants";
export const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);
const FilterControls = memo(
  ({
    options,
    onFilterChange,
    useSheet,
    onUseSheetChange,
  }: {
    options: ArtistFilterOptions;
    onFilterChange: (key: keyof ArtistFilterOptions, value: boolean) => void;
    useSheet: boolean;
    onUseSheetChange: (value: boolean) => void;
  }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white"
          aria-label="Filter options"
        >
          <Filter className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-neutral-950 border-neutral-800 text-neutral-200">
        <DropdownMenuLabel>Display Options</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-neutral-800" />
        <DropdownMenuCheckboxItem
          checked={options.showWorking}
          onCheckedChange={(c) => onFilterChange("showWorking", !!c)}
        >
          Show working links only
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={options.showUpdated}
          onCheckedChange={(c) => onFilterChange("showUpdated", !!c)}
        >
          Show updated trackers only
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={options.showStarred}
          onCheckedChange={(c) => onFilterChange("showStarred", !!c)}
        >
          Show starred trackers only
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={options.showAlts} onCheckedChange={(c) => onFilterChange("showAlts", !!c)}>
          Show alt trackers
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator className="bg-neutral-800" />
        <DropdownMenuLabel>Sorting</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={options.sortByTrends}
          onCheckedChange={(c) => onFilterChange("sortByTrends", !!c)}
        >
          Sort by popularity
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator className="bg-neutral-800" />
        <DropdownMenuLabel>Data Source</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={useSheet} onCheckedChange={onUseSheetChange}>
          Use remote CSV
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
);
const HeaderActions = memo(
  ({ onInfoClick, onDonateClick }: { onInfoClick: () => void; onDonateClick: () => void }) => (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => {
          trackEvent("Header Click", { button: "Discord" });
          window.open("https://discord.gg/n67DkxMt2c", "_blank", "noopener,noreferrer");
        }}
        aria-label="Discord"
        className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white hover:text-white"
      >
        <DiscordIcon className="w-5 h-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onDonateClick}
        aria-label="Donate"
        className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white hover:text-white"
      >
        <HandCoins className="w-5 h-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onInfoClick}
        aria-label="About"
        className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white hover:text-white"
      >
        <Info className="w-5 h-5" />
      </Button>
    </div>
  )
);
export const Header = memo(
  ({
    searchQuery,
    setSearchQuery,
    filterOptions,
    onFilterChange,
    onInfoClick,
    onDonateClick,
    useSheet,
    onUseSheetChange,
  }: {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    filterOptions: ArtistFilterOptions;
    onFilterChange: (k: keyof ArtistFilterOptions, v: boolean) => void;
    onInfoClick: () => void;
    onDonateClick: () => void;
    useSheet: boolean;
    onUseSheetChange: (v: boolean) => void;
  }) => (
    <header className="sticky top-0 z-30 py-4 bg-black/70 backdrop-blur-lg border-b border-neutral-900 mb-8">
      <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 sm:px-6">
        <h1 className="text-2xl font-bold bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent hidden sm:block">
          ArtistGrid
        </h1>
        <div className="sm:hidden">
          <HeaderActions onInfoClick={onInfoClick} onDonateClick={onDonateClick} />
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search artists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-neutral-900 border-2 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-white/50 rounded-xl w-full pl-12 pr-10 h-12"
            aria-label="Search artists"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-neutral-500 hover:text-white"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FilterControls
            options={filterOptions}
            onFilterChange={onFilterChange}
            useSheet={useSheet}
            onUseSheetChange={onUseSheetChange}
          />
          <div className="hidden sm:flex">
            <HeaderActions onInfoClick={onInfoClick} onDonateClick={onDonateClick} />
          </div>
        </div>
      </div>
    </header>
  )
);
