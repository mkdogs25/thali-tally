import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { confirmAction } from '../lib/dialogs';
import { MESSAGE, StorageMode } from '../lib/storageMode';
import { useAccount } from './AccountProvider';
import { Text } from './Text';
import { colors } from './theme';
import { Button, Card, Field, H2, Muted } from './ui';

const ago = (ms: number | null) => {
  if (ms === null) return 'not yet';
  const m = Math.round((Date.now() - ms) / 60_000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

function Option({ title, blurb, selected, disabled, onPress }: { title: string; blurb: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      style={{
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.accent : colors.line,
        backgroundColor: selected ? colors.soft : colors.card,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: selected ? colors.accent : colors.muted,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /> : null}
        </View>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, flex: 1 }}>{title}</Text>
      </View>
      <Muted style={{ marginTop: 4, marginLeft: 30 }}>{blurb}</Muted>
    </Pressable>
  );
}

/** The panel that says, in plain words, how safe the person's data is right now. */
export function Risk({ text }: { text: string }) {
  return (
    <View style={{ backgroundColor: colors.soft, borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: colors.accent, marginBottom: 12 }}>
      <Text style={{ color: colors.accentDark, fontWeight: '700', marginBottom: 2 }}>Not guaranteed to be kept</Text>
      <Text style={{ color: colors.text, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

/**
 * Choose where data lives: this device only, or a cloud account. Signing in is optional, and the card never lets
 * "this device only" look safe.
 */
export function AccountCard() {
  const a = useAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);

  const shownMode: StorageMode | null = a.configured ? a.mode : 'local';

  const choose = (next: StorageMode) => {
    if (next === shownMode) return;
    if (next === 'local' && a.status === 'signed-in') {
      confirmAction({
        title: 'Use this device only?',
        message: `You will be signed out and nothing more will be uploaded. Your data on this device is not guaranteed to be kept. Your account keeps the copy it already has.`,
        confirmLabel: 'Use this device only',
        destructive: true,
        onConfirm: () => a.chooseMode('local'),
      });
      return;
    }
    void a.chooseMode(next);
  };

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

  return (
    <Card>
      <H2>Where your data is stored</H2>
      <Muted style={{ marginBottom: 12 }}>Pick one. You can switch any time, and signing in is optional.</Muted>

      <Option title="This device only" blurb="Private and works offline, but not guaranteed to be kept." selected={shownMode === 'local'} onPress={() => choose('local')} />
      <Option
        title="Cloud account"
        blurb={a.configured ? 'Backed up, and the same on your phone and the web. Needs an email and password.' : 'Not set up in this build.'}
        selected={shownMode === 'cloud'}
        disabled={!a.configured}
        onPress={() => choose('cloud')}
      />

      {a.protection !== 'synced' ? <Risk text={MESSAGE[a.protection].long} /> : null}

      {!a.configured ? (
        <Muted>To turn on cloud accounts, follow the “Cloud sync” steps in the README (about ten minutes, free) and rebuild.</Muted>
      ) : a.mode === null ? (
        <Muted>You have not chosen yet. Until you do, your data is on this device only.</Muted>
      ) : a.mode === 'cloud' && a.status === 'loading' ? (
        <Muted>Checking your sign-in…</Muted>
      ) : a.mode === 'cloud' && a.status === 'signed-in' && a.conflict ? (
        <View>
          <H2>This phone has someone else’s data</H2>
          <Muted style={{ marginBottom: 12 }}>
            You are signed in as {a.email}, but the food log, weights and plans already on this phone belong to a different account. They will not be
            mixed. Choose what to do:
          </Muted>
          <Button title={`Replace this phone’s data with ${a.email ?? 'this account'}’s`} onPress={() => void a.resolveConflict(true)} />
          <Button title="Sign out and keep this phone’s data" kind="secondary" onPress={() => void a.resolveConflict(false)} />
        </View>
      ) : a.mode === 'cloud' && a.status === 'signed-in' ? (
        <View>
          <Text style={{ color: colors.text, marginBottom: 2 }}>Signed in as {a.email}</Text>
          <Muted>Last synced {a.syncing ? 'just now…' : ago(a.lastSync)}</Muted>
          {a.error ? <Text style={{ color: colors.red, marginTop: 8 }}>{a.error}</Text> : null}
          <Muted style={{ marginTop: 8, marginBottom: 12 }}>
            {MESSAGE.synced.long} Your food log, weights, recipes, profile and plans are kept in step across your devices. Steps, workouts and connected-app
            sign-ins stay on each device.
          </Muted>
          <Button title={a.syncing ? 'Syncing…' : 'Sync now'} kind="secondary" disabled={a.syncing} onPress={() => void a.syncNow()} />
          <Button title="Sign out" kind="secondary" onPress={() => void a.signOut()} />
        </View>
      ) : a.mode === 'cloud' ? (
        <View>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" />
          {message ? <Text style={{ color: message.good ? colors.green : colors.red, marginBottom: 10 }}>{message.text}</Text> : null}
          <Button title={busy ? 'Please wait…' : 'Sign in'} disabled={busy} onPress={() => void submit('in')} />
          <Button title="Create account" kind="secondary" disabled={busy} onPress={() => void submit('up')} />
          <Muted>With an account, your food log, weights, recipes and plans are stored on a server, protected so only you can read them.</Muted>
        </View>
      ) : null}
    </Card>
  );
}
