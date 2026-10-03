/**
 * Design tokens taken from the Bloom design canvas.
 * Every screen uses the same ink outline, hard offset shadow and a small
 * set of flat accent fills.
 */

export const colors = {
  /** Page background (lavender). */
  ground: '#F7F2FF',
  /** Outlines, headings, dark buttons. */
  ink: '#1E1433',
  /** Secondary text and captions. */
  inkMuted: '#5B4F72',
  surface: '#FFFFFF',
  /** Table row dividers, switch track when off. */
  line: '#EFE8FF',
  purple: '#6B3FF0',
  purpleDark: '#4B22C9',
  lilac: '#C9B6FF',
  yellow: '#FFD447',
  mint: '#7BE0B5',
  pink: '#FFB3D1',
  orange: '#FF8A4C',
  /** Scrim behind bottom sheets (ink at 50%). */
  scrim: 'rgba(30, 20, 51, 0.5)',
} as const;

export type ColorName = keyof typeof colors;

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

/** Every outlined element in the design uses a 2px ink border. */
export const border = {
  width: 2,
  color: colors.ink,
} as const;

/** Hard offset shadows (no blur), as CSS box-shadow strings for RN's `boxShadow`. */
export const shadow = {
  sm: `2px 2px 0px ${colors.ink}`,
  md: `3px 3px 0px ${colors.ink}`,
  lg: `5px 5px 0px ${colors.ink}`,
  cta: `4px 4px 0px ${colors.purple}`,
} as const;

/** Minimum touch target from the design (44pt). */
export const touchTarget = 44;
