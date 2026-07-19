import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "./polyfills";
import "./index.css";
import App from "./App";

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
  "e.useCache",
  "e.target.tagName.toLowerCase",
  "Maximum call stack size exceeded",
  "RangeError: Maximum call stack size exceeded",
  "NotSupportedError: The operation is not supported",
];

function shouldDropError(msg: string, type: string): boolean {
  if (type.includes("React ErrorBoundary")) return true;
  if (msg === "Aa" || msg === "fa") return true;
  return DROPPED_ERROR_SUBSTRINGS.some((s) => msg.includes(s));
}

Sentry.init({
  dsn: "https://40ac583f39b8406a92d73e038423e756@app.glitchtip.com/25380",
  tracesSampleRate: 0.01,
  beforeSend(event) {
    const value = event.exception?.values?.[0]?.value ?? "";
    const type = event.exception?.values?.[0]?.type ?? "";
    if (shouldDropError(value, type)) {
      return null;
    }
    return event;
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
);
