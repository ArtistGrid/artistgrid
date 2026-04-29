import { memo } from "react";
import { Github, HandCoins, BarChart3, AlertTriangle } from "lucide-react";
import { DiscordIcon } from "./header";
export const Footer = memo(
  ({
    displayedCount,
    totalCount,
    onDonateClick,
    visitorCount,
  }: {
    displayedCount: number;
    totalCount: number;
    onDonateClick: () => void;
    visitorCount: number | null;
  }) => (
    <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-8 mt-12 border-t border-neutral-800">
      <div className="flex flex-col items-center gap-6">
        <p className="text-sm text-neutral-400">
          {displayedCount} of {totalCount} trackers displayed
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <a
            href="https://github.com/ArtistGrid"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <Github className="w-4 h-4" />
            <span>GitHub</span>
          </a>
          <a
            href="https://discord.gg/RdBeMZ2m8S"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <DiscordIcon className="w-4 h-4" />
            <span>Discord</span>
          </a>
          <a
            href="https://plausible.canine.tools/artistgrid.cx/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics</span>
          </a>
          <button
            onClick={onDonateClick}
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <HandCoins className="w-4 h-4" />
            <span>Donate</span>
          </button>
        </div>
        <div className="text-center space-y-3 pt-4 border-t border-neutral-800 w-full">
          <p className="text-sm text-neutral-300">
            Maintained by{" "}
            <a
              href="https://instagram.com/edideaur"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              edideaur
            </a>
            ,{" "}
            <a
              href="https://discord.com/users/454283756258197544"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              JustAMZ
            </a>
            , and{" "}
            <a href="https://sad.ovh" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
              fucksophie
            </a>
            .
          </p>
          <p className="text-sm text-neutral-400">
            Original trackers are in{" "}
            <a
              href="https://docs.google.com/spreadsheets/d/1XLlR7PnniA8WjLilQPu3Rhx1aLZ4MT2ysIeXp8XSYJA/htmlview"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              this Google Sheet
            </a>
            .
          </p>
          <p className="text-xs text-neutral-500">
            We are not affiliated with TrackerHub or any of the artists mentioned.
          </p>
          {visitorCount !== null && (
            <p className="text-sm text-neutral-500 pt-2">You are visitor #{visitorCount.toLocaleString()}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-900/50 px-4 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4" />
          <span>ArtistGrid does not host any illegal content. All links point to third-party services.</span>
        </div>
      </div>
    </footer>
  )
);
