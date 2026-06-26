import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useParams, useSearchParams } from "react-router-dom";
import { PlayerProvider } from "./providers";
import { GlobalPlayer } from "@/components/global-player";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "./components/layout";
import Home from "./pages/Home";

const View = lazy(() => import("./pages/View"));
const Donate = lazy(() => import("./pages/Donate"));

function ShTrackerView() {
  const { trackerId } = useParams<{ trackerId: string }>();
  const [searchParams] = useSearchParams();
  const artist = searchParams.get("artist") || "";
  const track = searchParams.get("track") || "";
  const tab = searchParams.get("tab") || "";

  const qs = [];
  if (artist) qs.push(`artist=${encodeURIComponent(artist)}`);
  if (track) qs.push(`track=${encodeURIComponent(track)}`);
  if (tab) qs.push(`tab=${encodeURIComponent(tab)}`);
  const queryString = qs.length > 0 ? `?${qs.join("&")}` : "";

  return (
    <Suspense fallback={null}>
      <View trackerId={trackerId || ""} />
    </Suspense>
  );
}

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
      </PlayerProvider>
    </BrowserRouter>
  );
}
