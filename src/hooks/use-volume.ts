import { useCallback, useState } from "react";

export function useVolume(volume: number, setVolume: (v: number) => void) {
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);

  const handleVolumeToggle = useCallback(() => {
    if (isMuted || volume === 0) {
      const restore = prevVolume || 0.7;
      setVolume(restore);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, prevVolume, volume, setVolume]);

  const handleVolumeChange = useCallback(
    (v: number) => {
      setVolume(v);
      if (v > 0) setIsMuted(false);
    },
    [setVolume]
  );

  return { isMuted, setIsMuted, handleVolumeToggle, handleVolumeChange };
}
