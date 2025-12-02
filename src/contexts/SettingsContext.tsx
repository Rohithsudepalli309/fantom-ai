import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from './appSettings';

type SettingsContextType = {
  settings: AppSettings;
  updateSettings: (next: Partial<AppSettings>) => void;
  resetSettings: () => void;
};

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  resetSettings: () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AppSettings : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  const updateSettings = (next: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...next }));
  };

  const resetSettings = () => setSettings(DEFAULT_SETTINGS);

  const value = useMemo(() => ({ settings, updateSettings, resetSettings }), [settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

// Explicitly type the hook return to avoid inference to {} with our minimal React type stubs
export const useSettings = (): SettingsContextType => useContext<SettingsContextType>(SettingsContext as any);
