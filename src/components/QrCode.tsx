import { create } from 'qrcode/lib/core/qrcode';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

/** A QR code drawn with react-native-svg, dark on white with the standard 4-module quiet zone. */
export function QrCode({ value, size, accessibilityLabel }: { value: string; size: number; accessibilityLabel: string }) {
  const { path, count } = useMemo(() => {
    const { modules } = create(value, { errorCorrectionLevel: 'M' });
    let d = '';
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(row, col)) d += `M${col + 4} ${row + 4}h1v1h-1z`;
      }
    }
    return { path: d, count: modules.size + 8 };
  }, [value]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`} accessibilityLabel={accessibilityLabel} accessibilityRole="image">
      <Rect width={count} height={count} fill="#FFFFFF" />
      <Path d={path} fill={colors.ink} />
    </Svg>
  );
}
