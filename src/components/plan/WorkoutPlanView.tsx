import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAccount } from '../AccountProvider';
import { Text } from '../Text';
import { colors } from '../theme';
import { Button, Card, Chip, H2, Muted, n0, Row, Wrap } from '../ui';
import { getPlan, getProfile, getWorkoutPlan, saveWorkoutPlan } from '../../lib/db';
import type { Goal, Plan, Profile } from '../../lib/plan';
import { useFocusLoad } from '../../lib/useFocusLoad';
import {
  ACTIVITY_LABEL,
  ActivityPref,
  buildWorkoutPlan,
  DAY_NAMES,
  Equipment,
  Exercise,
  Experience,
  Session,
  weekdayIndex,
  WorkoutPlan,
  WorkoutPrefs,
} from '../../lib/workout';

const DEFAULTS: WorkoutPrefs = { days: 3, minutes: 45, equipment: 'none', experience: 'beginner', activities: ['strength', 'walk'], lowImpact: false };

const EQUIPMENT_LABEL: Record<Equipment, string> = { none: 'Nothing (bodyweight)', light: 'Dumbbells or bands', gym: 'Full gym' };
const EXPERIENCE_LABEL: Record<Experience, string> = { beginner: 'New to it', intermediate: 'Some experience' };

const describe = (e: Exercise) => {
  const amount = e.sets && e.reps ? `${e.sets} × ${e.reps}` : e.sets && e.seconds ? `${e.sets} × ${e.seconds}s` : e.reps ? e.reps : e.seconds ? (e.seconds >= 120 ? `${Math.round(e.seconds / 60)} min` : `${e.seconds}s`) : '';
  return { amount, name: e.name, note: e.note };
};

interface Saved {
  profile: Profile | null;
  plan: Plan | null;
  workout: WorkoutPlan | null;
}

/** Asks what kind of exercise the person prefers, then builds a week of sessions around it. */
export function WorkoutPlanView() {
  const db = useSQLiteContext();
  const { version } = useAccount();
  const load = useCallback(async (): Promise<Saved> => ({ profile: await getProfile(db), plan: await getPlan(db), workout: await getWorkoutPlan(db) }), [db]);
  const [saved, reload] = useFocusLoad<Saved>(load, { profile: null, plan: null, workout: null }, version);

  const [prefs, setPrefs] = useState<WorkoutPrefs>(DEFAULTS);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (saved.workout) setPrefs(saved.workout.prefs);
  }, [saved.workout]);

  const goal: Goal = saved.plan?.goal ?? 'maintain';
  const weightKg = saved.profile?.weightKg ?? 0;
  const set = <K extends keyof WorkoutPrefs>(k: K, v: WorkoutPrefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  const toggleActivity = (a: ActivityPref) =>
    set('activities', prefs.activities.includes(a) ? prefs.activities.filter((x) => x !== a) : [...prefs.activities, a]);

  const create = async () => {
    const plan = buildWorkoutPlan({ prefs, goal, weightKg });
    await saveWorkoutPlan(db, plan);
    setOpen(weekdayIndex());
    await reload();
  };

  const plan = saved.workout;
  const today = weekdayIndex();

  if (!saved.profile) {
    return (
      <Card>
        <H2>Set up your details first</H2>
        <Muted>The workout plan uses your weight to estimate calories and your goal to shape the week. Fill in the Diet section and create your diet plan, then come back here.</Muted>
      </Card>
    );
  }

  return (
    <View>
      <Muted style={{ marginBottom: 12 }}>
        Tell us what you like and what you have, and we will build a week around it. Your goal ({goal === 'lose' ? 'losing weight' : goal === 'gain' ? 'gaining weight' : 'maintaining'}) comes from your diet plan.
      </Muted>

      <Card>
        <H2>What would you like to do?</H2>
        <Muted style={{ marginBottom: 8 }}>Pick as many as you enjoy.</Muted>
        <Wrap>
          {(Object.keys(ACTIVITY_LABEL) as ActivityPref[]).map((a) => (
            <Chip key={a} label={ACTIVITY_LABEL[a]} selected={prefs.activities.includes(a)} onPress={() => toggleActivity(a)} />
          ))}
        </Wrap>
        {prefs.activities.length === 0 ? <Muted style={{ marginTop: -6, marginBottom: 8 }}>Nothing picked: we will use strength training and walking.</Muted> : null}

        <Muted style={{ marginBottom: 6 }}>Days per week</Muted>
        <Wrap>
          {[2, 3, 4, 5, 6].map((d) => (
            <Chip key={d} label={String(d)} selected={prefs.days === d} onPress={() => set('days', d)} />
          ))}
        </Wrap>

        <Muted style={{ marginBottom: 6 }}>Time per session</Muted>
        <Wrap>
          {([20, 30, 45, 60] as const).map((m) => (
            <Chip key={m} label={`${m} min`} selected={prefs.minutes === m} onPress={() => set('minutes', m)} />
          ))}
        </Wrap>

        <Muted style={{ marginBottom: 6 }}>What do you have for strength work?</Muted>
        <Wrap>
          {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => (
            <Chip key={e} label={EQUIPMENT_LABEL[e]} selected={prefs.equipment === e} onPress={() => set('equipment', e)} />
          ))}
        </Wrap>

        <Muted style={{ marginBottom: 6 }}>Experience</Muted>
        <Wrap>
          {(Object.keys(EXPERIENCE_LABEL) as Experience[]).map((e) => (
            <Chip key={e} label={EXPERIENCE_LABEL[e]} selected={prefs.experience === e} onPress={() => set('experience', e)} />
          ))}
        </Wrap>

        <Wrap>
          <Chip label="Low impact: no running or jumping" selected={prefs.lowImpact} onPress={() => set('lowImpact', !prefs.lowImpact)} />
        </Wrap>

        <Button title={plan ? 'Rebuild my workout plan' : 'Create my workout plan'} onPress={() => void create()} />
      </Card>

      {plan ? (
        <>
          <Card style={{ borderColor: colors.accent }}>
            <H2>Your week</H2>
            <Muted style={{ marginBottom: 10 }}>
              {plan.sessions.filter((s) => s.kind !== 'rest').length} sessions · {n0(plan.weeklyMinutes)} min · about {n0(plan.weeklyKcal)} kcal above resting. Tap a day for the details.
            </Muted>
            {plan.sessions.map((s) => (
              <SessionRow key={s.day} session={s} isToday={s.day === today} open={open === s.day} onPress={() => setOpen(open === s.day ? null : s.day)} />
            ))}
          </Card>

          <Card>
            <H2>Good to know</H2>
            {plan.tips.map((t) => (
              <Muted key={t} style={{ marginBottom: 8 }}>
                {t}
              </Muted>
            ))}
            <Muted>Calorie figures are estimates from standard exercise tables (MET values) and your weight.</Muted>
          </Card>
        </>
      ) : null}
    </View>
  );
}

function SessionRow({ session: s, isToday, open, onPress }: { session: Session; isToday: boolean; open: boolean; onPress: () => void }) {
  const rest = s.kind === 'rest';
  return (
    <Pressable
      onPress={rest ? undefined : onPress}
      accessibilityRole={rest ? undefined : 'button'}
      style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, opacity: rest ? 0.75 : 1 }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {DAY_NAMES[s.day]}
            {isToday ? <Text style={{ color: colors.accent }}> · today</Text> : null}
          </Text>
          <Text style={{ color: rest ? colors.muted : colors.text }}>{s.title}</Text>
        </View>
        {rest ? null : (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{s.minutes} min</Text>
            <Muted>~{n0(s.kcal)} kcal</Muted>
          </View>
        )}
      </Row>
      {open && !rest ? (
        <View style={{ marginTop: 8 }}>
          {s.note ? <Muted style={{ marginBottom: 6 }}>{s.note}</Muted> : null}
          {s.steps ? <Muted style={{ marginBottom: 6 }}>Aim for about {n0(s.steps)} steps.</Muted> : null}
          {s.exercises.map((e, i) => {
            const d = describe(e);
            return (
              <View key={`${e.name}-${i}`} style={{ marginBottom: 6 }}>
                <Text style={{ color: colors.text }}>
                  <Text style={{ fontWeight: '700', color: colors.accentDark }}>{d.amount ? `${d.amount}  ` : ''}</Text>
                  {d.name}
                </Text>
                {d.note ? <Muted>{d.note}</Muted> : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </Pressable>
  );
}
