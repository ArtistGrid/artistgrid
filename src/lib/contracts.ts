import type { DownloadContextType } from "@/src/components/download-manager";
const REQUIRED_METHODS = [
  "setIsMinimized",
  "startDownload",
  "clearCompleted",
  "dismissJob",
  "retryFailed",
  "downloadAsIs",
] as const;
function hasRequiredMethods(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return REQUIRED_METHODS.every((name) => typeof record[name] === "function");
}
export function assertDownloadManagerContract(ctx: unknown): ctx is DownloadContextType {
  return hasRequiredMethods(ctx);
}
