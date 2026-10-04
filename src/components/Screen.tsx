import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '@/theme/tokens';

/**
 * Lavender page with the design's 20px side gutter and 18px section gap.
 * `keyboardAware` is for a page with a field in the page itself rather than in
 * a sheet: it scrolls clear of the keyboard, and a tap on a button while the
 * keyboard is up presses it instead of only closing the keyboard.
 */
export function Screen({ children, keyboardAware }: { children: ReactNode; keyboardAware?: boolean }) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets={keyboardAware}
        keyboardShouldPersistTaps={keyboardAware ? 'handled' : undefined}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ground,
  },
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    gap: 18,
  },
});
