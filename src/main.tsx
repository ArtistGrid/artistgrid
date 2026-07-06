import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "./index.css";
import App from "./App";

Sentry.init({
  dsn: "https://40ac583f39b8406a92d73e038423e756@app.glitchtip.com/25380",
  tracesSampleRate: 0.01,
  beforeSend(event) {
    if (event.exception?.values?.[0]?.type === "Error" && event.exception.values[0].value === "Rejected") return null;
    const msg = event.exception?.values?.[0]?.value ?? "";
    if (msg.includes("is not a valid JavaScript MIME type")) return null;
    if (msg.includes("Failed to fetch dynamically imported module")) return null;
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
