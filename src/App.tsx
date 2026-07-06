import { lazy, Suspense, useState, useCallback, useMemo, createContext, use } from "react";
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

interface SettingsModalContextType {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}
const SettingsModalContext = createContext<SettingsModalContextType>({ settingsOpen: false, setSettingsOpen: () => {} });
export function useSettingsModal() {
  return use(SettingsModalContext);
}

function ShTrackerView() {
  const { trackerId } = useParams<{ trackerId: string }>();

  return (
    <ChunkErrorBoundary>
      <Suspense fallback={null}>
        <View trackerId={trackerId || ""} />
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
                  path="/sh/:trackerId"
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
