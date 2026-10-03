import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Text } from '@/components/Text';
import { border, colors, fonts, radius } from '@/theme/tokens';

type IconProps = { color: string };

/** Stroke icons copied from the design's bottom nav. */
const icons: Record<string, (p: IconProps) => React.ReactElement> = {
  index: ({ color }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  ),
  meals: ({ color }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 11h18a9 9 0 0 1-18 0z" />
      <Path d="M9 7c0-2 2-2 2-4M14 7c0-2 2-2 2-4" />
    </Svg>
  ),
  vitamins: ({ color }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Rect x={2.5} y={8.5} width={19} height={7} rx={3.5} transform="rotate(-45 12 12)" />
      <Path d="M9.5 9.5l5 5" />
    </Svg>
  ),
  reports: ({ color }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <Path d="M14 3v5h5M9 13h6M9 17h4" />
    </Svg>
  ),
  progress: ({ color }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Path d="M5 20V11M11 20V5M17 20v-6M2 20h20" />
    </Svg>
  ),
};

export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) + 6 }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;
        const focused = state.index === index;
        const color = focused ? colors.surface : colors.inkMuted;
        const Icon = icons[route.name];

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={[styles.tab, focused && styles.tabOn]}>
            {Icon ? <Icon color={color} /> : null}
            <Text style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderTopWidth: border.width,
    borderTopColor: border.color,
  },
  tab: {
    minWidth: 58,
    height: 56,
    borderRadius: radius.tool - 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabOn: {
    backgroundColor: colors.ink,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
});
