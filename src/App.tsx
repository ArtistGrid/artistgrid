import { lazy, Suspense, useState, useCallback, useMemo, createContext, use } from "react";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { PlayerProvider } from "./providers";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { GlobalPlayer } from "@/components/global-player";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "./components/layout";
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
    <Suspense fallback={null}>
      <View trackerId={trackerId || ""} />
    </Suspense>
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
                    <Suspense fallback={null}>
                      <View />
                    </Suspense>
                  }
                />
                <Route
                  path="/sh/:trackerId"
                  element={<ShTrackerView />}
                />
                <Route
                  path="/donate"
                  element={
                    <Suspense fallback={null}>
                      <Donate />
                    </Suspense>
                  }
                />
              </Route>
            </Routes>
            <GlobalPlayer />
            <Toaster />
            {settingsOpen && (
              <Suspense fallback={null}>
                <SettingsModal onClose={closeSettings} />
              </Suspense>
            )}
          </PlayerProvider>
        </SettingsProvider>
      </SettingsModalContext.Provider>
    </BrowserRouter>
  );
}
