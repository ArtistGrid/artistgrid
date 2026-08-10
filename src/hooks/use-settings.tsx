import { createContext, use, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from "react";
import { type Settings, loadSettings, saveSettings } from "@/src/lib/settings";
import { buildFontCssUrl } from "@/src/lib/fonts";

interface SettingsContextType {
  settings: Settings;
  update: (section: keyof Settings, key: string, value: unknown) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function useSettings() {
  const context = use(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const fontLinkRef = useRef<HTMLLinkElement | null>(null);

  useEffect(() => {
    if (fontLinkRef.current) {
      fontLinkRef.current.remove();
      fontLinkRef.current = null;
    }

    const font = settings.font?.trim() || "IBM Plex Sans";

    const selfHosted = ["ibm plex sans", "ibm plex mono"].includes(font.toLowerCase());

    if (!selfHosted) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = buildFontCssUrl(font);
      document.head.appendChild(link);
      fontLinkRef.current = link;
    }

    document.documentElement.style.setProperty(
      "--font-family",
      `"${font}", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    );

    return () => {
      if (fontLinkRef.current) {
        fontLinkRef.current.remove();
        fontLinkRef.current = null;
      }
    };
  }, [settings.font]);

  const update = useCallback(
    (section: keyof Settings, key: string, value: unknown) => {
      const current = settings[section];
      const nextSection =
        typeof current === "object" && current !== null
          ? { ...(current as Record<string, unknown>), [key]: value }
          : value;
      const next = { ...settings, [section]: nextSection } as Settings;
      saveSettings(next);
      setSettings(next);
    },
    [settings]
  );

  return (
    <SettingsContext.Provider value={useMemo(() => ({ settings, update }), [settings, update])}>
      {children}
    </SettingsContext.Provider>
  );
}
