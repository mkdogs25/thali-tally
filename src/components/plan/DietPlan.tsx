import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAccount } from '../AccountProvider';
import { Text } from '../Text';
import { colors, MEAL_ICON } from '../theme';
import { Button, Card, Chip, Field, H2, Muted, n0, n1, parseNum, Row, Wrap } from '../ui';
import { addDays, dateKey, formatDay } from '../../lib/dates';
import { getFavourites, getPlan, getProfile, getRecipes, saveFavourites, saveWeight, savePlan, saveProfile, type SavedRecipe } from '../../lib/db';
import { Favourite, resolveAll } from '../../lib/favourites';
import { MEAL_LABEL } from '../../lib/foods';
import { ACTIVITY_LABEL, ActivityLevel, buildPlan, Goal, PROTEIN_G_PER_KG, Plan, Profile, Sex } from '../../lib/plan';
import { suggestDay } from '../../lib/suggest';
import { useFocusLoad } from '../../lib/useFocusLoad';
import { RegularFoods } from './RegularFoods';

const GOAL_LABEL: Record<Goal, string> = { lose: 'Lose weight', maintain: 'Maintain', gain: 'Gain weight' };

interface Saved {
  profile: Profile | null;
  plan: Plan | null;
  favourites: Favourite[];
  recipes: SavedRecipe[];
}

/** Details, goal, calorie and protein targets, regular foods and a sample day of meals. */
export function DietPlan() {
  const db = useSQLiteContext();
  const { version } = useAccount();
  const load = useCallback(
    async (): Promise<Saved> => ({
      profile: await getProfile(db),
      plan: await getPlan(db),
      favourites: await getFavourites(db),
      recipes: await getRecipes(db),
    }),
    [db],
  );
  const [saved, reload] = useFocusLoad<Saved>(load, { profile: null, plan: null, favourites: [], recipes: [] }, version);

  const [sex, setSex] = useState<Sex>('female');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('light');
  const [goal, setGoal] = useState<Goal>('lose');
  const [target, setTarget] = useState('');
  const [weeks, setWeeks] = useState('12');
  const [preview, setPreview] = useState<{ plan?: Plan; error?: string } | null>(null);
  const [variant, setVariant] = useState(0);

  // Fill the form from what is stored.
  useEffect(() => {
    if (saved.profile) {
      setSex(saved.profile.sex);
      setAge(String(saved.profile.age));
      setHeight(String(saved.profile.heightCm));
      setWeight(String(saved.profile.weightKg));
      setActivity(saved.profile.activity);
    }
    if (saved.plan) {
      setGoal(saved.plan.goal);
      setTarget(String(saved.plan.targetWeightKg));
      setWeeks(String(saved.plan.weeks));
    }
  }, [saved.profile, saved.plan]);

  const create = () => {
    const result = buildPlan({
      profile: { sex, age: parseNum(age), heightCm: parseNum(height), weightKg: parseNum(weight), activity },
      goal,
      targetWeightKg: parseNum(target),
      weeks: parseNum(weeks),
      startDate: dateKey(),
    });
    setPreview(result.ok ? { plan: result.plan } : { error: result.error });
    setVariant(0);
  };

  const save = async (plan: Plan) => {
    await saveProfile(db, plan.profile);
    await savePlan(db, plan);
    await saveWeight(db, plan.startDate, plan.profile.weightKg);
    setPreview(null);
    await reload();
  };

  const changeFavourites = async (next: Favourite[]) => {
    await saveFavourites(db, next);
    await reload();
  };

  const shown = preview?.plan ?? saved.plan;
  const isPreview = Boolean(preview?.plan);
  const regulars = useMemo(() => resolveAll(saved.favourites, saved.recipes), [saved.favourites, saved.recipes]);
  const day = shown ? suggestDay(shown.dailyKcal, shown.proteinG, variant, regulars) : null;

  return (
    <View>
      <Muted style={{ marginBottom: 12 }}>Tell us about you and your goal. Targets are recalculated whenever you create a new plan.</Muted>

      <Card>
        <H2>About you</H2>
        <Wrap>
          <Chip label="Female" selected={sex === 'female'} onPress={() => setSex('female')} />
          <Chip label="Male" selected={sex === 'male'} onPress={() => setSex('male')} />
        </Wrap>
        <Field label="Age" suffix="years" value={age} onChangeText={setAge} keyboardType="number-pad" />
        <Field label="Height" suffix="cm" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
        <Field label="Current weight" suffix="kg" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        <Muted style={{ marginBottom: 6 }}>Activity level</Muted>
        <Wrap>
          {(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((a) => (
            <Chip key={a} label={ACTIVITY_LABEL[a].split(' (')[0]} selected={activity === a} onPress={() => setActivity(a)} />
          ))}
        </Wrap>
        <Muted>{ACTIVITY_LABEL[activity]}</Muted>
      </Card>

      <Card>
        <H2>Your goal</H2>
        <Wrap>
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
            <Chip key={g} label={GOAL_LABEL[g]} selected={goal === g} onPress={() => setGoal(g)} />
          ))}
        </Wrap>
        {goal !== 'maintain' ? (
          <>
            <Field label="Target weight" suffix="kg" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
            <Field label="Time period" suffix="weeks" value={weeks} onChangeText={setWeeks} keyboardType="number-pad" />
            <Wrap>
              {[4, 8, 12, 16, 24].map((w) => (
                <Chip key={w} label={`${w} wk`} selected={parseNum(weeks) === w} onPress={() => setWeeks(String(w))} />
              ))}
            </Wrap>
          </>
        ) : null}
        <Button title="Create my plan" onPress={create} />
        {preview?.error ? <Text style={{ color: colors.red }}>{preview.error}</Text> : null}
      </Card>

      {shown ? (
        <Card style={{ borderColor: colors.accent }}>
          <H2>{isPreview ? 'Proposed plan' : 'Current plan'}</H2>
          <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text }}>{n0(shown.dailyKcal)} kcal / day</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.protein }}>{n0(shown.proteinG)} g protein / day</Text>
          <Muted style={{ marginBottom: 8 }}>
            That is {PROTEIN_G_PER_KG[shown.profile.activity]} g per kg of body weight, the right range for your activity level.
          </Muted>
          {shown.goal !== 'maintain' ? (
            <Muted>
              {shown.profile.weightKg} to {shown.targetWeightKg} kg at about {n1(Math.abs(shown.weeklyChangeKg))} kg/week.{'\n'}
              Takes {shown.effectiveWeeks} weeks · reach it by {formatDay(addDays(shown.startDate, shown.effectiveWeeks * 7))}.
            </Muted>
          ) : (
            <Muted>Eating at maintenance to hold {shown.profile.weightKg} kg.</Muted>
          )}
          <Muted style={{ marginTop: 6 }}>
            Resting burn {n0(shown.bmr)} kcal · with your activity {n0(shown.tdee)} kcal/day.
          </Muted>
          {shown.warnings.map((w) => (
            <Text key={w} style={{ color: colors.accentDark, marginTop: 8 }}>
              Note: {w}
            </Text>
          ))}
          {isPreview && preview?.plan ? (
            <View style={{ marginTop: 14 }}>
              <Button title="Save this plan" onPress={() => void save(preview.plan!)} />
            </View>
          ) : null}
        </Card>
      ) : null}

      <RegularFoods favourites={saved.favourites} recipes={saved.recipes} onChange={(next) => void changeFavourites(next)} />

      {day && shown ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <H2>A day of meals</H2>
            <Chip label="Shuffle" onPress={() => setVariant((v) => v + 1)} />
          </Row>
          <Muted style={{ marginBottom: 8 }}>
            Vegetarian suggestions that land close to your targets. Portions are in servings (1 roti, 1 katori, …).
          </Muted>
          {day.meals.map((m) => (
            <View key={m.meal} style={{ marginBottom: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>
                  {MEAL_ICON[m.meal]} {MEAL_LABEL[m.meal]}
                </Text>
                <Muted>
                  {n0(m.nutrition.kcal)} kcal · {n0(m.nutrition.protein)} g
                </Muted>
              </Row>
              {m.items.map((i) => (
                <Text key={i.id} style={{ color: colors.text, marginLeft: 22 }}>
                  {n1(i.servings)} × {i.regular ? <Text style={{ fontWeight: '700' }}>{i.name}</Text> : i.name}{' '}
                  <Text style={{ color: colors.muted }}>({i.serving})</Text>
                </Text>
              ))}
              {m.fromRegulars ? <Muted style={{ marginLeft: 22 }}>Built from your regular foods (bold).</Muted> : null}
            </View>
          ))}
          <Muted>
            Day total: {n0(day.total.kcal)} kcal · {n0(day.total.protein)} g protein (target {n0(shown.dailyKcal)} kcal · {n0(shown.proteinG)} g).
          </Muted>
        </Card>
      ) : null}

      <Muted>
        These are general estimates, not medical advice. If you have a health condition, are pregnant or breastfeeding, or want to lose more than the
        suggested pace, speak to a doctor or dietitian.
      </Muted>
    </View>
  );
}
