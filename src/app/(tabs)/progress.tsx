import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { notify } from '../../lib/dialogs';
import { Text } from '../../components/Text';
import { colors } from '../../components/theme';
import { Button, Card, Field, H1, H2, Muted, n0, n1, parseNum, Row } from '../../components/ui';
import { Point, WeightChart } from '../../components/WeightChart';
import { addDays, dateKey, daysBetween, formatDay, lastNDays } from '../../lib/dates';
import { DayTotals, deleteWeight, getDailyTotals, getPlan, getStepDays, getWeights, saveWeight, WeightEntry } from '../../lib/db';
import { expectedWeight, Plan } from '../../lib/plan';
import { useAccount } from '../../components/AccountProvider';
import { useFocusLoad } from '../../lib/useFocusLoad';

interface ProgressData {
  weights: WeightEntry[];
  plan: Plan | null;
  totals: DayTotals[];
  steps: { date: string; steps: number }[];
}

export default function ProgressScreen() {
  const db = useSQLiteContext();
  const { version } = useAccount();
  const today = dateKey();
  const days = lastNDays(7, today);
  const [input, setInput] = useState('');

  const load = useCallback(
    async (): Promise<ProgressData> => ({
      weights: await getWeights(db),
      plan: await getPlan(db),
      totals: await getDailyTotals(db, days[0], today),
      steps: await getStepDays(db, days[0], today),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, today],
  );
  const [data, reload] = useFocusLoad<ProgressData>(load, { weights: [], plan: null, totals: [], steps: [] }, version);

  const logWeight = async () => {
    const kg = parseNum(input);
    if (!(kg > 20 && kg < 400)) return notify('Check the number', 'Enter your weight in kilograms, e.g. 68.5');
    await saveWeight(db, today, kg);
    setInput('');
    await reload();
  };

  const actual: Point[] = data.weights.map((w) => ({ date: w.date, kg: w.kg }));
  let planned: Point[] = [];
  if (data.plan && data.plan.goal !== 'maintain') {
    const end = addDays(data.plan.startDate, data.plan.effectiveWeeks * 7);
    planned = [
      { date: data.plan.startDate, kg: data.plan.profile.weightKg },
      { date: end, kg: expectedWeight(data.plan, data.plan.effectiveWeeks) },
    ];
  }

  const latest = data.weights.at(-1);
  const targetKcal = data.plan?.dailyKcal ?? 0;
  const maxKcal = Math.max(targetKcal, ...data.totals.map((t) => t.kcal), 1);
  const maxSteps = Math.max(10000, ...data.steps.map((s) => s.steps));

  let onTrack: string | null = null;
  if (data.plan && latest && data.plan.goal !== 'maintain') {
    const weeksIn = daysBetween(data.plan.startDate, latest.date) / 7;
    const diff = latest.kg - expectedWeight(data.plan, weeksIn);
    const ahead = data.plan.goal === 'lose' ? diff <= 0 : diff >= 0;
    const gap = Math.round(Math.abs(diff) * 10) / 10;
    onTrack =
      gap === 0
        ? "You're right on plan."
        : ahead
          ? `You're ${n1(gap)} kg ahead of plan.`
          : `You're ${n1(gap)} kg behind plan. Small, steady changes add up.`;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <H1>Progress</H1>

      <Card>
        <H2>Weight</H2>
        {actual.length > 0 ? <WeightChart actual={actual} planned={planned} /> : <Muted>Log your weight to see your progress chart.</Muted>}
        {planned.length > 0 ? <Muted style={{ marginTop: 4 }}>Solid: logged · dashed: plan</Muted> : null}
        {onTrack ? <Text style={{ color: colors.text, marginTop: 8 }}>{onTrack}</Text> : null}
        <View style={{ height: 12 }} />
        <Field label={`Weight today${latest ? ` (last: ${latest.kg} kg)` : ''}`} suffix="kg" value={input} onChangeText={setInput} keyboardType="decimal-pad" />
        <Button title="Log weight" onPress={logWeight} />
        {[...data.weights].reverse().slice(0, 6).map((w) => (
          <Row key={w.date} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: colors.text }}>
              {formatDay(w.date)}
              {w.source && w.source !== 'manual' ? <Text style={{ color: colors.muted }}> · {w.source === 'apple-health' ? 'Apple Health' : 'Health Connect'}</Text> : null}
            </Text>
            <Row>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{w.kg} kg</Text>
              <Pressable
                hitSlop={10}
                style={{ paddingLeft: 12 }}
                accessibilityLabel={`Delete weight for ${w.date}`}
                onPress={async () => {
                  await deleteWeight(db, w.date);
                  await reload();
                }}
              >
                <Text style={{ color: colors.muted }}>×</Text>
              </Pressable>
            </Row>
          </Row>
        ))}
      </Card>

      <Card>
        <H2>Calories, last 7 days</H2>
        {days.map((d) => {
          const t = data.totals.find((x) => x.date === d);
          const kcal = t?.kcal ?? 0;
          return (
            <Row key={d} style={{ marginBottom: 6 }}>
              <Text style={{ width: 62, color: colors.muted, fontSize: 12 }}>{formatDay(d).slice(0, 7)}</Text>
              <View style={{ flex: 1, height: 14, backgroundColor: colors.track, borderRadius: 7, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${(kcal / maxKcal) * 100}%`,
                    height: 14,
                    backgroundColor: targetKcal && kcal > targetKcal ? colors.red : colors.accent,
                  }}
                />
              </View>
              <Text style={{ width: 54, textAlign: 'right', color: colors.text, fontSize: 12 }}>{kcal ? n0(kcal) : '–'}</Text>
            </Row>
          );
        })}
        {targetKcal ? <Muted>Target {n0(targetKcal)} kcal/day. Red bars went over.</Muted> : null}
      </Card>

      <Card>
        <H2>Steps, last 7 days</H2>
        {days.map((d) => {
          const steps = data.steps.find((x) => x.date === d)?.steps ?? 0;
          return (
            <Row key={d} style={{ marginBottom: 6 }}>
              <Text style={{ width: 62, color: colors.muted, fontSize: 12 }}>{formatDay(d).slice(0, 7)}</Text>
              <View style={{ flex: 1, height: 14, backgroundColor: colors.track, borderRadius: 7, overflow: 'hidden' }}>
                <View style={{ width: `${(steps / maxSteps) * 100}%`, height: 14, backgroundColor: colors.steps }} />
              </View>
              <Text style={{ width: 54, textAlign: 'right', color: colors.text, fontSize: 12 }}>{steps ? n0(steps) : '–'}</Text>
            </Row>
          );
        })}
      </Card>
    </ScrollView>
  );
}
