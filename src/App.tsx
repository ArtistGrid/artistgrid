import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "./providers";
import { GlobalPlayer } from "@/components/global-player";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "./components/layout";
import Home from "./pages/Home";
import View from "./pages/View";
import Donate from "./pages/Donate";

export default function App() {
  return (
    <BrowserRouter>
      <PlayerProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/view" element={<View />} />
            <Route path="/donate" element={<Donate />} />
          </Route>
        </Routes>
        <GlobalPlayer />
        <Toaster />
      </PlayerProvider>
    </BrowserRouter>
  );
}
