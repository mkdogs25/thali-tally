import 'react-native-url-polyfill/auto';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { AccountProvider } from '../components/AccountProvider';
import { StepsProvider } from '../components/StepsProvider';
import { colors, FONT, FONT_FILES } from '../components/theme';
import { DB_NAME, migrate } from '../lib/db';

export default function RootLayout() {
  const [fontsReady, fontError] = useFonts(FONT_FILES);
  // The fonts are bundled, so this is a few milliseconds. On failure carry on with the platform's own font.
  if (!fontsReady && !fontError) return null;
  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
      <AccountProvider>
      <StepsProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.accentDark,
            headerStyle: { backgroundColor: colors.bg },
            headerTitleStyle: { fontFamily: FONT.bold, color: colors.text },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add" options={{ title: 'Add food', presentation: 'modal' }} />
          <Stack.Screen name="connections" options={{ title: 'Connected apps' }} />
        </Stack>
      </StepsProvider>
      </AccountProvider>
    </SQLiteProvider>
  );
}
