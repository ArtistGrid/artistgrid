export const API_BASE = "https://trackerapi-1.artistgrid.cx";
const API_FALLBACK = "https://trackerapi-2.artistgrid.cx";
export async function fetchWithFallback(endpoint: string, options?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    if (res.ok || res.type === "opaqueredirect") return res;
    throw new Error("Primary failed");
  } catch {
    return fetch(`${API_FALLBACK}${endpoint}`, options);
  }
}
