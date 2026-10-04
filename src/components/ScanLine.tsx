import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

import { makeStyles } from '@/theme/theme';

/** The design's yellow line sweeping up and down over a file while the AI reads it. */
export function ScanLine({ height }: { height: number }) {
  const styles = useStyles();
  const [y] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: height - 8, duration: 700, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [y, height]);
  return <Animated.View style={[styles.line, { transform: [{ translateY: y }] }]} />;
}

const useStyles = makeStyles(({ colors }) => ({
  line: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: colors.yellow },
}));
