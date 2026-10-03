import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';

/** Placeholder for tabs that later phases of the build plan fill in. */
export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <Screen>
      <Text variant="screenTitle" accessibilityRole="header">
        {title}
      </Text>
      <Card dashed>
        <Text variant="label">Coming in phase {phase}.</Text>
      </Card>
    </Screen>
  );
}
