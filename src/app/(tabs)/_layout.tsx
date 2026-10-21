import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Text } from '../../components/Text';
import { colors, FONT } from '../../components/theme';

const icon = (glyph: string) => () => <Text style={{ fontSize: 18 }}>{glyph}</Text>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accentDark,
        tabBarInactiveTintColor: colors.muted,
        // flexShrink: 0 stops the navigator squeezing the label (which clips at its own box) so descenders survive.
        tabBarLabelStyle: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 16, flexShrink: 0 },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
          // On the web the default bar is too short for serif labels with descenders. On phones the navigator's
          // own height already includes the safe area, so it is left alone there.
          ...(Platform.OS === 'web' ? { height: 68, paddingTop: 6, paddingBottom: 8 } : null),
        },
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontFamily: FONT.bold, color: colors.text },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('🍛') }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: icon('🎯') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('📈') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
