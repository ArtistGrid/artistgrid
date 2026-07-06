import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "./polyfills";
import "./index.css";
import App from "./App";

Sentry.init({
  dsn: "https://40ac583f39b8406a92d73e038423e756@app.glitchtip.com/25380",
  tracesSampleRate: 0.01,
  beforeSend(event) {
    const msg = event.exception?.values?.[0]?.value ?? "";
    if (
      msg.includes("Rejected") ||
      msg.includes("is not a valid JavaScript MIME type") ||
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("error loading dynamically imported module") ||
      msg.includes("runtime.sendMessage") ||
      msg.includes("MetaMask") ||
      msg.includes("window.webkit.messageHandlers") ||
      msg.includes("sw.js") ||
      msg.includes("Failed to register a ServiceWorker") ||
      msg.includes("Failed to read the 'localStorage'") ||
      msg.includes("The operation is insecure") ||
      event.exception?.values?.[0]?.type?.includes("React ErrorBoundary")
    ) {
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
