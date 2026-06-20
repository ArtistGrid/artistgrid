import { createContext, use, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, Outlet } from "react-router-dom";

const HeaderSlotsContext = createContext<{
  centerEl: HTMLDivElement | null;
  rightEl: HTMLDivElement | null;
}>({ centerEl: null, rightEl: null });

export function useHeaderSlots(center: ReactNode, right?: ReactNode) {
  const { centerEl, rightEl } = use(HeaderSlotsContext);
  if (!centerEl) return null;
  return (
    <>
      {createPortal(center, centerEl)}
      {right && rightEl ? createPortal(right, rightEl) : null}
    </>
  );
}

export function Layout() {
  const centerRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<{ centerEl: HTMLDivElement | null; rightEl: HTMLDivElement | null }>({
    centerEl: null,
    rightEl: null,
  });
  const [slotsReady, setSlotsReady] = useState(false);

  useLayoutEffect(() => {
    slotsRef.current = { centerEl: centerRef.current, rightEl: rightRef.current };
    setSlotsReady(true);
  }, []);

  const contextValue = useMemo(() => slotsRef.current, [slotsReady]);

  return (
    <HeaderSlotsContext.Provider value={contextValue}>
      <header className="sticky top-0 z-30 py-3.5 bg-black/40 backdrop-blur-2xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 sm:px-6 h-11">
          <Link
            to="/"
            className="text-xl font-bold bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent tracking-tight flex-shrink-0 hidden sm:block"
          >
            ArtistGrid
          </Link>
          <div ref={centerRef} className="flex-1 min-w-0 flex items-center" />
          <div ref={rightRef} className="flex items-center gap-1.5 flex-shrink-0" />
        </div>
      </header>
      <Outlet />
    </HeaderSlotsContext.Provider>
  );
}
