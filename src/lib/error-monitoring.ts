import { browserTracingIntegration, init } from "@sentry/react";
import { hasExtensionFrame, shouldDropError } from "./error-filters";

export function initErrorMonitoring() {
  init({
    dsn: "https://9c47ffd2d3824883a759595f54c03b8e@rustrak-api.edideaur.works/1",
    release: __APP_VERSION__,
    tracesSampleRate: 0.1,
    integrations: [browserTracingIntegration()],
    beforeSend(event) {
      const values = event.exception?.values ?? [];
      const mainValue = values[0]?.value ?? event.message ?? "";
      const mainType = values[0]?.type ?? "";
      if (
        shouldDropError(mainValue, mainType) ||
        values.some((value) => shouldDropError(value.value ?? "", value.type ?? "")) ||
        hasExtensionFrame(event)
      )
        return null;
      return event;
    },
  });
}
