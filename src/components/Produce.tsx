import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import { growthFor, produceBox } from '@/lib/growth';
import { produceFill, produceParts } from '@/theme/produce';
import { accents } from '@/theme/tokens';

export type ProduceProps = {
  week: number;
  /** The drawing's length along its longest side, in points. */
  length: number;
  /** Outline colour; defaults to the ink used on accent fills. */
  outline?: string;
  /** Draws the shape in this one colour instead of its own, for weeks still to come. */
  silhouette?: string;
};

/**
 * A week's fruit or vegetable, drawn flat with a chalk outline like the rest of
 * the app. Decorative: whatever shows it says the name in words.
 */
export function Produce({ week, length, outline = accents.onAccent, silhouette }: ProduceProps) {
  const growth = growthFor(week);
  if (!growth) return null;
  const fill = silhouette ?? produceFill[growth.week];
  const { width: w, height: h } = produceBox(growth.shape, length);
  const sw = Math.max(1, Math.min(2, length / 10));
  const showLeaf = length >= 16 && !silhouette;
  const leaf = (x: number, y: number, s: number) =>
    showLeaf ? (
      <Ellipse cx={x} cy={y} rx={s * 0.55} ry={s * 0.28} fill={produceParts.leaf} stroke={outline} strokeWidth={sw} transform={`rotate(-30 ${x} ${y})`} />
    ) : null;

  let body: React.ReactNode;
  switch (growth.shape) {
    case 'seed':
      body = <Circle cx={w / 2} cy={h / 2} r={w / 2} fill={fill} />;
      break;
    case 'round':
      body = (
        <>
          {leaf(length * 0.62, sw + length * 0.06, length * 0.32)}
          <Circle cx={w / 2} cy={length / 2 + length * 0.06} r={(length / 2 - sw / 2) * 0.94} fill={fill} stroke={outline} strokeWidth={sw} />
        </>
      );
      break;
    case 'oval':
      body = (
        <>
          <Ellipse cx={w / 2} cy={h / 2} rx={w / 2 - sw / 2} ry={h / 2 - sw / 2} fill={fill} stroke={outline} strokeWidth={sw} />
          {length > 30 && !silhouette && <Ellipse cx={w * 0.35} cy={h * 0.35} rx={w * 0.12} ry={h * 0.08} fill={produceParts.shine} />}
        </>
      );
      break;
    case 'pear': {
      // Two overlapping circles: outlines drawn first and filled over, so the seam doesn't show.
      const R = w / 2 - sw;
      const r = R * 0.62;
      const top = r + sw * 2;
      const bottom = h - R - sw;
      body = (
        <>
          <G fill={outline}>
            <Circle cx={w / 2} cy={top} r={r + sw} />
            <Circle cx={w / 2} cy={bottom} r={R + sw} />
          </G>
          <G fill={fill}>
            <Circle cx={w / 2} cy={top} r={r} />
            <Circle cx={w / 2} cy={bottom} r={R} />
          </G>
          {leaf(w * 0.66, sw * 2, length * 0.22)}
        </>
      );
      break;
    }
    case 'leafy': {
      const c = length / 2;
      const r = length * 0.24;
      const bumps: [number, number][] = [
        [c, c - r * 0.9],
        [c - r * 1.05, c - r * 0.1],
        [c + r * 1.05, c - r * 0.1],
        [c - r * 0.6, c + r * 0.95],
        [c + r * 0.6, c + r * 0.95],
        [c, c + r * 0.15],
      ];
      body = (
        <>
          <G fill={outline}>
            {bumps.map(([x, y], i) => (
              <Circle key={i} cx={x} cy={y} r={r + sw} />
            ))}
          </G>
          <G fill={fill}>
            {bumps.map(([x, y], i) => (
              <Circle key={i} cx={x} cy={y} r={r} />
            ))}
          </G>
        </>
      );
      break;
    }
    case 'melon':
      body = (
        <>
          <Ellipse cx={w / 2} cy={h / 2} rx={w / 2 - sw / 2} ry={h / 2 - sw / 2} fill={fill} stroke={outline} strokeWidth={sw} />
          {[-0.25, 0, 0.25].map((k) => (
            <Path
              key={k}
              d={`M${w / 2 + k * w} ${sw * 2} Q ${w / 2 + k * w * 1.5} ${h / 2} ${w / 2 + k * w} ${h - sw * 2}`}
              fill="none"
              stroke={outline}
              strokeOpacity={0.35}
              strokeWidth={sw * 1.5}
            />
          ))}
        </>
      );
      break;
    case 'long':
    case 'corn':
      body = (
        <>
          <Rect x={sw / 2} y={sw / 2} width={w - sw} height={h - sw} rx={(h - sw) / 2} fill={fill} stroke={outline} strokeWidth={sw} />
          {growth.shape === 'corn' &&
            Array.from({ length: Math.floor((w * 0.55) / 7) }, (_, i) => (
              <Line key={i} x1={h * 0.5 + i * 7} y1={h * 0.25} x2={h * 0.5 + i * 7} y2={h * 0.75} stroke={outline} strokeOpacity={0.3} strokeWidth={sw} />
            ))}
          {growth.shape === 'corn' && (
            <Path
              d={`M${w * 0.62} ${h / 2} Q ${w * 0.85} ${h * 0.05} ${w - sw} ${h * 0.25} L ${w - sw} ${h * 0.75} Q ${w * 0.85} ${h * 0.95} ${w * 0.62} ${h / 2}Z`}
              fill={silhouette ?? produceParts.husk}
              stroke={outline}
              strokeWidth={sw}
            />
          )}
        </>
      );
      break;
  }

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {body}
    </Svg>
  );
}
