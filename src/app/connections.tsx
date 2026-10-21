import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { Text } from '../components/Text';
import { useSteps } from '../components/StepsProvider';
import { colors } from '../components/theme';
import { Button, Card, Field, H2, Muted, Row } from '../components/ui';
import { getIntegrations, IntegrationState, saveIntegrations } from '../lib/db';
import { INFO, sourcesForPlatform } from '../lib/health/registry';
import { CALLBACK_DOMAIN, getCredentials, REDIRECT_URI, saveCredentials } from '../lib/health/strava';
import type { HealthSource, SourceId } from '../lib/health/types';
import { useFocusLoad } from '../lib/useFocusLoad';

const ago = (ms: number | null) => {
  if (ms === null) return 'never';
  const m = Math.round((Date.now() - ms) / 60_000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export default function ConnectionsScreen() {
  const db = useSQLiteContext();
  const { syncNow, syncing, errors } = useSteps();
  const sources = sourcesForPlatform();
  const [busy, setBusy] = useState<SourceId | null>(null);
  const [problems, setProblems] = useState<Partial<Record<SourceId, string>>>({});
  const [unavailable, setUnavailable] = useState<Partial<Record<SourceId, string>>>({});
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const load = useCallback(() => getIntegrations(db), [db]);
  const [state, reload] = useFocusLoad(load, {});

  useEffect(() => {
    void (async () => {
      const found: Partial<Record<SourceId, string>> = {};
      for (const s of sources) {
        const a = await s.available();
        if (!a.ok) found[s.id] = a.reason;
      }
      setUnavailable(found);
      const creds = await getCredentials();
      if (creds) {
        setClientId(creds.clientId);
        setClientSecret(creds.clientSecret);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setEnabled = async (id: SourceId, next: Partial<IntegrationState>) => {
    const all = await getIntegrations(db);
    all[id] = { enabled: false, lastSync: null, lastError: null, ...all[id], ...next };
    await saveIntegrations(db, all);
    await reload();
  };

  const connect = async (s: HealthSource) => {
    setBusy(s.id);
    setProblems((p) => ({ ...p, [s.id]: undefined }));
    try {
      if (s.id === 'strava') {
        if (!clientId.trim() || !clientSecret.trim()) {
          setProblems((p) => ({ ...p, strava: 'Enter your Strava Client ID and Client Secret first.' }));
          return;
        }
        await saveCredentials({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
      }
      const error = await s.connect();
      if (error) {
        setProblems((p) => ({ ...p, [s.id]: error }));
        return;
      }
      await setEnabled(s.id, { enabled: true, lastError: null });
      await syncNow();
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const disconnect = (s: HealthSource) =>
    Alert.alert(`Disconnect ${s.label}?`, 'Its workouts will stop being counted. Data already imported stays until you erase it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await s.disconnect();
          await setEnabled(s.id, { enabled: false });
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Muted style={{ marginBottom: 12 }}>
        Connect a health app and your steps, calories burned and workouts flow in automatically. Everything is read-only, kept on this phone, and
        never uploaded anywhere.
      </Muted>

      {sources.length === 0 ? <Muted style={{ marginBottom: 12 }}>Connected apps work in the Android and iPhone apps, not in the browser.</Muted> : null}

      {sources.map((s) => {
        const info = INFO[s.id];
        const st = state[s.id];
        const connected = st?.enabled === true;
        const blocked = unavailable[s.id];
        const error = problems[s.id] ?? errors[s.id] ?? st?.lastError ?? undefined;
        return (
          <Card key={s.id} style={connected ? { borderColor: colors.green } : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H2>{info.title}</H2>
              {connected ? <Text style={{ color: colors.green, fontWeight: '700' }}>● Connected</Text> : null}
            </Row>
            <Muted>{info.blurb}</Muted>
            <Muted style={{ marginTop: 6 }}>Reads: {info.reads}</Muted>

            {s.id === 'strava' && !connected ? (
              <View style={{ marginTop: 12 }}>
                <Muted style={{ marginBottom: 8 }}>
                  Strava needs your own free API app (takes two minutes, a Strava account is enough):{'\n'}
                  1. Open strava.com/settings/api and create an application.{'\n'}
                  2. Set “Authorization Callback Domain” to{' '}
                  <Text style={{ fontWeight: '700', color: colors.text }}>{CALLBACK_DOMAIN}</Text>.{'\n'}
                  3. Paste the Client ID and Client Secret here. They are stored in your phone’s secure storage.
                </Muted>
                <Button title="Open Strava API settings" kind="secondary" onPress={() => void Linking.openURL('https://www.strava.com/settings/api')} />
                <Field label="Client ID" value={clientId} onChangeText={setClientId} keyboardType="number-pad" autoCapitalize="none" />
                <Field label="Client Secret" value={clientSecret} onChangeText={setClientSecret} autoCapitalize="none" autoCorrect={false} secureTextEntry />
                <Muted style={{ marginBottom: 8 }}>Redirect used: {REDIRECT_URI}</Muted>
              </View>
            ) : null}

            {blocked ? <Text style={{ color: colors.accentDark, marginTop: 10 }}>{blocked}</Text> : null}
            {error ? <Text style={{ color: colors.red, marginTop: 10 }}>{error}</Text> : null}
            {connected ? <Muted style={{ marginTop: 10 }}>Last synced {ago(st?.lastSync ?? null)}</Muted> : null}

            <View style={{ marginTop: 12 }}>
              {connected ? (
                <>
                  <Button title={syncing ? 'Syncing…' : 'Sync now'} kind="secondary" disabled={syncing} onPress={() => void syncNow().then(reload)} />
                  <Button title="Disconnect" kind="danger" onPress={() => disconnect(s)} />
                </>
              ) : (
                <Button title={busy === s.id ? 'Connecting…' : `Connect ${info.title}`} disabled={busy !== null || Boolean(blocked)} onPress={() => void connect(s)} />
              )}
            </View>
            {s.id === 'apple-health' && connected ? (
              <Muted>
                iOS never tells an app which Health permissions were allowed. If nothing appears, check Settings → Health → Data Access & Devices → Thali Tally.
              </Muted>
            ) : null}
          </Card>
        );
      })}

      <Card>
        <H2>What about my smartwatch?</H2>
        <Muted>
          Most watches don’t talk to apps like this directly. They sync to their own app, and that app writes into your phone’s health hub, which this
          app reads:{'\n\n'}
          Watch → its app (Garmin Connect, Samsung Health, Fitbit, Mi Fitness, Zepp, Oura, Polar Flow, Apple Watch…) → Apple Health / Health Connect →
          Thali Tally.{'\n\n'}
          So turn on “sync to Health Connect” or “sync to Apple Health” inside your watch’s app once, and it works from then on. Workouts that appear
          in both a hub and Strava are counted once.
        </Muted>
      </Card>
    </ScrollView>
  );
}
