import { loadSettings } from "./settings";

export function logError(...args: unknown[]): void {
  if (loadSettings().behavior.detailedErrors) {
    console.error(...args);
  }
}
