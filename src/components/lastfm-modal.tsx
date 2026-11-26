import { useRef, useState } from "react";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import { useToast } from "@/hooks/use-toast";
import type { LastFMClientInfo } from "@/types";
export interface LastFMModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastfm: LastFMClientInfo;
  token: string | null;
  setToken: (t: string | null) => void;
  /** Display name for Last.fm-compatible services (e.g. Sonosphere) */
  serviceName?: string;
}
export function LastFMModal({ isOpen, onClose, lastfm, token, setToken, serviceName = "Last.fm" }: LastFMModalProps) {
  const [activeFlow, setActiveFlow] = useState<number | null>(null);
  const { toast } = useToast();
  const flowRef = useRef(0);
  const isLoading = activeFlow !== null;
  const handleConnect = async () => {
    const flow = ++flowRef.current;
    setActiveFlow(flow);
    try {
      const { token: newToken, url } = await lastfm.getAuthUrl();
      setToken(newToken);
      const popup = window.open(url, "_blank", "noopener,noreferrer,width=800,height=600");
      if (!popup) {
        toast({ title: "Popup blocked", description: "Please allow popups for this site and try again" });
      }
    } catch {
    } finally {
      setActiveFlow((cur) => (cur === flow ? null : cur));
    }
  };
  const handleComplete = async () => {
    if (!token) return;
    const flow = ++flowRef.current;
    setActiveFlow(flow);
    try {
      await lastfm.completeAuth(token);
      setToken(null);
      onClose();
    } catch (e) {
      toast({
        title: "Connection failed",
        description: e instanceof Error ? e.message : `Could not complete ${serviceName} authentication`,
      });
    } finally {
      setActiveFlow((cur) => (cur === flow ? null : cur));
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel={`${serviceName} Connection`}>
      <div className="p-6 pt-12 text-center">
        <Radio className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
        <h2 className="text-xl font-bold text-white mb-2">{serviceName} Scrobbling</h2>
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
            <p className="text-neutral-400">Connect your {serviceName} account to scrobble tracks while listening</p>
            <Button onClick={handleConnect} disabled={isLoading} className="bg-white text-black hover:bg-neutral-200">
              {isLoading ? "Loading..." : `Connect ${serviceName}`}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
