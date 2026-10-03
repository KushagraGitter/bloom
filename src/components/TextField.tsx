import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/Text';
import { border, colors, fonts, radius } from '@/theme/tokens';

export type TextFieldProps = TextInputProps & { label: string };

export function TextField({ label, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.inkMuted}
        {...rest}
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, flex: 1 },
  input: {
    height: 52,
    borderRadius: radius.field + 2,
    borderWidth: border.width,
    borderColor: border.color,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.ink,
  },
});
