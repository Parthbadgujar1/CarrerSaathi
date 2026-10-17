import { create } from 'zustand';
import { safeStorage } from '../lib/storage';

// ---------------------------------------------------------------- theme
const applyTheme = (theme) => {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
};

export const useTheme = create((set) => ({
  theme: safeStorage.get('cs-theme', 'system') ?? 'system',
  setTheme(theme) {
    applyTheme(theme);
    // Remembering a choice the user explicitly made is strictly necessary storage.
    if (theme === 'system') safeStorage.remove('cs-theme');
    else safeStorage.set('cs-theme', theme);
    set({ theme });
  },
}));

export function resolvedTheme(theme) {
  if (theme !== 'system') return theme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ---------------------------------------------------------------- cookie consent
const CONSENT_KEY = 'cs-consent';
const CONSENT_VERSION = 1;

export const useConsent = create((set) => {
  const stored = safeStorage.get(CONSENT_KEY, null);
  const valid = stored && stored.version === CONSENT_VERSION ? stored : null;
  const save = (analytics) => {
    const value = { version: CONSENT_VERSION, necessary: true, analytics, date: new Date().toISOString() };
    safeStorage.set(CONSENT_KEY, value);
    set({ consent: value, bannerOpen: false, settingsOpen: false });
  };
  return {
    consent: valid,
    bannerOpen: !valid,
    settingsOpen: false,
    acceptAll: () => save(true),
    rejectAll: () => save(false),
    savePreferences: ({ analytics }) => save(Boolean(analytics)),
    openSettings: () => set({ settingsOpen: true }),
    closeSettings: () => set({ settingsOpen: false }),
  };
});

// ---------------------------------------------------------------- shell UI
export const useUI = create((set) => ({
  paletteOpen: false,
  aiOpen: false,
  sidebarOpen: false,
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setAI: (aiOpen) => set({ aiOpen }),
  setSidebar: (sidebarOpen) => set({ sidebarOpen }),
}));
