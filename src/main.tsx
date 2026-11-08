import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ChunkErrorBoundary } from "./components/error-boundary";
import { reloadOnStaleError, clearCacheAndReload } from "@/src/lib/stale-reload";
function installStaleAssetRecovery() {
  window.addEventListener("error", (event) => {
    reloadOnStaleError(event.message || "");
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as
      | {
          message?: string;
        }
      | undefined;
    reloadOnStaleError(reason?.message ?? String(reason ?? ""));
  });
}
installStaleAssetRecovery();
function initSentry() {
  import("./lib/error-monitoring").then(({ initErrorMonitoring }) => initErrorMonitoring()).catch(() => {});
}
if (
  typeof (
    window as {
      requestIdleCallback?: unknown;
    }
  ).requestIdleCallback === "function"
) {
  (
    window as unknown as {
      requestIdleCallback: (
        cb: (deadline: IdleDeadline) => void,
        opts: {
          timeout: number;
        }
      ) => number;
    }
  ).requestIdleCallback(initSentry, { timeout: 5000 });
} else {
  window.addEventListener("load", () => setTimeout(initSentry, 1500));
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChunkErrorBoundary fallback={<p className="text-center p-8 text-white/60">Something went wrong.</p>}>
      <App />
    </ChunkErrorBoundary>
  </StrictMode>
);
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "r") {
    e.preventDefault();
    clearCacheAndReload();
  }
});
