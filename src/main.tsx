import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ChunkErrorBoundary } from "./components/error-boundary";
import { reloadOnStaleError, clearCacheAndReload } from "@/src/lib/stale-reload";

import { shouldDropError, hasExtensionFrame } from "@/src/lib/error-filters";

function installStaleAssetRecovery() {
  window.addEventListener("error", (event) => {
    reloadOnStaleError(event.message || "");
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { message?: string } | undefined;
    reloadOnStaleError(reason?.message ?? String(reason ?? ""));
  });
}
installStaleAssetRecovery();

function initSentry() {
  import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn: "https://9c47ffd2d3824883a759595f54c03b8e@rustrak-api.edideaur.works/1",
        release: __APP_VERSION__,
        tracesSampleRate: 0.1,
        integrations: [Sentry.browserTracingIntegration()],
        beforeSend(event) {
          const values = event.exception?.values ?? [];
          const mainValue = values[0]?.value ?? event.message ?? "";
          const mainType = values[0]?.type ?? "";
          if (
            shouldDropError(mainValue, mainType) ||
            values.some((v) => shouldDropError(v.value ?? "", v.type ?? "")) ||
            hasExtensionFrame(event)
          ) {
            return null;
          }
          return event;
        },
      });
    })
    .catch(() => {});
}

if (typeof (window as { requestIdleCallback?: unknown }).requestIdleCallback === "function") {
  (
    window as unknown as {
      requestIdleCallback: (cb: (deadline: IdleDeadline) => void, opts: { timeout: number }) => number;
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
