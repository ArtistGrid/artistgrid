import { DraggablePanel } from "@/src/components/draggable-panel";

export function FloatingVideoPlayer({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <DraggablePanel label="Video" onClose={onClose}>
      <video
        src={url}
        controls
        autoPlay
        muted
        playsInline
        className="block w-full"
        style={{ height: 180 }}
        onError={(e) => {
          e.stopPropagation();
        }}
      />
    </DraggablePanel>
  );
}
