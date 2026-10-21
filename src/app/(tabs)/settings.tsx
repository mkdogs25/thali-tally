import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Switch } from 'react-native';
import { confirmAction, notify } from '../../lib/dialogs';
import { Text } from '../../components/Text';
import { AccountCard } from '../../components/AccountCard';
import { useAccount } from '../../components/AccountProvider';
import { MESSAGE } from '../../lib/storageMode';
import { useSteps } from '../../components/StepsProvider';
import { colors } from '../../components/theme';
import { Button, Card, H1, H2, Muted, Row } from '../../components/ui';
import { eraseEverything, getReminders, Reminders, saveReminders } from '../../lib/db';
import { applyReminders } from '../../lib/reminders';
import { StepSource } from '../../lib/steps';
import { useFocusLoad } from '../../lib/useFocusLoad';

const SOURCE_LABEL: Record<StepSource, string> = {
  'apple-health': 'Apple Health (phone, watch and apps combined)',
  'health-connect': 'Health Connect (phone, watch and apps combined)',
  'ios-motion': 'This iPhone’s motion sensor (counts all day, phone only)',
  live: 'Live counting while the app is open (may under-count)',
  none: 'Not available',
};

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { reading, refresh } = useSteps();
  const account = useAccount();
  const load = useCallback(() => getReminders(db), [db]);
  const [reminders, reload] = useFocusLoad<Reminders>(load, { meals: false, weighIn: false });

  const update = async (next: Reminders) => {
    const ok = await applyReminders(next);
    if (!ok) {
      notify('Notifications are off', 'Allow notifications for Thali Tally in your phone settings to get reminders.');
      return;
    }
    await saveReminders(db, next);
    await reload();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <H1>Settings</H1>

      <AccountCard />

      <Card>
        <H2>Connected apps</H2>
        <Muted style={{ marginBottom: 10 }}>
          Bring in steps, calories burned and workouts from Apple Health, Health Connect (Samsung, Garmin, Fitbit, Oura and more) and Strava.
        </Muted>
        <Button title="Manage connected apps" onPress={() => router.push('/connections')} />
      </Card>

      <Card>
        <H2>Reminders</H2>
        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: colors.text, flex: 1 }}>Meal logging (9:00, 13:30, 20:30)</Text>
          <Switch value={reminders.meals} onValueChange={(v) => void update({ ...reminders, meals: v })} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, flex: 1 }}>Weekly weigh-in (Mondays, 8:00)</Text>
          <Switch value={reminders.weighIn} onValueChange={(v) => void update({ ...reminders, weighIn: v })} />
        </Row>
      </Card>

      <Card>
        <H2>Step counting</H2>
        <Text style={{ color: colors.text }}>{SOURCE_LABEL[reading.source]}</Text>
        {reading.note ? <Muted style={{ marginTop: 6 }}>{reading.note}</Muted> : null}
        <Button title="Re-check steps now" kind="secondary" onPress={() => void refresh()} />
      </Card>

      <Card>
        <H2>About the numbers</H2>
        <Muted>
          Nutrition values for ingredients are per 100 g raw weight, taken from the ICMR-NIN Indian Food Composition Tables. Dishes and recipes are
          calculated from raw ingredient weights, so cooked weight does not matter — weigh ingredients before cooking.
          {'\n\n'}
          Calories burned are estimates: walking is worked out from steps, your height (stride length) and your weight; resting burn uses the
          Mifflin-St Jeor formula.
          {'\n\n'}
          {account.protection === 'synced'
            ? 'Your food log, weights, recipes, profile and plans are stored on your account as well as on this device. Steps, workouts and connected-app sign-ins stay on this device.'
            : `${MESSAGE[account.protection].long} Nothing is uploaded unless you choose a cloud account and sign in.`}
          {' '}Other network requests: the optional barcode lookup sends the barcode number to Open Food Facts, and connected apps talk to their own services.
        </Muted>
      </Card>

      <Card>
        <H2>Your data</H2>
        {account.status === 'signed-in' ? (
          <Muted style={{ marginBottom: 10 }}>You are signed in, so your account keeps its copy and it comes back on the next sync. Sign out first to keep this phone separate.</Muted>
        ) : null}
        <Button
          title="Erase all data on this device"
          kind="danger"
          onPress={() =>
            confirmAction({
              title: 'Erase everything?',
              message: 'This deletes your profile, plans, food log, weights and saved recipes from this phone.',
              confirmLabel: 'Erase',
              destructive: true,
              onConfirm: async () => {
                await eraseEverything(db);
                await applyReminders({ meals: false, weighIn: false });
                await reload();
              },
            })
          }
        />
      </Card>
    </ScrollView>
  );
}
