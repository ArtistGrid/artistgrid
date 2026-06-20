import { createPortal } from "react-dom";
import { Link, Outlet } from "react-router-dom";
import type { ReactNode } from "react";

export function useHeaderSlots(center: ReactNode, right?: ReactNode) {
  const centerEl = typeof document !== "undefined" ? document.getElementById("header-center") : null;
  const rightEl = typeof document !== "undefined" ? document.getElementById("header-right") : null;
  if (!centerEl) return null;
  return (
    <>
      {createPortal(center, centerEl)}
      {right && rightEl ? createPortal(right, rightEl) : null}
    </>
  );
}

export function Layout() {
  return (
    <>
      <header className="sticky top-0 z-30 py-3.5 bg-black/40 backdrop-blur-2xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 sm:px-6 h-11">
          <Link
            to="/"
            className="text-xl font-bold bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent tracking-tight flex-shrink-0 hidden sm:block"
          >
            ArtistGrid
          </Link>
          <div id="header-center" className="flex-1 min-w-0 flex items-center" />
          <div id="header-right" className="flex items-center gap-1.5 flex-shrink-0" />
        </div>
      </header>
      <Outlet />
    </>
  );
}
