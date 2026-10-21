import { useState } from 'react';
import { Text } from './Text';
import { View } from 'react-native';
import { useAccount } from './AccountProvider';
import { colors } from './theme';
import { Button, Card, Field, H2, Muted } from './ui';

const ago = (ms: number | null) => {
  if (ms === null) return 'not yet';
  const m = Math.round((Date.now() - ms) / 60_000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

/** Optional sign-in. Without it everything stays on this phone; with it the data is mirrored to the account. */
export function AccountCard() {
  const a = useAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);

  if (!a.configured) {
    return (
      <Card>
        <H2>Account</H2>
        <Muted>
          Cloud sync is not set up in this build, so everything stays on this phone. To sync between your devices, follow the “Cloud sync” steps
          in the README (about ten minutes, free) and rebuild.
        </Muted>
      </Card>
    );
  }

  const submit = async (kind: 'in' | 'up') => {
    setBusy(true);
    setMessage(null);
    const r = await (kind === 'in' ? a.signIn(email, password) : a.signUp(email, password));
    setBusy(false);
    if (r.ok) {
      setPassword('');
      if (r.message) setMessage({ text: r.message, good: true });
    } else {
      setMessage({ text: r.message, good: false });
    }
  };

  if (a.status === 'loading') {
    return (
      <Card>
        <H2>Account</H2>
        <Muted>Checking your sign-in…</Muted>
      </Card>
    );
  }

  if (a.status === 'signed-in' && a.conflict) {
    return (
      <Card style={{ borderColor: colors.accent }}>
        <H2>This phone has someone else’s data</H2>
        <Muted style={{ marginBottom: 12 }}>
          You are signed in as {a.email}, but the food log, weights and plans already on this phone belong to a different account. They will not be
          mixed. Choose what to do:
        </Muted>
        <Button title={`Replace this phone’s data with ${a.email ?? 'this account'}’s`} onPress={() => void a.resolveConflict(true)} />
        <Button title="Sign out and keep this phone’s data" kind="secondary" onPress={() => void a.resolveConflict(false)} />
      </Card>
    );
  }

  if (a.status === 'signed-in') {
    return (
      <Card style={{ borderColor: colors.green }}>
        <H2>Account</H2>
        <Text style={{ color: colors.text, marginBottom: 4 }}>Signed in as {a.email}</Text>
        <Muted>Last synced {a.syncing ? 'just now…' : ago(a.lastSync)}</Muted>
        {a.error ? <Text style={{ color: colors.red, marginTop: 8 }}>{a.error}</Text> : null}
        <Muted style={{ marginTop: 8, marginBottom: 12 }}>
          Your food log, weights, recipes, profile and plans are stored on your account and kept in step across your devices. Steps, workouts and connected-app
          sign-ins stay on each device.
        </Muted>
        <Button title={a.syncing ? 'Syncing…' : 'Sync now'} kind="secondary" disabled={a.syncing} onPress={() => void a.syncNow()} />
        <Button title="Sign out" kind="secondary" onPress={() => void a.signOut()} />
      </Card>
    );
  }

  return (
    <Card>
      <H2>Account</H2>
      <Muted style={{ marginBottom: 12 }}>
        Optional. Sign in to keep your data safe and the same on your phone and the web. Without an account everything stays on this device. With one, your food
        log, weights, recipes and plans are stored on a server, protected so only you can read them.
      </Muted>
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" />
      {message ? <Text style={{ color: message.good ? colors.green : colors.red, marginBottom: 10 }}>{message.text}</Text> : null}
      <View>
        <Button title={busy ? 'Please wait…' : 'Sign in'} disabled={busy} onPress={() => void submit('in')} />
        <Button title="Create account" kind="secondary" disabled={busy} onPress={() => void submit('up')} />
      </View>
    </Card>
  );
}
