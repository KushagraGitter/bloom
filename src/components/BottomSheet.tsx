import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { makeStyles } from '@/theme/theme';
import { fonts, fontSize, radius, space } from '@/theme/tokens';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * The design's slide-up form sheet (log a reading, add an appointment, …).
 * Its contents scroll when they are taller than the screen, which a long form
 * with the keyboard open or a date picker showing can be.
 */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, space.xl) + space.lg, maxHeight: height - insets.top - space.xxl },
          ]}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors, border }) => ({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.ground,
    borderTopWidth: border.width,
    borderColor: border.color,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    paddingTop: 22,
    paddingHorizontal: space.xl,
    gap: space.lg,
    flexShrink: 1,
  },
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    gap: space.lg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.sheetTitle,
    color: colors.ink,
  },
}));
