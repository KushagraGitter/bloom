import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { border, colors, fonts, fontSize, radius, space } from '@/theme/tokens';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** The design's slide-up form sheet (log a reading, add an appointment, …). */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.xl) + space.lg }]}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.sheetTitle,
    color: colors.ink,
  },
});
