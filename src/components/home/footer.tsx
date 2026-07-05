import { memo } from "react";
import { Github, HandCoins, BarChart3, AlertTriangle } from "lucide-react";
import { DiscordIcon } from "./header";
import { DISCORD_INVITE } from "@/src/lib/home-constants";
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
    <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-10 mt-16 border-t border-white/[0.07]">
      <div className="flex flex-col items-center gap-5">
        <p className="text-sm text-white/35 tabular-nums">
          {displayedCount} of {totalCount} trackers
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
          <a
            href="https://github.com/ArtistGrid"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-white/35 hover:text-white/70 transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-white/35 hover:text-white/70 transition-colors"
          >
            <DiscordIcon className="w-3.5 h-3.5" />
            <span>Discord</span>
          </a>
          <a
            href="https://plausible.canine.tools/artistgrid.cx/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-white/35 hover:text-white/70 transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics</span>
          </a>
          <button
            type="button"
            onClick={onDonateClick}
            className="flex items-center gap-1.5 text-sm text-white/35 hover:text-white/70 transition-colors"
          >
            <HandCoins className="w-3.5 h-3.5" />
            <span>Donate</span>
          </button>
        </div>
        <div className="text-center space-y-2 pt-4 border-t border-white/[0.07] w-full">
          <p className="text-sm text-white/40">
            Maintained by{" "}
            <a href="https://instagram.com/edideaur" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors underline underline-offset-2">
              edideaur
            </a>
          </p>
          <p className="text-sm text-white/35">
            Original trackers are in{" "}
            <a
              href="https://docs.google.com/spreadsheets/d/1XLlR7PnniA8WjLilQPu3Rhx1aLZ4MT2ysIeXp8XSYJA/htmlview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/55 hover:text-white transition-colors underline underline-offset-2"
            >
              this Google Sheet
            </a>
            .
          </p>
          <p className="text-xs text-white/20">
            We are not affiliated with TrackerHub or any of the artists mentioned.
          </p>
          {visitorCount !== null && (
            <p className="text-sm text-white/25 pt-1">Visitor #{visitorCount.toLocaleString()}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/25 glass-flat rounded-xl px-4 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>ArtistGrid does not host any illegal content. All links point to third-party services.</span>
        </div>
      </div>
    </footer>
  )
);
