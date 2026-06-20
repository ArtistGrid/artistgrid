import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "./providers";
import { GlobalPlayer } from "@/components/global-player";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "./components/layout";
import Home from "./pages/Home";

const View = lazy(() => import("./pages/View"));
const Donate = lazy(() => import("./pages/Donate"));

export default function App() {
  return (
    <BrowserRouter>
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
      </PlayerProvider>
    </BrowserRouter>
  );
}
