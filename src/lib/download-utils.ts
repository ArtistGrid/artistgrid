const AUDIO_EXTENSIONS = ["mp3", "m4a", "ogg", "wav", "flac", "opus", "aac", "weba", "webm"] as const;

export function getFileExtension(url: string, contentType?: string): string {
  if (contentType) {
    if (contentType.includes("audio/mpeg") || contentType.includes("audio/mp3")) return "mp3";
    if (contentType.includes("audio/mp4") || contentType.includes("audio/m4a")) return "m4a";
    if (contentType.includes("audio/ogg") || contentType.includes("audio/opus"))
      return contentType.includes("opus") ? "opus" : "ogg";
    if (contentType.includes("audio/wav")) return "wav";
    if (contentType.includes("audio/flac")) return "flac";
  }
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {}
  const match = pathname.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = match?.[1];
  if (ext && (AUDIO_EXTENSIONS as readonly string[]).includes(ext)) return ext;
  return "mp3";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
