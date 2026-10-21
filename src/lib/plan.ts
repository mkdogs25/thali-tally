export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very';
export type Goal = 'lose' | 'maintain' | 'gain';

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
}

export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (desk job, little exercise)',
  light: 'Light (exercise 1–3 days/week)',
  moderate: 'Moderate (exercise 3–5 days/week)',
  very: 'Very active (hard exercise 6–7 days/week)',
};

/** Energy in a kilogram of body-weight change, the standard planning figure. */
export const KCAL_PER_KG = 7700;

/** Never plan below these intakes without medical supervision. */
export const MIN_KCAL: Record<Sex, number> = { female: 1200, male: 1500 };

const MAX_LOSS_FRACTION_PER_WEEK = 0.01; // 1 % of body weight
const MAX_LOSS_KG_PER_WEEK = 1;
const MAX_GAIN_KG_PER_WEEK = 0.5;

/** Mifflin-St Jeor resting energy expenditure, kcal/day. */
export function bmr(p: Profile): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

export function tdee(p: Profile): number {
  return bmr(p) * ACTIVITY_FACTOR[p.activity];
}

export interface PlanInput {
  profile: Profile;
  goal: Goal;
  targetWeightKg: number;
  weeks: number;
  startDate: string;
}

export interface Plan extends PlanInput {
  bmr: number;
  tdee: number;
  dailyKcal: number;
  proteinG: number;
  /** Signed kg/week the plan actually delivers (negative = loss). */
  weeklyChangeKg: number;
  /** Weeks the plan really needs; longer than `weeks` if the request was too aggressive. */
  effectiveWeeks: number;
  adjusted: boolean;
  warnings: string[];
}

export type PlanResult = { ok: true; plan: Plan } | { ok: false; error: string };

/**
 * Grams of protein per kg of body weight, by activity. Deliberately kept within 0.8-1.0 g/kg: 0.8 is the
 * everyday recommendation (ICMR-NIN gives about 0.83), and 1.0 is the ceiling for someone training hard.
 * Moderate exercise sits in the middle. During weight loss a little more can help keep muscle, so if you
 * lift seriously, discuss going higher with a dietitian.
 */
export const PROTEIN_G_PER_KG: Record<ActivityLevel, number> = {
  sedentary: 0.8,
  light: 0.8,
  moderate: 0.9,
  very: 1.0,
};

/**
 * Daily protein target in grams. When losing weight it is worked out on the target weight (the body you are
 * building towards) rather than the current one, so a heavier starting weight does not inflate it.
 */
export function proteinTarget(weightKg: number, activity: ActivityLevel, dailyKcal: number): number {
  const grams = PROTEIN_G_PER_KG[activity] * weightKg;
  // Protein should never be more than 35 % of energy.
  return Math.round(Math.min(grams, (dailyKcal * 0.35) / 4));
}

export function buildPlan(input: PlanInput): PlanResult {
  const { profile, goal, targetWeightKg, weeks } = input;
  if (!(profile.weightKg > 0 && profile.heightCm > 0 && profile.age > 0)) {
    return { ok: false, error: 'Enter your age, height and weight first.' };
  }
  const baseBmr = bmr(profile);
  const baseTdee = tdee(profile);
  const warnings: string[] = [];

  if (goal === 'maintain') {
    const dailyKcal = Math.round(baseTdee);
    return {
      ok: true,
      plan: {
        ...input,
        targetWeightKg: profile.weightKg,
        bmr: baseBmr,
        tdee: baseTdee,
        dailyKcal,
        proteinG: proteinTarget(profile.weightKg, profile.activity, dailyKcal),
        weeklyChangeKg: 0,
        effectiveWeeks: weeks,
        adjusted: false,
        warnings,
      },
    };
  }

  const delta = targetWeightKg - profile.weightKg;
  if (goal === 'lose' && delta >= 0) return { ok: false, error: 'Your target weight must be below your current weight.' };
  if (goal === 'gain' && delta <= 0) return { ok: false, error: 'Your target weight must be above your current weight.' };
  if (!(weeks >= 1)) return { ok: false, error: 'Choose a time period of at least one week.' };

  const maxWeekly =
    goal === 'lose'
      ? Math.min(MAX_LOSS_KG_PER_WEEK, MAX_LOSS_FRACTION_PER_WEEK * profile.weightKg)
      : MAX_GAIN_KG_PER_WEEK;
  const sign = goal === 'lose' ? -1 : 1;
  const requestedWeekly = Math.abs(delta) / weeks;
  let weekly = Math.min(requestedWeekly, maxWeekly);
  let adjusted = requestedWeekly > maxWeekly;
  if (adjusted) {
    warnings.push(
      `Reaching ${targetWeightKg} kg in ${weeks} weeks would mean ${requestedWeekly.toFixed(2)} kg/week, which is more than the ` +
        `${maxWeekly.toFixed(2)} kg/week we consider safe. The plan is stretched to the realistic pace.`,
    );
  }

  let dailyKcal = baseTdee + sign * weekly * (KCAL_PER_KG / 7);
  const floor = MIN_KCAL[profile.sex];
  if (goal === 'lose' && dailyKcal < floor) {
    dailyKcal = floor;
    weekly = Math.max(0, (baseTdee - floor) * 7 / KCAL_PER_KG);
    adjusted = true;
    warnings.push(`Intake is held at ${floor} kcal/day, the lowest we recommend without medical supervision.`);
  }
  if (weekly < 0.01) {
    return {
      ok: false,
      error: `Your maintenance intake (${Math.round(baseTdee)} kcal) is already at the safe minimum, so a calorie deficit is not advisable. Increase activity or speak to a doctor or dietitian.`,
    };
  }

  const effectiveWeeks = Math.ceil(Math.abs(delta) / weekly);
  dailyKcal = Math.round(dailyKcal);
  return {
    ok: true,
    plan: {
      ...input,
      bmr: baseBmr,
      tdee: baseTdee,
      dailyKcal,
      proteinG: proteinTarget(goal === 'lose' ? Math.min(profile.weightKg, targetWeightKg) : profile.weightKg, profile.activity, dailyKcal),
      weeklyChangeKg: sign * weekly,
      effectiveWeeks,
      adjusted,
      warnings,
    },
  };
}

/** Planned body weight `weeksIn` weeks after the start (linear glide path, then flat at target). */
export function expectedWeight(plan: Plan, weeksIn: number): number {
  const start = plan.profile.weightKg;
  if (plan.goal === 'maintain') return start;
  const progressed = start + plan.weeklyChangeKg * Math.max(0, weeksIn);
  return plan.goal === 'lose' ? Math.max(plan.targetWeightKg, progressed) : Math.min(plan.targetWeightKg, progressed);
}

// ---------------------------------------------------------------------------
// Steps → distance → calories
// ---------------------------------------------------------------------------

/** Stride length in metres estimated from height (standard 0.413/0.415 × height). */
export function strideMetres(p: Pick<Profile, 'heightCm' | 'sex'>): number {
  return (p.heightCm / 100) * (p.sex === 'male' ? 0.415 : 0.413);
}

export function stepsToKm(steps: number, p: Pick<Profile, 'heightCm' | 'sex'>): number {
  return (steps * strideMetres(p)) / 1000;
}

/**
 * Net energy cost of walking, above resting, ≈ 0.5 kcal per kg per km
 * (ACSM walking equation: 0.1 ml O₂/kg/m × ~5 kcal per litre of O₂).
 */
export const WALKING_KCAL_PER_KG_KM = 0.5;

export function stepsToKcal(steps: number, p: Pick<Profile, 'heightCm' | 'sex' | 'weightKg'>): number {
  return stepsToKm(steps, p) * p.weightKg * WALKING_KCAL_PER_KG_KM;
}

/** Resting energy burned so far today (BMR spread evenly across 24 h). */
export function restingKcalSoFar(p: Profile, dayFractionElapsed: number): number {
  return bmr(p) * Math.min(1, Math.max(0, dayFractionElapsed));
}
