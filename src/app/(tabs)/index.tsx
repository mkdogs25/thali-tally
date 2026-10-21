import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { useState } from 'react';
import { useSteps } from '../../components/StepsProvider';
import { colors, MEAL_ICON } from '../../components/theme';
import { Button, Card, H2, Muted, n0, n1, ProgressBar, Row } from '../../components/ui';
import { dateKey, dayFraction, formatDay } from '../../lib/dates';
import { deleteFoodEntry, FoodEntry, getFoodForDay, getIntegrations, getPlan, getProfile } from '../../lib/db';
import { KIND_LABEL } from '../../lib/health/kinds';
import { MEAL_LABEL, MEAL_TYPES } from '../../lib/foods';
import { Plan, Profile, restingKcalSoFar, stepsToKcal, stepsToKm } from '../../lib/plan';
import { useFocusLoad } from '../../lib/useFocusLoad';

const DEFAULT_KCAL = 2000;
const DEFAULT_PROTEIN = 60;

interface TodayData {
  entries: FoodEntry[];
  profile: Profile | null;
  plan: Plan | null;
  connected: boolean;
}

export default function TodayScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { reading, energy, workouts, refresh: refreshSteps } = useSteps();
  const today = dateKey();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (): Promise<TodayData> => ({
      entries: await getFoodForDay(db, today),
      profile: await getProfile(db),
      plan: await getPlan(db),
      connected: Object.values(await getIntegrations(db)).some((i) => i?.enabled),
    }),
    [db, today],
  );
  const [data, reload] = useFocusLoad<TodayData>(load, { entries: [], profile: null, plan: null, connected: false });

  const eaten = data.entries.reduce(
    (s, e) => ({ kcal: s.kcal + e.kcal, protein: s.protein + e.protein }),
    { kcal: 0, protein: 0 },
  );
  const targetKcal = data.plan?.dailyKcal ?? DEFAULT_KCAL;
  const targetProtein = data.plan?.proteinG ?? DEFAULT_PROTEIN;

  const km = data.profile ? stepsToKm(reading.steps, data.profile) : null;
  const stepKcal = data.profile ? stepsToKcal(reading.steps, data.profile) : null;
  // A connected health app / workouts give a better figure than the steps-only estimate.
  const activeKcal = energy ? energy.activeKcal : stepKcal;
  const restKcal = data.profile ? restingKcalSoFar(data.profile, dayFraction()) : null;
  const burned = activeKcal !== null && restKcal !== null ? activeKcal + restKcal : null;

  const confirmDelete = (e: FoodEntry) =>
    Alert.alert('Remove entry?', `${e.name} (${n0(e.kcal)} kcal)`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteFoodEntry(db, e.id);
          await reload();
        },
      },
    ]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await Promise.all([reload(), refreshSteps()]);
            setRefreshing(false);
          }}
        />
      }
    >
      <Muted>{formatDay(today)}</Muted>

      {!data.plan || !data.profile ? (
        <Card style={{ backgroundColor: colors.soft }}>
          <H2>Set up your goal</H2>
          <Muted>
            Add your details and goal on the Plan tab to get daily calorie and protein targets and an accurate calorie-burn estimate.
            Until then a general {DEFAULT_KCAL} kcal / {DEFAULT_PROTEIN} g target is used.
          </Muted>
          <View style={{ height: 10 }} />
          <Button title="Go to Plan" kind="secondary" onPress={() => router.push('/plan')} />
        </Card>
      ) : null}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2>Calories eaten</H2>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
            {n0(eaten.kcal)} <Text style={{ fontSize: 14, color: colors.muted }}>/ {n0(targetKcal)} kcal</Text>
          </Text>
        </Row>
        <ProgressBar value={eaten.kcal} max={targetKcal} color={colors.accent} />
        <Muted style={{ marginTop: 6 }}>
          {eaten.kcal <= targetKcal ? `${n0(targetKcal - eaten.kcal)} kcal left` : `${n0(eaten.kcal - targetKcal)} kcal over target`}
        </Muted>

        <Row style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <H2>Protein</H2>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
            {n1(eaten.protein)} <Text style={{ fontSize: 14, color: colors.muted }}>/ {n0(targetProtein)} g</Text>
          </Text>
        </Row>
        <ProgressBar value={eaten.protein} max={targetProtein} color={colors.protein} />
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2>Steps</H2>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{n0(reading.steps)}</Text>
        </Row>
        <ProgressBar value={reading.steps} max={10000} color={colors.steps} />
        <Muted style={{ marginTop: 6 }}>
          {km !== null ? `${n1(km)} km walked · ` : ''}goal 10,000
        </Muted>
        {reading.note ? <Muted style={{ marginTop: 6, color: colors.accentDark }}>{reading.note}</Muted> : null}

        {burned !== null && activeKcal !== null && restKcal !== null ? (
          <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text }}>{energy?.basis === 'device' ? 'Active (from your watch/phone)' : energy ? 'Active (steps + workouts)' : 'Burned walking'}</Text>
              <Text style={{ fontWeight: '700', color: colors.text }}>{n0(activeKcal)} kcal</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: colors.text }}>Resting so far</Text>
              <Text style={{ fontWeight: '700', color: colors.text }}>{n0(restKcal)} kcal</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: colors.text }}>Total burned so far</Text>
              <Text style={{ fontWeight: '800', color: colors.green }}>{n0(burned)} kcal</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: colors.text }}>Eaten − burned</Text>
              <Text style={{ fontWeight: '800', color: colors.text }}>{n0(eaten.kcal - burned)} kcal</Text>
            </Row>
            <Muted style={{ marginTop: 8 }}>
              {energy?.basis === 'device'
                ? 'Active energy is measured by your connected health app. Resting uses the Mifflin-St Jeor formula.'
                : 'Estimates: walking uses your height and weight, workouts use the energy your apps report, and resting uses the Mifflin-St Jeor formula.'}
            </Muted>
          </View>
        ) : (
          <Muted style={{ marginTop: 8 }}>Add your details on the Plan tab to estimate calories burned.</Muted>
        )}
      </Card>

      {workouts.length > 0 ? (
        <Card>
          <H2>Workouts today</H2>
          {workouts.map((w) => (
            <Row key={w.id} style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{w.name === KIND_LABEL[w.kind] ? w.name : `${w.name} · ${KIND_LABEL[w.kind]}`}</Text>
                <Muted>
                  {w.app} · {Math.max(1, Math.round((w.endMs - w.startMs) / 60_000))} min
                  {w.distanceM ? ` · ${n1(w.distanceM / 1000)} km` : ''}
                </Muted>
              </View>
              <Text style={{ color: colors.green, fontWeight: '700' }}>{w.kcal !== null ? `${n0(w.kcal)} kcal` : '–'}</Text>
            </Row>
          ))}
        </Card>
      ) : null}

      {!data.connected ? (
        <Card>
          <H2>Bring in your watch and fitness apps</H2>
          <Muted>Connect Apple Health, Health Connect or Strava for all-day steps, measured calories burned and your workouts.</Muted>
          <View style={{ height: 10 }} />
          <Button title="Connect apps" kind="secondary" onPress={() => router.push('/connections')} />
        </Card>
      ) : null}

      <Button title="＋ Add food" onPress={() => router.push('/add')} />

      {MEAL_TYPES.map((meal) => {
        const items = data.entries.filter((e) => e.meal === meal);
        if (items.length === 0) return null;
        const total = items.reduce((s, e) => s + e.kcal, 0);
        return (
          <Card key={meal}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H2>
                {MEAL_ICON[meal]} {MEAL_LABEL[meal]}
              </H2>
              <Muted>{n0(total)} kcal</Muted>
            </Row>
            {items.map((e) => (
              <Pressable key={e.id} onLongPress={() => confirmDelete(e)} style={{ paddingVertical: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>{e.name}</Text>
                    <Muted>{e.qty ? `${e.qty} · ` : ''}{n1(e.protein)} g protein</Muted>
                  </View>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{n0(e.kcal)}</Text>
                  <Pressable onPress={() => confirmDelete(e)} hitSlop={10} style={{ paddingLeft: 12 }} accessibilityLabel={`Remove ${e.name}`}>
                    <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
                  </Pressable>
                </Row>
              </Pressable>
            ))}
          </Card>
        );
      })}
      {data.entries.length === 0 ? <Muted>Nothing logged yet today. Tap “Add food” to start.</Muted> : null}
    </ScrollView>
  );
}
