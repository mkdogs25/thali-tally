import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { MESSAGE } from '../lib/storageMode';
import { useAccount } from './AccountProvider';
import { Risk } from './AccountCard';
import { Text } from './Text';
import { colors } from './theme';
import { Button, Card, H2, Muted } from './ui';

/**
 * Shown at the top of Today. On first run it asks where the data should live; afterwards, whenever the data is
 * only on this device, it says plainly that it is not guaranteed to be kept.
 */
export function StorageNotice() {
  const a = useAccount();
  const router = useRouter();
  if (!a.modeLoaded || a.protection === 'synced') return null;

  if (a.needsChoice) {
    return (
      <Card style={{ borderColor: colors.accent }}>
        <H2>Where should your data live?</H2>
        <Muted style={{ marginBottom: 10 }}>You can change this any time, and signing in is optional.</Muted>
        <Risk text={MESSAGE['local-only'].long} />
        <Button title="Keep it on this device only" kind="secondary" onPress={() => void a.chooseMode('local')} />
        <Button
          title="Use a cloud account (recommended)"
          onPress={() => {
            void a.chooseMode('cloud');
            router.push('/settings');
          }}
        />
      </Card>
    );
  }

  return (
    <View style={{ backgroundColor: colors.soft, borderRadius: 12, padding: 12, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: colors.accent }}>
      <Text style={{ color: colors.text, fontSize: 14 }}>{MESSAGE[a.protection].short}</Text>
      {a.configured ? (
        <Pressable onPress={() => router.push('/settings')} accessibilityRole="link" hitSlop={8} style={{ marginTop: 4 }}>
          <Text style={{ color: colors.accentDark, fontWeight: '700', fontSize: 14 }}>{a.protection === 'cloud-pending' ? 'Sign in to back it up ›' : 'Back up with an account ›'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
