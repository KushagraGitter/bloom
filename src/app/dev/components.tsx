import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet, Button, Card, Chip, Screen, Text, Toggle } from '@/components';
import { border, colors, fonts, radius } from '@/theme/tokens';

const METHODS = ['Last period', 'Due date', 'IVF transfer'];

/** Development-only gallery of the shared components, to compare against the design canvas. */
export default function ComponentGallery() {
  const [method, setMethod] = useState(METHODS[0]);
  const [water, setWater] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState('');

  return (
    <Screen>
      <Text variant="screenTitle" accessibilityRole="header">
        Components
      </Text>

      <View style={styles.grid}>
        <Card style={styles.cell}>
          <Text variant="label" muted>
            Weight
          </Text>
          <Text variant="stat">64.2 kg</Text>
          <Text variant="caption">+0.3 this week</Text>
        </Card>
        <Card dashed style={styles.cell}>
          <Text variant="label" muted>
            Sleep
          </Text>
          <Text variant="stat">+ Log</Text>
          <Text variant="caption">Last night</Text>
        </Card>
      </View>

      <Card tone={colors.mint} elevation="md">
        <Text variant="title">Chips</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {METHODS.map((m) => (
            <Chip key={m} label={m} selected={m === method} onPress={() => setMethod(m)} />
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.toggleRow}>
          <Text variant="label">Water reminders</Text>
          <Toggle value={water} onValueChange={setWater} label="Water reminders" />
        </View>
      </Card>

      <Button label="Open bottom sheet" variant="cta" onPress={() => setSheet(true)} />

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Log weight">
        <View style={styles.field}>
          <Text variant="label">Weight in kg</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. 64.5"
            keyboardType="decimal-pad"
            style={styles.input}
            placeholderTextColor={colors.inkMuted}
          />
        </View>
        <View style={styles.actions}>
          <Button label="Cancel" onPress={() => setSheet(false)} style={styles.flex} />
          <Button label="Save" variant="dark" onPress={() => setSheet(false)} style={styles.flex} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1, gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  field: { gap: 6 },
  input: {
    height: 48,
    borderRadius: radius.field,
    borderWidth: border.width,
    borderColor: border.color,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  actions: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
