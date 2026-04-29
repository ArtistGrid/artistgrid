import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "./providers";
import { GlobalPlayer } from "@/components/global-player";
import { Toaster } from "@/components/ui/toaster";
import Home from "./pages/Home";
import View from "./pages/View";
export default function App() {
  return (
    <BrowserRouter>
      <PlayerProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/view" element={<View />} />
        </Routes>
        <GlobalPlayer />
        <Toaster />
      </PlayerProvider>
    </BrowserRouter>
  );
}
