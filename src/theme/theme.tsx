import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, StyleSheet, useColorScheme } from 'react-native';

import { accents, borderWidth, palettes, shadowsFor, type Palette, type Scheme } from './tokens';

export type Theme = {
  scheme: Scheme;
  colors: Palette;
  border: { width: number; color: string };
  shadow: ReturnType<typeof shadowsFor>;
};

function buildTheme(scheme: Scheme): Theme {
  const colors = palettes[scheme];
  return { scheme, colors, border: { width: borderWidth, color: colors.outline }, shadow: shadowsFor(colors) };
}

const themes: Record<Scheme, Theme> = { light: buildTheme('light'), dark: buildTheme('dark') };

/** What the person picked in Profile. "system" follows the phone. */
export type AppearanceChoice = 'system' | 'light' | 'dark';

/** Saved on the phone only: it is not health data, so it stays out of the vault and Supabase. */
export const APPEARANCE_KEY = 'bloom.appearance';

type ThemeContextValue = {
  theme: Theme;
  appearance: AppearanceChoice;
  setAppearance: (next: AppearanceChoice) => void;
};

// Without a provider (tests, isolated renders) everything is light.
const ThemeContext = createContext<ThemeContextValue>({
  theme: themes.light,
  appearance: 'system',
  setAppearance: () => {},
});

function isAppearance(value: unknown): value is AppearanceChoice {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Picks the light or dark palette from the phone's setting, unless the
 * person chose one in Profile. The choice is also handed to React Native so
 * native parts (pickers, alerts, keyboard) match.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearanceChoice | null>(null);
  const system = useColorScheme();

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(APPEARANCE_KEY)
      .then((saved) => live && setAppearanceState(isAppearance(saved) ? saved : 'system'))
      .catch(() => live && setAppearanceState('system'));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    // react-native-web has no setColorScheme; there the palette alone follows the choice.
    if (appearance === null || typeof Appearance.setColorScheme !== 'function') return;
    Appearance.setColorScheme(appearance === 'system' ? 'unspecified' : appearance);
  }, [appearance]);

  const setAppearance = useCallback((next: AppearanceChoice) => {
    setAppearanceState(next);
    AsyncStorage.setItem(APPEARANCE_KEY, next).catch(() => {});
  }, []);

  const scheme: Scheme =
    appearance === 'light' || appearance === 'dark' ? appearance : system === 'dark' ? 'dark' : 'light';

  const value = useMemo(
    () => ({ theme: themes[scheme], appearance: appearance ?? 'system', setAppearance }),
    [scheme, appearance, setAppearance],
  );

  // Wait for the saved choice so the app doesn't open in the wrong theme and flip.
  if (appearance === null) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useAppearance() {
  const { appearance, setAppearance } = useContext(ThemeContext);
  return { appearance, setAppearance };
}

/**
 * Like `StyleSheet.create`, but built from the current theme. Each sheet is
 * created once per theme and reused.
 *
 *   const useStyles = makeStyles(({ colors, border }) => ({ card: { borderColor: border.color } }));
 *   function Thing() { const styles = useStyles(); ... }
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (theme: Theme) => T & StyleSheet.NamedStyles<any>,
): () => T {
  const sheets: Partial<Record<Scheme, T>> = {};
  return function useStyles() {
    const theme = useTheme();
    return (sheets[theme.scheme] ??= StyleSheet.create(factory(theme)));
  };
}

const ACCENT_FILLS: ReadonlySet<string> = new Set([
  accents.purple,
  accents.lilac,
  accents.yellow,
  accents.mint,
  accents.mintSoft,
  accents.pink,
  accents.orange,
]);

/** Accent fills look the same in both themes. */
export function isAccentFill(color: string | undefined): boolean {
  return !!color && ACCENT_FILLS.has(color);
}

/**
 * Renders its children with the light palette. Cards filled with an accent
 * use it, so text, icons, chips and inner outlines on a yellow or mint card
 * stay dark ink in dark mode, exactly as in the design.
 */
export function AccentZone({ when = true, children }: { when?: boolean; children: ReactNode }) {
  const outer = useContext(ThemeContext);
  const value = useMemo(() => ({ ...outer, theme: themes.light }), [outer]);
  if (!when) return <>{children}</>;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Default stroke for icons. */
export function useIconColor(color?: string, fallback: 'ink' | 'inkMuted' = 'ink'): string {
  const { colors } = useTheme();
  return color ?? colors[fallback];
}
