import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { Alert, ScrollView, Switch, Text } from 'react-native';
import { useSteps } from '../../components/StepsProvider';
import { colors } from '../../components/theme';
import { Button, Card, H1, H2, Muted, Row } from '../../components/ui';
import { eraseEverything, getReminders, Reminders, saveReminders } from '../../lib/db';
import { applyReminders } from '../../lib/reminders';
import { StepSource } from '../../lib/steps';
import { useFocusLoad } from '../../lib/useFocusLoad';

const SOURCE_LABEL: Record<StepSource, string> = {
  'ios-motion': 'Apple Motion & Fitness (counts all day)',
  'health-connect': 'Android Health Connect (counts all day)',
  live: 'Live counting while the app is open (may under-count)',
  none: 'Not available',
};

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { reading, refresh } = useSteps();
  const load = useCallback(() => getReminders(db), [db]);
  const [reminders, reload] = useFocusLoad<Reminders>(load, { meals: false, weighIn: false });

  const update = async (next: Reminders) => {
    const ok = await applyReminders(next);
    if (!ok) {
      Alert.alert('Notifications are off', 'Allow notifications for Thali Tally in your phone settings to get reminders.');
      return;
    }
    await saveReminders(db, next);
    await reload();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <H1>Settings</H1>

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
          All your data is stored only on this phone, in a local database. Nothing is uploaded. The only network request the app makes is the
          optional barcode lookup, which sends the barcode number to Open Food Facts.
        </Muted>
      </Card>

      <Card>
        <H2>Your data</H2>
        <Button
          title="Erase all data"
          kind="danger"
          onPress={() =>
            Alert.alert('Erase everything?', 'This deletes your profile, plan, food log, weights and saved recipes from this phone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Erase',
                style: 'destructive',
                onPress: async () => {
                  await eraseEverything(db);
                  await applyReminders({ meals: false, weighIn: false });
                  await reload();
                },
              },
            ])
          }
        />
      </Card>
    </ScrollView>
  );
}
