import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';

/** Height of the tappable tab row. 64dp keeps every tab well above the 48dp accessibility minimum. */
const TAB_ROW_HEIGHT = 64;
/** Margin under the tabs when the phone reports no bottom inset */
const MIN_BOTTOM_PAD = 16;

export default function TabsLayout() {
  // Keep the tab labels clear of the phone's gesture strip / navigation buttons. Some phones
  // (seen on a Honor with gesture navigation) report a bottom inset of 0 even though the strip
  // overlaps the app, so there is always a minimum margin. Both values are set explicitly: the
  // navigator would otherwise apply its own (possibly 0) padding.
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, initialWindowMetrics?.insets.bottom ?? 0, MIN_BOTTOM_PAD);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: TAB_ROW_HEIGHT + bottomPad,
          paddingBottom: bottomPad,
        },
        tabBarActiveTintColor: Colors.primaryLight,
        // Light gray on the dark bar (contrast above 7:1); the old dark gray was hard to read
        tabBarInactiveTintColor: '#C4C4CF',
        tabBarLabelStyle: {
          fontSize: Typography.fontSize.sm,
          fontWeight: Typography.fontWeight.semibold,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" active={focused} />,
          tabBarAccessibilityLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="detection"
        options={{
          title: 'Detect',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👁️" active={focused} />,
          tabBarAccessibilityLabel: 'Obstacle detection',
        }}
      />
      <Tabs.Screen
        name="navigation"
        options={{
          title: 'Navigate',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🧭" active={focused} />,
          tabBarAccessibilityLabel: 'Walking navigation',
        }}
      />
      <Tabs.Screen
        name="text-reader"
        options={{
          title: 'Read',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📖" active={focused} />,
          tabBarAccessibilityLabel: 'Read text aloud',
        }}
      />
      {/* Reachable from Home (voice button) and Settings, but kept out of the tab bar */}
      <Tabs.Screen name="voice" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

function TabIcon({ emoji, active }: { emoji: string; active: boolean }) {
  return (
    <Text style={{ fontSize: 24, opacity: active ? 1 : 0.8 }} accessibilityElementsHidden importantForAccessibility="no">
      {emoji}
    </Text>
  );
}
