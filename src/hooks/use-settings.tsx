import { createContext, use, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from "react";
import { type Settings, loadSettings, saveSettings } from "@/src/lib/settings";

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

    const encodedFont = encodeURIComponent(font);
    const url = `https://api.fonts.coollabs.io/css2?family=${encodedFont}:wght@400;500;600;700&display=swap`;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
    fontLinkRef.current = link;

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
      setSettings((prev) => {
        const next = {
          ...prev,
          [section]: {
            ...(prev[section] as Record<string, unknown>),
            [key]: value,
          },
        };
        saveSettings(next as Settings);
        return next as Settings;
      });
    },
    []
  );

  return (
    <SettingsContext.Provider value={useMemo(() => ({ settings, update }), [settings, update])}>
      {children}
    </SettingsContext.Provider>
  );
}
