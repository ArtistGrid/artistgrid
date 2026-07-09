import { createContext, use } from "react";

interface SettingsModalContextType {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

export const SettingsModalContext = createContext<SettingsModalContextType>({
  settingsOpen: false,
  setSettingsOpen: () => {},
});

export function useSettingsModal() {
  return use(SettingsModalContext);
}
