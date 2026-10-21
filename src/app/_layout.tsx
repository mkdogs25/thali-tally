import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { StepsProvider } from '../components/StepsProvider';
import { colors, SERIF } from '../components/theme';
import { DB_NAME, migrate } from '../lib/db';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
      <StepsProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.accentDark,
            headerStyle: { backgroundColor: colors.bg },
            headerTitleStyle: { fontFamily: SERIF, color: colors.text, fontWeight: '700' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add" options={{ title: 'Add food', presentation: 'modal' }} />
          <Stack.Screen name="connections" options={{ title: 'Connected apps' }} />
        </Stack>
      </StepsProvider>
    </SQLiteProvider>
  );
}
