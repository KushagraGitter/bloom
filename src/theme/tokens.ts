/**
 * Design tokens taken from the Bloom design canvas.
 * Every screen uses the same outline, hard offset shadow and a small
 * set of flat accent fills.
 *
 * Colours come in a light and a dark palette with the same names. Read them
 * through `useTheme()` or `makeStyles()` (see `./theme`), never at import
 * time, so screens follow the phone's light or dark setting.
 */

/**
 * Colours that are the same in both themes. The accent fills keep dark ink
 * text on top of them, so anything drawn on an accent uses `onAccent`.
 * Constants built at import time (per-slot tints, mood faces) may use these.
 */
export const accents = {
  purple: '#6B3FF0',
  lilac: '#C9B6FF',
  yellow: '#FFD447',
  mint: '#7BE0B5',
  /** Soft mint used for the "Good" mood face. */
  mintSoft: '#C9F0DC',
  pink: '#FFB3D1',
  orange: '#FF8A4C',
  /** Text, icons and outlines drawn on an accent fill. */
  onAccent: '#1E1433',
  /** Secondary text on an accent fill. */
  onAccentMuted: '#5B4F72',
  /** Text on purple fills and over photos. */
  onPurple: '#FFFFFF',
  /** Full-screen photo viewer ground (dark in both themes). */
  photo: '#1E1433',
  /** The household-key QR code stays dark on white so it always scans. */
  qrInk: '#1E1433',
  qrPaper: '#FFFFFF',
  /** White tiles and fields drawn inside an accent fill. */
  paper: '#FFFFFF',
} as const;

const light = {
  ...accents,
  /** Page background (lavender). */
  ground: '#F7F2FF',
  /** Headings, body text, dark buttons. */
  ink: '#1E1433',
  /** Secondary text and captions. */
  inkMuted: '#5B4F72',
  /** Cards, fields, light buttons. */
  surface: '#FFFFFF',
  /** Table row dividers, empty bars, switch track when off. */
  line: '#EFE8FF',
  /** 2px outlines and hard offset shadows. */
  outline: '#1E1433',
  /** Purple used for links and small purple text. */
  link: '#6B3FF0',
  /** Error and warning text. */
  purpleDark: '#4B22C9',
  /** Pale highlight behind a flagged value. */
  highlight: '#FFF4C7',
  /** Warmer highlight on the latest bump photo. */
  highlightWarm: '#FFE7A3',
  /** Translucent track drawn over the purple hero. */
  glass: 'rgba(255, 255, 255, 0.25)',
  /** Scrim behind bottom sheets. */
  scrim: 'rgba(30, 20, 51, 0.5)',
  /** Caption backing over a photo. */
  photoScrim: 'rgba(30, 20, 51, 0.7)',
};

export type Palette = { [K in keyof typeof light]: string };

const dark: Palette = {
  ...accents,
  ground: '#15101F',
  ink: '#F4EFFF',
  inkMuted: '#B9AED3',
  surface: '#231A35',
  line: '#3A2F52',
  /** "Chalk" outlines and shadows, picked by Kush on 2026-10-04. */
  outline: '#E6DCFF',
  link: '#B39DFF',
  purpleDark: '#C4B2FF',
  highlight: '#3D3418',
  highlightWarm: '#4A3C14',
  glass: 'rgba(255, 255, 255, 0.25)',
  scrim: 'rgba(0, 0, 0, 0.6)',
  photoScrim: 'rgba(30, 20, 51, 0.7)',
};

export const palettes = { light, dark } as const;

export type Scheme = keyof typeof palettes;
export type ColorName = keyof Palette;

export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
  bodyHeavy: 'Figtree_800ExtraBold',
} as const;

export const fontSize = {
  caption: 12,
  small: 13,
  body: 15,
  input: 16,
  title: 20,
  sheetTitle: 22,
  screenTitle: 32,
  stat: 26,
  hero: 44,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  field: 14,
  button: 14,
  tool: 20,
  card: 22,
  panel: 24,
  hero: 28,
  pill: 999,
} as const;

/** Every outlined element in the design uses a 2px border. */
export const borderWidth = 2;

/** Hard offset shadows (no blur), as CSS box-shadow strings for RN's `boxShadow`. */
export function shadowsFor(c: Palette) {
  return {
    sm: `2px 2px 0px ${c.outline}`,
    md: `3px 3px 0px ${c.outline}`,
    lg: `5px 5px 0px ${c.outline}`,
    cta: `4px 4px 0px ${c.purple}`,
  } as const;
}

/** Minimum touch target from the design (44pt). */
export const touchTarget = 44;
