import type { ReactNode } from "react";
import {
  Mic2,
  Download,
  Play,
  Search,
  AlertTriangle,
  Settings,
  FileSpreadsheet,
  Radio,
  Type,
  Database,
  Trash2,
} from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { Modal } from "@/components/modal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { clearCache } from "@/lib/tracker-cache";
import { clearCacheAndReload } from "@/lib/stale-reload";

const TABS = [
  { value: "lyrics", label: "Lyrics", icon: Mic2 },
  { value: "player", label: "Player", icon: Play },
  { value: "scrobbling", label: "Scrobbling", icon: Radio },
  { value: "behavior", label: "Behavior", icon: Settings },
];

function SettingRow({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
      <div className="min-w-[10rem] flex-1 basis-0">
        <p className="text-sm text-white/90">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-white/45">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <SettingRow label={label} description={description}>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </SettingRow>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  secret,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder: string;
  secret?: boolean;
}) {
  return (
    <input
      type={secret ? "password" : "text"}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      className="h-8 w-64 max-w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-white/85 transition-colors placeholder:text-white/25 hover:border-white/15 focus:border-white/30 focus:outline-none"
    />
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-white/40">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-white/[0.03]">
        {children}
      </div>
    </section>
  );
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings();
  const { lastfm, listenbrainz, sonosphere } = settings.scrobbling;
  const setLastfm = (patch: Partial<typeof lastfm>) => update("scrobbling", "lastfm", { ...lastfm, ...patch });
  const setListenbrainz = (patch: Partial<typeof listenbrainz>) =>
    update("scrobbling", "listenbrainz", { ...listenbrainz, ...patch });
  return (
    <Modal
      isOpen
      onClose={onClose}
      ariaLabel="Settings"
      className="flex h-[min(620px,85vh)] max-w-3xl flex-col overflow-hidden"
    >
      <div className="flex h-14 shrink-0 items-center border-b border-white/[0.07] px-5">
        <h1 className="text-[15px] font-semibold text-white">Settings</h1>
      </div>

      <Tabs defaultValue="lyrics" orientation="vertical" className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <TabsList className="h-auto shrink-0 justify-start gap-1 overflow-x-auto rounded-none border-b border-white/[0.07] bg-transparent p-2 no-scrollbar sm:w-48 sm:flex-col sm:items-stretch sm:border-b-0 sm:border-r sm:p-3">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="justify-start gap-2.5 px-3 py-2 text-[13px] text-white/50 hover:bg-white/[0.05] hover:text-white/80 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar p-5 sm:p-6">
          <TabsContent value="lyrics" className="mt-0 space-y-6">
            <Section icon={Mic2} title="Display">
              <Toggle
                label="Synced Lyrics Only"
                description="Hide plain text lyrics if synced are unavailable"
                checked={settings.lyrics.syncedOnly}
                onChange={(v) => update("lyrics", "syncedOnly", v)}
              />
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
              <SettingRow label="Font Size" description="Text size for lyrics">
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

          <TabsContent value="player" className="mt-0 space-y-6">
            <Section icon={Play} title="Playback">
              <Toggle
                label="Show Album Art in Mini Player"
                checked={settings.player.showAlbumArt}
                onChange={(v) => update("player", "showAlbumArt", v)}
              />
              <Toggle
                label="Show Next Song 10s Before End"
                description="Shows a popup in fullscreen mode"
                checked={settings.player.showNextSong}
                onChange={(v) => update("player", "showNextSong", v)}
              />
              <Toggle
                label="Startup Shuffle"
                description="Enable shuffle automatically when opening the site"
                checked={settings.player.startupShuffle}
                onChange={(v) => update("player", "startupShuffle", v)}
              />
            </Section>

            <Section icon={Download} title="Downloads">
              <Toggle
                label="Download as OG Filename"
                description="Use the original filename from notes when downloading"
                checked={settings.downloads.useOgFilename}
                onChange={(v) => update("downloads", "useOgFilename", v)}
              />
              <Toggle
                label="Embed Metadata on Download"
                description="Embed title, artist, album, year, and cover art into downloaded files"
                checked={settings.downloads.embedMetadata}
                onChange={(v) => update("downloads", "embedMetadata", v)}
              />
              <SettingRow
                label="Download Format"
                description="Transcode to a specific format on download (requires metadata embedding)"
              >
                <Select
                  value={settings.downloads.format || "original"}
                  onChange={(e) =>
                    update(
                      "downloads",
                      "format",
                      e.target.value as "original" | "mp3" | "opus" | "ogg" | "flac" | "wav"
                    )
                  }
                  options={[
                    { value: "original", label: "Original" },
                    { value: "mp3", label: "MP3" },
                    { value: "opus", label: "Opus" },
                    { value: "ogg", label: "OGG Vorbis" },
                    { value: "flac", label: "FLAC (lossless)" },
                    { value: "wav", label: "WAV (lossless)" },
                  ]}
                />
              </SettingRow>
            </Section>
          </TabsContent>

          <TabsContent value="scrobbling" className="mt-0 space-y-6">
            <Section icon={Radio} title="Sonosphere Scrobbling">
              <Toggle
                label="Enable Sonosphere"
                description="Scrobble played tracks to your sonosphere.fm account. Connect via the Sonosphere button in the header."
                checked={sonosphere.enabled}
                onChange={(v) => update("scrobbling", "sonosphere", { ...sonosphere, enabled: v })}
              />
            </Section>

            <Section icon={Radio} title="Last.fm Scrobbling">
              <Toggle
                label="Enable Last.fm"
                description="Scrobble played tracks to your Last.fm account"
                checked={lastfm.enabled}
                onChange={(v) => setLastfm({ enabled: v })}
              />
              <Toggle
                label="Custom API Server"
                description="Use a custom Last.fm-compatible API endpoint"
                checked={lastfm.customServer}
                onChange={(v) => setLastfm({ customServer: v })}
              />
              {lastfm.customServer && (
                <>
                  <SettingRow label="API URL" description="Base URL for the Last.fm-compatible API">
                    <TextInput
                      label="API URL"
                      value={lastfm.apiUrl}
                      onChange={(v) => setLastfm({ apiUrl: v })}
                      placeholder="https://ws.audioscrobbler.com/2.0/"
                    />
                  </SettingRow>
                  <SettingRow label="API Key">
                    <TextInput
                      label="API Key"
                      secret
                      value={lastfm.apiKey}
                      onChange={(v) => setLastfm({ apiKey: v })}
                      placeholder="Your Last.fm API key"
                    />
                  </SettingRow>
                  <SettingRow label="API Secret">
                    <TextInput
                      label="API Secret"
                      secret
                      value={lastfm.apiSecret}
                      onChange={(v) => setLastfm({ apiSecret: v })}
                      placeholder="Your Last.fm API secret"
                    />
                  </SettingRow>
                </>
              )}
            </Section>

            <Section icon={Radio} title="ListenBrainz">
              <Toggle
                label="Enable ListenBrainz"
                description="Scrobble played tracks to your ListenBrainz account"
                checked={listenbrainz.enabled}
                onChange={(v) => setListenbrainz({ enabled: v })}
              />
              <SettingRow label="Auth Token" description="Your ListenBrainz user token">
                <TextInput
                  label="Auth Token"
                  secret
                  value={listenbrainz.token}
                  onChange={(v) => setListenbrainz({ token: v })}
                  placeholder="Your ListenBrainz token"
                />
              </SettingRow>
              <SettingRow label="Custom API URL" description="Override the ListenBrainz API endpoint">
                <TextInput
                  label="Custom API URL"
                  value={listenbrainz.apiUrl}
                  onChange={(v) => setListenbrainz({ apiUrl: v })}
                  placeholder="https://api.listenbrainz.org"
                />
              </SettingRow>
            </Section>
          </TabsContent>

          <TabsContent value="behavior" className="mt-0 space-y-6">
            <Section icon={AlertTriangle} title="Errors & Notifications">
              <Toggle
                label="Show Detailed Errors"
                description="Show full API error messages instead of a generic response"
                checked={settings.behavior.detailedErrors}
                onChange={(v) => update("behavior", "detailedErrors", v)}
              />
              <Toggle
                label="Notification When Playing"
                description="Show browser notification on song change when tab is hidden"
                checked={settings.behavior.notifications}
                onChange={(v) => update("behavior", "notifications", v)}
              />
              <Toggle
                label="Show Emojis"
                description="Keep emojis in track names for MediaSession, Last.fm scrobbling, and downloads"
                checked={settings.behavior.showEmojis}
                onChange={(v) => update("behavior", "showEmojis", v)}
              />
            </Section>

            <Section icon={Search} title="Navigation & Search">
              <Toggle
                label="Remember Search"
                description="Keep search query active when returning to home"
                checked={settings.behavior.rememberSearch}
                onChange={(v) => update("behavior", "rememberSearch", v)}
              />
              <Toggle
                label="Not Open In A New Tab"
                description="Open unplayable songs in a popup window instead of a new tab"
                checked={settings.behavior.openInNewTab}
                onChange={(v) => update("behavior", "openInNewTab", v)}
              />
            </Section>

            <Section icon={FileSpreadsheet} title="Google Sheets">
              <Toggle
                label="Open Sheets as HTML View"
                description="Open Google Sheets links in HTML view instead of the editor"
                checked={settings.behavior.sheetsHtmlview}
                onChange={(v) => update("behavior", "sheetsHtmlview", v)}
              />
            </Section>

            <Section icon={Type} title="Font">
              <SettingRow
                label="Custom Font"
                description="Enter a font name to load from Coollabs Fonts (e.g. Inter, Roboto, Fira Code). IBM Plex Sans and IBM Plex Mono are served locally."
              >
                <TextInput
                  label="Custom Font"
                  value={settings.font}
                  onChange={(v) => update("font", "font", v)}
                  placeholder="IBM Plex Sans"
                />
              </SettingRow>
            </Section>

            <Section icon={Database} title="Cache">
              <SettingRow
                label="Clear Tracker Cache"
                description="Remove cached tracker data and free up local storage"
              >
                <Button variant="outline" size="sm" onClick={() => clearCache()}>
                  Clear
                </Button>
              </SettingRow>
              <SettingRow
                label="Bust All Caches"
                description="Clear service worker, browser cache, and IndexedDB. Forces a full reload."
              >
                <Button variant="outline" size="sm" onClick={() => clearCacheAndReload()} className="gap-1.5">
                  <Trash2 className="h-3 w-3" /> Bust
                </Button>
              </SettingRow>
            </Section>
          </TabsContent>
        </div>
      </Tabs>
    </Modal>
  );
}
