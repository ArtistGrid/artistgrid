import { DraggablePanel } from "@/src/components/draggable-panel";

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function YouTubePlayer({ url, onClose }: { url: string; onClose: () => void }) {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  return (
    <DraggablePanel label="YouTube" onClose={onClose}>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
        width="320"
        height="180"
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
        sandbox="allow-scripts allow-popups allow-presentation"
        className="block"
        title="YouTube video"
      />
    </DraggablePanel>
  );
}
