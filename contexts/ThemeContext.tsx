import React, { createContext, useState, useEffect, useContext, ReactNode, useMemo } from 'react';
import { useSettings } from '@/contexts/SettingsContext';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

// Initialize with a concrete default object so TypeScript never infers '{}' when used without provider.
const ThemeContext = createContext<ThemeContextType>({ theme: 'dark', toggleTheme: () => {} });

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings, updateSettings } = useSettings();
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      // 1) Stored preference
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
      if (saved === 'light' || saved === 'dark') return saved;
      // 2) Initial class set by inline script in index.html (avoids FOUC)
      if (typeof document !== 'undefined') {
        const hasDark = document.documentElement.classList.contains('dark');
        return hasDark ? 'dark' : 'light';
      }
      // 3) System preference
      const prefersDark = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
      return prefersDark ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    // Determine desired theme based on settings.theme
    const computeDesiredTheme = (): Theme => {
      if (settings?.theme === 'light') return 'light';
      if (settings?.theme === 'dark') return 'dark';
      // system
      const prefersDark = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
      return prefersDark ? 'dark' : 'light';
    };

    const applyTheme = (t: Theme) => {
      const root = document.documentElement;
      root.classList.toggle('dark', t === 'dark');
      root.classList.toggle('light', t === 'light');
      setTheme(t);
      try { localStorage.setItem('theme', t); } catch {}
      try { window.dispatchEvent(new Event('fantom-theme-change')); } catch {}
    };

    // Initial application and on settings changes
    applyTheme(computeDesiredTheme());

    // If in system mode, listen to system changes
    let mql: MediaQueryList | null = null;
    if (settings?.theme === 'system' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme(computeDesiredTheme());
      // Modern addEventListener with fallback
      try { mql.addEventListener('change', listener); } catch { /* Safari */ mql.addListener(listener); }
      return () => {
        try { mql && mql.removeEventListener('change', listener); } catch { mql && mql.removeListener(listener); }
      };
    }
  }, [settings?.theme]);

  const toggleTheme = () => {
    const next = (theme === 'light' ? 'dark' : 'light');
    // If user toggles while settings are 'system', promote to explicit choice
    try {
      if (settings?.theme === 'system') {
        updateSettings({ theme: next });
      } else {
        // Keep settings in sync with explicit selection
        updateSettings({ theme: next });
      }
    } catch { /* ignore */ }
    // Local state will update via effect reacting to settings.theme
  };

  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => useContext(ThemeContext);
