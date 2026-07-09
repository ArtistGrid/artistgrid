import {
  Mic2,
  Download,
  Play,
  Search,
  AlertTriangle,
  Settings,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { useSettings } from "@/src/hooks/use-settings";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { clearCache } from "@/src/lib/tracker-cache";
import { Database } from "lucide-react";

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/80">{label}</p>
        {description && <p className="text-[11px] text-white/30 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-white/40" />
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="glass rounded-xl p-1 divide-y divide-white/[0.06]">
        {children}
      </div>
    </div>
  );
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings();

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-16 px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
        aria-label="Close settings"
        tabIndex={-1}
      />
      <div className="relative z-10 glass-elevated rounded-2xl w-full max-w-xl max-h-[80vh] overflow-hidden animate-in fade-in-0 slide-in-from-top-4 duration-200 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 text-white/50" />
            <h1 className="text-sm font-semibold text-white">Settings</h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="text-white/40 hover:text-white hover:bg-white/10 h-8 w-8 rounded-xl flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-6">
          <Tabs defaultValue="lyrics">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="lyrics"><Mic2 className="w-3 h-3 mr-1.5" />Lyrics</TabsTrigger>
              <TabsTrigger value="player"><Play className="w-3 h-3 mr-1.5" />Player</TabsTrigger>
              <TabsTrigger value="behavior"><Settings className="w-3 h-3 mr-1.5" />Behavior</TabsTrigger>
            </TabsList>

            <TabsContent value="lyrics" className="space-y-4">
              <Section icon={Mic2} title="Lyrics">
                <SettingRow
                  label="Synced Lyrics Only"
                  description="Hide plain text lyrics if synced are unavailable"
                >
                  <Switch
                    checked={settings.lyrics.syncedOnly}
                    onCheckedChange={(v) => update("lyrics", "syncedOnly", v)}
                  />
                </SettingRow>
                <SettingRow label="Mini Lyrics Alignment" description="Text alignment in the lyrics popup">
                  <Select
                    value={settings.lyrics.alignment}
                    onChange={(e) => update("lyrics", "alignment", e.target.value as "left" | "center" | "right")}
                    options={[
                      { value: "left", label: "Left" },
                      { value: "center", label: "Center" },
                      { value: "right", label: "Right" },
                    ]}
                  />
                </SettingRow>
                <SettingRow label="Global Font Size" description="Text size for lyrics">
                  <Select
                    value={settings.lyrics.fontSize}
                    onChange={(e) => update("lyrics", "fontSize", e.target.value as "small" | "medium" | "large")}
                    options={[
                      { value: "small", label: "Small" },
                      { value: "medium", label: "Medium" },
                      { value: "large", label: "Large" },
                    ]}
                  />
                </SettingRow>
              </Section>
            </TabsContent>

            <TabsContent value="player" className="space-y-4">
              <Section icon={Play} title="Player">
                <SettingRow label="Show Album Art in Mini Player">
                  <Switch
                    checked={settings.player.showAlbumArt}
                    onCheckedChange={(v) => update("player", "showAlbumArt", v)}
                  />
                </SettingRow>
                <SettingRow label="Show Next Song 10s Before End" description="Shows a popup in fullscreen mode">
                  <Switch
                    checked={settings.player.showNextSong}
                    onCheckedChange={(v) => update("player", "showNextSong", v)}
                  />
                </SettingRow>
                <SettingRow label="Startup Shuffle" description="Enable shuffle automatically when opening the site">
                  <Switch
                    checked={settings.player.startupShuffle}
                    onCheckedChange={(v) => update("player", "startupShuffle", v)}
                  />
                </SettingRow>
              </Section>

              <Section icon={Download} title="Downloads">
                <SettingRow label="Download as OG Filename" description="Use the original filename from notes when downloading">
                  <Switch
                    checked={settings.downloads.useOgFilename}
                    onCheckedChange={(v) => update("downloads", "useOgFilename", v)}
                  />
                </SettingRow>
                <SettingRow label="Embed Metadata on Download" description="Embed title, artist, album, year, and cover art into downloaded MP3s">
                  <Switch
                    checked={settings.downloads.embedMetadata}
                    onCheckedChange={(v) => update("downloads", "embedMetadata", v)}
                  />
                </SettingRow>
              </Section>
            </TabsContent>

            <TabsContent value="behavior" className="space-y-4">
              <Section icon={AlertTriangle} title="Errors & Notifications">
                <SettingRow label="Show Detailed Errors" description="Show full API error messages instead of a generic response">
                  <Switch
                    checked={settings.behavior.detailedErrors}
                    onCheckedChange={(v) => update("behavior", "detailedErrors", v)}
                  />
                </SettingRow>
                <SettingRow label="Notification When Playing" description="Show browser notification on song change when tab is hidden">
                  <Switch
                    checked={settings.behavior.notifications}
                    onCheckedChange={(v) => update("behavior", "notifications", v)}
                  />
                </SettingRow>
                <SettingRow label="Show Emojis" description="Keep emojis in track names for MediaSession, Last.fm scrobbling, and downloads">
                  <Switch
                    checked={settings.behavior.showEmojis}
                    onCheckedChange={(v) => update("behavior", "showEmojis", v)}
                  />
                </SettingRow>
              </Section>

              <Section icon={Search} title="Navigation & Search">
                <SettingRow label="Remember Search" description="Keep search query active when returning to home">
                  <Switch
                    checked={settings.behavior.rememberSearch}
                    onCheckedChange={(v) => update("behavior", "rememberSearch", v)}
                  />
                </SettingRow>
                <SettingRow label="Not Open In A New Tab" description="Open unplayable songs in a popup window instead of a new tab">
                  <Switch
                    checked={settings.behavior.openInNewTab}
                    onCheckedChange={(v) => update("behavior", "openInNewTab", v)}
                  />
                </SettingRow>
              </Section>

              <Section icon={FileSpreadsheet} title="Google Sheets">
                <SettingRow label="Open Sheets as HTML View" description="Open Google Sheets links in HTML view instead of the editor">
                  <Switch
                    checked={settings.behavior.sheetsHtmlview}
                    onCheckedChange={(v) => update("behavior", "sheetsHtmlview", v)}
                  />
                </SettingRow>
              </Section>

              <Section icon={Database} title="Cache">
                <SettingRow label="Clear Tracker Cache" description="Remove cached tracker data and free up local storage">
                  <Button variant="outline" size="sm" onClick={() => clearCache()}>
                    Clear
                  </Button>
                </SettingRow>
              </Section>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
