import { useState } from "react";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/src/components/modal";
import type { LastFMClientInfo } from "@/src/types";
export interface LastFMModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastfm: LastFMClientInfo;
  token: string | null;
  setToken: (t: string | null) => void;
}
export function LastFMModal({ isOpen, onClose, lastfm, token, setToken }: LastFMModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const { token: newToken, url } = await lastfm.getAuthUrl();
      setToken(newToken);
      window.open(url, "_blank", "noopener,noreferrer,width=800,height=600");
    } catch {
    } finally {
      setIsLoading(false);
    }
  };
  const handleComplete = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      await lastfm.completeAuth(token);
      setToken(null);
      onClose();
    } catch {
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Last.fm Connection">
      <div className="p-6 pt-12 text-center">
        <Radio className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
        <h2 className="text-xl font-bold text-white mb-2">Last.fm Scrobbling</h2>
        {lastfm.isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-neutral-300">
              Connected as <span className="font-semibold text-white">{lastfm.username}</span>
            </p>
            <Button
              variant="outline"
              onClick={() => {
                lastfm.disconnect();
                onClose();
              }}
              className="text-red-400 border-red-400/30 hover:bg-red-400/10"
            >
              Disconnect
            </Button>
          </div>
        ) : token ? (
          <div className="space-y-4">
            <p className="text-neutral-400">Authorize in the popup window, then click below to complete</p>
            <Button onClick={handleComplete} disabled={isLoading} className="bg-white text-black hover:bg-neutral-200">
              {isLoading ? "Connecting..." : "Complete Connection"}
            </Button>
            <Button variant="ghost" onClick={() => setToken(null)} className="text-neutral-500 hover:text-white">
              Cancel
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-neutral-400">Connect your Last.fm account to scrobble tracks while listening</p>
            <Button onClick={handleConnect} disabled={isLoading} className="bg-white text-black hover:bg-neutral-200">
              {isLoading ? "Loading..." : "Connect Last.fm"}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
