import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

// Serialize all FFmpeg operations. The underlying instance shares a single
// in-memory (MEMFS) filesystem, so concurrent `exec` calls with overlapping
// temp filenames would corrupt each other's data. A promise chain guarantees
// only one operation touches the instance at a time and bounds peak memory to
// a single file.
let operationChain: Promise<unknown> = Promise.resolve();

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = "/ffmpeg";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await loadingPromise;
  } catch (e) {
    loadingPromise = null;
    throw e;
  }
}

let tempCounter = 0;
function nextTempId(): string {
  tempCounter = (tempCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `ag_${Date.now().toString(36)}_${tempCounter.toString(36)}`;
}

export interface MetadataInput {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  coverUrl?: string;
}

export type TranscodeFormat = "original" | "mp3" | "opus" | "ogg" | "flac" | "wav";

function getTranscodeArgs(format: TranscodeFormat): { args: string[]; ext: string; mime: string } {
  switch (format) {
    case "mp3":   return { args: ["-c:a", "libmp3lame", "-q:a", "2"], ext: "mp3",  mime: "audio/mpeg" };
    case "opus":  return { args: ["-c:a", "libopus", "-b:a", "128k"], ext: "opus", mime: "audio/opus" };
    case "ogg":   return { args: ["-c:a", "libvorbis", "-q:a", "4"], ext: "ogg",  mime: "audio/ogg" };
    case "flac":  return { args: ["-c:a", "flac"], ext: "flac", mime: "audio/flac" };
    case "wav":   return { args: ["-c:a", "pcm_s16le"], ext: "wav", mime: "audio/wav" };
    default:      return { args: ["-c:a", "copy"], ext: "", mime: "" };
  }
}

function getAudioExtension(blob: Blob): string {
  const t = blob.type;
  if (t.includes("flac")) return "flac";
  if (t.includes("wav")) return "wav";
  if (t.includes("ogg") || t.includes("opus")) return "ogg";
  if (t.includes("mp4") || t.includes("m4a")) return "m4a";
  if (t.includes("aac")) return "aac";
  if (t.includes("webm")) return "weba";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  return "mp3";
}

function buildMetadataArgs(metadata: MetadataInput): string[] {
  const args: string[] = [];
  if (metadata.title) args.push("-metadata", `title=${metadata.title}`);
  if (metadata.artist) args.push("-metadata", `artist=${metadata.artist}`);
  if (metadata.album) args.push("-metadata", `album=${metadata.album}`);
  if (metadata.year) args.push("-metadata", `date=${metadata.year}`);
  return args;
}

async function fetchCoverArt(
  ffmpeg: FFmpeg,
  coverUrl: string,
  coverName: string
): Promise<{ args: string[]; cleanup: () => Promise<void> }> {
  const noop = async () => {};
  try {
    const res = await fetch(coverUrl, { referrerPolicy: "no-referrer" });
    if (!res.ok) return { args: ["-c", "copy"], cleanup: noop };
    const coverBlob = await res.blob();
    if (!coverBlob.type.startsWith("image/")) return { args: ["-c", "copy"], cleanup: noop };

    const coverExt = coverBlob.type.includes("png") ? "png" : "jpg";
    const coverMime = coverExt === "png" ? "image/png" : "image/jpeg";
    const coverData = new Uint8Array(await coverBlob.arrayBuffer());
    const coverFile = `${coverName}.${coverExt}`;
    await ffmpeg.writeFile(coverFile, coverData);

    return {
      args: [
        "-i", coverFile,
        "-map", "0:a:0",
        "-map", "1:0",
        "-c:a", "copy",
        "-id3v2_version", "3",
        "-metadata:s:v", `mime_type=${coverMime}`,
      ],
      cleanup: async () => {
        try { await ffmpeg.deleteFile(coverFile); } catch {}
      },
    };
  } catch {
    return { args: ["-c", "copy"], cleanup: noop };
  }
}

export async function embedMetadata(
  audioBlob: Blob,
  metadata: MetadataInput,
  format: TranscodeFormat = "original"
): Promise<Blob> {
  const id = nextTempId();
  const inputName = `${id}_in.${getAudioExtension(audioBlob)}`;
  const transcode = getTranscodeArgs(format);
  const outputName = `${id}_out.${transcode.ext || getAudioExtension(audioBlob)}`;
  const coverName = `${id}_cover`;

  const run = operationChain.then(async () => {
    const ffmpeg = await getFFmpeg();
    let coverCleanup: () => Promise<void> = async () => {};
    try {
      const audioData = new Uint8Array(await audioBlob.arrayBuffer());
      await ffmpeg.writeFile(inputName, audioData);

      const cover = metadata.coverUrl
        ? await fetchCoverArt(ffmpeg, metadata.coverUrl, coverName)
        : { args: ["-c", "copy"] as string[], cleanup: async () => {} };
      coverCleanup = cover.cleanup;

      const args = [
        "-i", inputName,
        ...cover.args,
        ...transcode.args,
        ...buildMetadataArgs(metadata),
        "-y", outputName,
      ];

      await ffmpeg.exec(args);

      const outputData = await ffmpeg.readFile(outputName);
      const outputType = transcode.mime || audioBlob.type || "audio/mpeg";
      const outputBlob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: outputType });
      return outputBlob;
    } finally {
      try { await ffmpeg.deleteFile(inputName); } catch {}
      try { await ffmpeg.deleteFile(outputName); } catch {}
      await coverCleanup();
    }
  });

  // Keep the chain alive regardless of success/failure so later operations still run.
  operationChain = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}
