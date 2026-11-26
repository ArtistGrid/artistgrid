import { memo, type ReactNode } from "react";
import { Github, HandCoins, BarChart3 } from "lucide-react";
import { DiscordIcon } from "./header";
import { DISCORD_INVITE } from "@/lib/home-constants";
import { cn } from "@/lib/utils";

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;
const linkCls = "flex items-center gap-1.5 hover:text-white/85 transition-colors";
const creditCls = "text-white/60 hover:text-white transition-colors";

const LINKS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "https://github.com/ArtistGrid", label: "GitHub", icon: <Github className="w-3.5 h-3.5" /> },
  { href: DISCORD_INVITE, label: "Discord", icon: <DiscordIcon className="w-3.5 h-3.5" /> },
  {
    href: "https://plausible.canine.tools/artistgrid.cx/",
    label: "Analytics",
    icon: <BarChart3 className="w-3.5 h-3.5" />,
  },
];

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-white/35 text-center", className)}>
      ArtistGrid does not host, store, or distribute any content. All links point to third-party services. Not
      affiliated with Google, TrackerHub, or any artists.
    </p>
  );
}

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
    <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-8 mt-16 border-t border-white/[0.07] space-y-5 text-sm text-white/50">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 tabular-nums">
          <span>
            {displayedCount} of {totalCount} trackers
          </span>
          {visitorCount !== null && <span className="text-white/35">Visitor #{visitorCount.toLocaleString()}</span>}
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {LINKS.map(({ href, label, icon }) => (
            <a key={label} href={href} {...ext} className={linkCls}>
              {icon}
              {label}
            </a>
          ))}
          <button type="button" onClick={onDonateClick} className={linkCls}>
            <HandCoins className="w-3.5 h-3.5" />
            Donate
          </button>
        </nav>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pt-5 border-t border-white/[0.05] text-xs">
        <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1 text-white/40 sm:whitespace-nowrap">
          <span>
            Maintained by{" "}
            <a href="https://instagram.com/edideaur" {...ext} className={creditCls}>
              edideaur
            </a>
          </span>
          <span>
            Originally by{" "}
            <a href="https://instagram.com/aledio.m" {...ext} className={creditCls}>
              JustAMZ
            </a>
          </span>
          <a
            href="https://docs.google.com/spreadsheets/d/1XLlR7PnniA8WjLilQPu3Rhx1aLZ4MT2ysIeXp8XSYJA/htmlview"
            {...ext}
            className={creditCls}
          >
            Original sheet
          </a>
        </div>
        <Disclaimer className="sm:max-w-md sm:text-right" />
      </div>
    </footer>
  )
);
