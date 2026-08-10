import { Volume2, VolumeX } from "lucide-react";

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
  className?: string;
  buttonClassName?: string;
  rangeClassName?: string;
}

export function VolumeControl({
  volume,
  isMuted,
  onToggleMute,
  onVolumeChange,
  className = "",
  buttonClassName = "",
  rangeClassName = "",
}: VolumeControlProps) {
  return (
    <div className={className}>
      <button type="button" onClick={onToggleMute} className={buttonClassName} aria-label="Toggle mute">
        {volume === 0 || isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={isMuted ? 0 : volume}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        className={rangeClassName}
        aria-label="Volume"
      />
    </div>
  );
}
