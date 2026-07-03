import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
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

export interface MetadataInput {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  coverUrl?: string;
}

export async function embedMetadata(
  audioBlob: Blob,
  metadata: MetadataInput
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  const audioExt = audioBlob.type.includes("ogg")
    ? "ogg"
    : audioBlob.type.includes("wav")
    ? "wav"
    : audioBlob.type.includes("flac")
    ? "flac"
    : "mp3";

  const inputName = `input.${audioExt}`;
  const outputName = `output.${audioExt}`;

  const audioData = new Uint8Array(await audioBlob.arrayBuffer());
  await ffmpeg.writeFile(inputName, audioData);

  const args: string[] = ["-i", inputName];

  const metadataArgs: string[] = [];
  if (metadata.title) metadataArgs.push("-metadata", `title=${metadata.title}`);
  if (metadata.artist) metadataArgs.push("-metadata", `artist=${metadata.artist}`);
  if (metadata.album) metadataArgs.push("-metadata", `album=${metadata.album}`);
  if (metadata.year) metadataArgs.push("-metadata", `date=${metadata.year}`);

  let coverData: Uint8Array | null = null;
  if (metadata.coverUrl) {
    try {
      const res = await fetch(metadata.coverUrl, { referrerPolicy: "no-referrer" });
      if (res.ok) {
        const coverBlob = await res.blob();
        if (coverBlob.type.startsWith("image/")) {
          coverData = new Uint8Array(await coverBlob.arrayBuffer());
          const coverExt = coverBlob.type.includes("png") ? "png" : "jpg";
          const coverMime = coverExt === "png" ? "image/png" : "image/jpeg";
          await ffmpeg.writeFile(`cover.${coverExt}`, coverData);
          args.push("-i", `cover.${coverExt}`);
          args.push(
            "-map", "0:a:0",
            "-map", "1:0",
            "-c:a", "copy",
            "-id3v2_version", "3",
            "-metadata:s:v", `mime_type=${coverMime}`
          );
        }
      }
    } catch {
    }
  }

  if (!coverData) {
    args.push("-c", "copy");
  }

  args.push(...metadataArgs, "-y", outputName);

  await ffmpeg.exec(args);

  const outputData = await ffmpeg.readFile(outputName);
  const outputBlob = new Blob([new Uint8Array(outputData as Uint8Array)], {
    type: audioBlob.type || "audio/mpeg",
  });

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  if (coverData) {
    try { await ffmpeg.deleteFile("cover.jpg"); } catch {}
    try { await ffmpeg.deleteFile("cover.png"); } catch {}
  }

  return outputBlob;
}
