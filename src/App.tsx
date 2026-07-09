import { lazy, Suspense, useState, useCallback, useMemo } from "react";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";

import { PlayerProvider } from "./providers";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { GlobalPlayer } from "@/components/global-player";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "./components/layout";
import { ChunkErrorBoundary } from "@/src/components/error-boundary";
import Home from "./pages/Home";

const View = lazy(() => import("./pages/View"));
const Donate = lazy(() => import("./pages/Donate"));
const SettingsModal = lazy(() => import("./pages/Settings"));

import { SettingsModalContext, useSettingsModal } from "./components/settings-modal-context";

function IframeNotice() {
  const [visible, setVisible] = useState(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  });
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-w-md mx-4 p-8 rounded-2xl glass-elevated text-center space-y-4">
        <h1 className="text-xl font-bold text-white">ArtistGrid</h1>
        <p className="text-sm text-neutral-300 leading-relaxed">
          Hi. ArtistGrid has not received anything in donations in over a year and a half.
          Please consider supporting us so we can keep building and improving the site.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <a
            href="https://discord.gg/YuwTae6QC4"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-[#5865F2] text-white text-sm font-medium hover:opacity-90 transition-opacity w-full sm:w-auto"
          >
            Join our Discord
          </a>
          <a
            href="/donate"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors w-full sm:w-auto"
          >
            Donate
          </a>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors pt-2"
        >
          Continue to site
        </button>
      </div>
    </div>
  );
}

function ShTrackerView() {
  const { trackerId, tabSlug } = useParams<{ trackerId: string; tabSlug: string }>();

  return (
    <ChunkErrorBoundary>
      <Suspense fallback={null}>
        <View trackerId={trackerId || ""} initialTab={tabSlug ? decodeURIComponent(tabSlug) : undefined} />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const modalCtx = useMemo(() => ({ settingsOpen, setSettingsOpen }), [settingsOpen]);

  return (
    <BrowserRouter>
      <SettingsModalContext.Provider value={modalCtx}>
        <SettingsProvider>
          <PlayerProvider>
            <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Home />} />
                  <Route
                    path="/view"
                    element={
                      <ChunkErrorBoundary>
                        <Suspense fallback={null}>
                          <View />
                        </Suspense>
                      </ChunkErrorBoundary>
                    }
                  />
                  <Route
                    path="/sh/:trackerId/:tabSlug?"
                    element={<ShTrackerView />}
                  />
                  <Route
                    path="/donate"
                    element={
                      <ChunkErrorBoundary>
                        <Suspense fallback={null}>
                          <Donate />
                        </Suspense>
                      </ChunkErrorBoundary>
                    }
                  />
                </Route>
              </Routes>
              <GlobalPlayer />
              <KeyboardShortcuts />
              <Toaster />
              <IframeNotice />
              {settingsOpen && (
                <ChunkErrorBoundary>
                  <Suspense fallback={null}>
                    <SettingsModal onClose={closeSettings} />
                  </Suspense>
                </ChunkErrorBoundary>
              )}
            </PlayerProvider>
          </SettingsProvider>
        </SettingsModalContext.Provider>
    </BrowserRouter>
  );
}
