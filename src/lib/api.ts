export const API_BASE = "https://trackerapi-2.artistgrid.cx";
const API_FALLBACK = "https://trackerapi-1.artistgrid.cx";
const API_FALLBACK_2 = "https://trackerapi-3.artistgrid.cx";
export async function fetchWithFallback(endpoint: string, options?: RequestInit): Promise<Response> {
  const endpoints = [API_BASE, API_FALLBACK, API_FALLBACK_2];
  let lastError: Error | null = null;
  for (const base of endpoints) {
    try {
      const res = await fetch(`${base}${endpoint}`, options);
      if (res.ok || res.type === "opaqueredirect") return res;
    } catch (e) {
      lastError = e as Error;
    }
  }
  throw lastError || new Error("All endpoints failed");
}
