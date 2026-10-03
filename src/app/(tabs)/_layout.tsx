import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components';
import { useMembership, useRealtimeSync } from '@/lib/data';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const membership = useMembership();
  useRealtimeSync(membership.data?.pregnancy.id);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.ground } }}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="meals" options={{ title: 'Meals' }} />
      <Tabs.Screen name="vitamins" options={{ title: 'Vitamins' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
    </Tabs>
  );
}
