import { createContext, use, useState, useCallback, useMemo, ReactNode } from "react";
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
