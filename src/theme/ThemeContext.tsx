import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildPalette, ColorPalette, DEFAULT_ACCENT } from './colors';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  isThemeLoaded: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  colors: ColorPalette;
  accent: string;
  setAccent: (accent: string) => Promise<void>;
  setAccentColor: (accent: string) => Promise<void>;
}

const STORAGE_KEY_THEME_MODE = '@salon_os_theme_mode';
const STORAGE_KEY_ACCENT = '@salon_os_accent_color';

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'dark',
  resolvedTheme: 'dark',
  isDark: true,
  isThemeLoaded: false,
  setThemeMode: async () => {},
  colors: buildPalette(DEFAULT_ACCENT, true),
  accent: DEFAULT_ACCENT,
  setAccent: async () => {},
  setAccentColor: async () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);
  const [isThemeLoaded, setIsThemeLoaded] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const [savedTheme, savedAccent] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_THEME_MODE),
          AsyncStorage.getItem(STORAGE_KEY_ACCENT),
        ]);

        if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system')) {
          setThemeModeState(savedTheme as ThemeMode);
        }
        if (savedAccent) {
          setAccentState(savedAccent);
        }
      } catch {
        // Fallback to defaults
      } finally {
        setIsThemeLoaded(true);
      }
    })();
  }, []);

  const setThemeMode = async (newMode: ThemeMode) => {
    setThemeModeState(newMode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_THEME_MODE, newMode);
    } catch {
      // Ignore storage error
    }
  };

  const setAccent = async (newAccent: string) => {
    setAccentState(newAccent);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ACCENT, newAccent);
    } catch {
      // Ignore storage error
    }
  };

  // Determine actual active theme: dark mode is default
  const resolvedTheme: ResolvedTheme =
    themeMode === 'system'
      ? systemColorScheme === 'light'
        ? 'light'
        : 'dark'
      : themeMode;

  const isDark = resolvedTheme === 'dark';
  const colors = buildPalette(accent, isDark);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        isDark,
        isThemeLoaded,
        setThemeMode,
        colors,
        accent,
        setAccent,
        setAccentColor: setAccent,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
