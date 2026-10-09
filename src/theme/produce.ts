/**
 * The fruit and vegetable colours for the fruit parade, postcards and the
 * life-size sheet. They are drawings of real food, so they stay the same in
 * light and dark; only the outline follows the theme.
 */
export const produceFill: Record<number, string> = {
  4: '#3A2F52',
  5: '#F3D9A4',
  6: '#E0A35B',
  7: '#5B6FD6',
  8: '#E8436B',
  9: '#D6283F',
  10: '#F0435A',
  11: '#8BD14E',
  12: '#8A3FA0',
  13: '#FFE14D',
  14: '#FFB27A',
  15: '#FF5A5A',
  16: '#6FA043',
  17: '#C9D952',
  18: '#FF4B3A',
  19: '#FFB03B',
  20: '#FFD447',
  21: '#FF8A4C',
  22: '#FF9F45',
  23: '#FF8C7A',
  24: '#FFD447',
  25: '#F5EFE0',
  26: '#9EE06B',
  27: '#4FAE5A',
  28: '#7A4FB0',
  29: '#F2B05E',
  30: '#B6E38A',
  31: '#8A5A3C',
  32: '#C9A27A',
  33: '#F5C542',
  34: '#F6B26B',
  35: '#C9EC9A',
  36: '#7BCF6A',
  37: '#5FBF5A',
  38: '#9FD47A',
  39: '#FF8A4C',
  40: '#4FAE5A',
  41: '#4FAE5A',
};

export const produceParts = {
  leaf: '#4FAE5A',
  husk: '#7BCF6A',
  /** A soft highlight on larger fruit. */
  shine: 'rgba(255, 255, 255, 0.45)',
  /** The paper the postcards are printed on, the same in both themes. */
  postcard: '#FFF6E0',
  /** Postmark ink. */
  postmark: 'rgba(107, 63, 240, 0.85)',
  /** Dashed line between the note and the address. */
  postcardRule: 'rgba(30, 20, 51, 0.35)',
} as const;
