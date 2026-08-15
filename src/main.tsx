import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ChunkErrorBoundary } from "./components/error-boundary";
import { reloadOnStaleError, clearCacheAndReload } from "@/src/lib/stale-reload";

const DROPPED_ERROR_SUBSTRINGS = [
  "Rejected",
  "is not a valid JavaScript MIME type",
  "Load failed",
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
  "runtime.sendMessage",
  "MetaMask",
  "window.webkit.messageHandlers",
  "sw.js",
  "Service Worker script execution timed out",
  "Failed to register a ServiceWorker",
  "Failed to read the 'localStorage'",
  "The operation is insecure",
  "__firefox__",
  "window.ethereum",
  "SCDynimacBridge",
  "contentScriptData",
  "NotReadableError",
  "AbortError",
  "signal is aborted",
  "plausible.canine.tools",
  "Array buffer allocation failed",
  "Clipboard request was superseded",
  "NotFoundError: The object can not be found here",
  "invalid origin",
  "UnavailableError",
  "No Listener: tabs:outgoing.message.ready",
  "This script should only be loaded in a browser extension",
  "NotSupportedError: Failed to load because no supported source was found",
  "Java object is gone",
  "Error invoking postMessage",
  "Can't find variable: CONFIG",
  "Can't find variable: EmptyRanges",
  "Can't find variable: __gCrWeb",
  "Can't find variable: _G",
  "vc_text_indicators_context is not defined",
  "e.useCache",
  "e.target.tagName.toLowerCase",
  "M_ID",
  "Maximum call stack size exceeded",
  "RangeError: Maximum call stack size exceeded",
  "NotSupportedError: The operation is not supported",
  "captured as promise rejection",
  "lyricsplus",
  "onMessage",
  "contentScriptHrefChanged",
  "prjktla",
  "chrome-extension://",
  "webkit-masked-url",
  "__MACOSX",
  "beacon.min.js",
  "ucConfig",
  "getQuettaInfo",
  "provider is not defined",
  "Jsloader error",
  "WKWebView API client did not respond",
  "webkitCurrentPlayback",
  "media.currentTime",
  "Message Timeout",
  "Internal error",
  "Cannot call a class as a function",
  "The fetching process for the media resource was aborted",
  "Fetch is aborted",
  "writeText",
  "Document is not focused",
  "DarkReader",
  "lyrics-plus-backend",
  "__DLD__",
  "frontend.min.js",
];

const EXTENSION_STACK_MARKERS = [
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "edge-extension://",
  "__DLD__",
  "frontend.min.js",
];

function shouldDropError(msg: string, type: string): boolean {
  if (type.includes("React ErrorBoundary")) return true;
  if (msg === "Aa" || msg === "fa" || msg === "Ba") return true;
  return DROPPED_ERROR_SUBSTRINGS.some((s) => msg.includes(s));
}

function hasExtensionFrame(event: { exception?: { values?: Array<{ stacktrace?: { frames?: Array<{ filename?: string }> } }> } }): boolean {
  const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
  return frames.some((f) => EXTENSION_STACK_MARKERS.some((m) => (f.filename ?? "").includes(m)));
}

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
          const value = event.exception?.values?.[0]?.value ?? event.message ?? "";
          const type = event.exception?.values?.[0]?.type ?? "";
          if (shouldDropError(value, type) || hasExtensionFrame(event)) {
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
