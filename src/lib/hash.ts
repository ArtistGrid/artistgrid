export async function xxh3Hash(input: string): Promise<string> {
  const g = globalThis as typeof globalThis & { Buffer?: unknown };
  if (typeof g.Buffer === "undefined") {
    const { Buffer } = await import("buffer");
    g.Buffer = Buffer;
  }
  const { xxh3String } = await import("@apollosoftwarexyz/xxh3");
  const bytes = new TextEncoder().encode(input);
  return xxh3String(bytes);
}
