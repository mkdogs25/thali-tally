import type { Goal } from './plan';

/** What the person has to hand: nothing, light kit (dumbbells, bands, a backpack) or a full gym. */
export type Equipment = 'none' | 'light' | 'gym';
export type Experience = 'beginner' | 'intermediate';
export type ActivityPref = 'strength' | 'walk' | 'run' | 'cycle' | 'swim' | 'yoga' | 'hiit';

export const ACTIVITY_LABEL: Record<ActivityPref, string> = {
  strength: 'Strength training',
  walk: 'Brisk walking',
  run: 'Running',
  cycle: 'Cycling',
  swim: 'Swimming',
  yoga: 'Yoga & mobility',
  hiit: 'Interval circuits',
};

export interface WorkoutPrefs {
  /** Training days per week, 2-6. */
  days: number;
  /** Time available per session. */
  minutes: 20 | 30 | 45 | 60;
  equipment: Equipment;
  experience: Experience;
  activities: ActivityPref[];
  /** Avoid running, jumping and other high-impact work (sore knees, heavier bodies, joint problems). */
  lowImpact: boolean;
}

export interface Exercise {
  name: string;
  sets?: number;
  /** e.g. "10-12" */
  reps?: string;
  /** For timed work such as planks, or the length of one interval. */
  seconds?: number;
  note?: string;
}

export type SessionKind = ActivityPref | 'rest';

export interface Session {
  /** 0 = Monday ... 6 = Sunday. */
  day: number;
  kind: SessionKind;
  title: string;
  minutes: number;
  /** Estimated energy above resting, in kcal. */
  kcal: number;
  /** Walking target for the session, where it applies. */
  steps?: number;
  exercises: Exercise[];
  note?: string;
}

export interface WorkoutPlan {
  createdAt: number;
  prefs: WorkoutPrefs;
  goal: Goal;
  /** Body weight the calorie estimates were worked out for. */
  weightKg: number;
  /** Always seven sessions, Monday to Sunday, rest days included. */
  sessions: Session[];
  tips: string[];
  weeklyMinutes: number;
  weeklyKcal: number;
}

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Monday = 0 ... Sunday = 6 for a JavaScript date. */
export const weekdayIndex = (d: Date = new Date()) => (d.getDay() + 6) % 7;

// ---------------------------------------------------------------------------
// Energy
// ---------------------------------------------------------------------------

/** Compendium-of-Physical-Activities style MET values for each kind of session. */
export const MET: Record<SessionKind, number> = {
  strength: 4.0, // resistance training with rests between sets
  walk: 4.3, // brisk, about 5.5 km/h
  run: 8.3, // about 8 km/h
  cycle: 6.8, // moderate effort
  swim: 5.8, // easy to moderate laps
  yoga: 2.8,
  hiit: 7.0, // intervals with built-in rests
  rest: 1,
};

/** Calories above resting (resting burn is counted separately in the app): (MET - 1) x kg x hours. */
export function sessionKcal(kind: SessionKind, minutes: number, weightKg: number, met: number = MET[kind]): number {
  return Math.round(Math.max(0, met - 1) * weightKg * (minutes / 60));
}

const STEPS_PER_MINUTE_BRISK = 110;

// ---------------------------------------------------------------------------
// Strength exercises
// ---------------------------------------------------------------------------

type Pattern = 'squat' | 'hinge' | 'lunge' | 'push' | 'pull' | 'press' | 'calf' | 'arms' | 'plank' | 'deadbug' | 'sideplank' | 'birddog';

interface Move {
  name: string;
  note?: string;
}

const LIBRARY: Record<Pattern, Record<Equipment, { beginner: Move; intermediate: Move }>> = {
  squat: {
    none: { beginner: { name: 'Bodyweight squat', note: 'Sit back to a chair if you need a target' }, intermediate: { name: 'Slow-tempo squat', note: '3 seconds down, pause, stand' } },
    light: { beginner: { name: 'Goblet squat', note: 'Hold one dumbbell at the chest' }, intermediate: { name: 'Goblet squat', note: 'Use the heaviest weight you can control' } },
    gym: { beginner: { name: 'Leg press' }, intermediate: { name: 'Barbell back squat' } },
  },
  hinge: {
    none: { beginner: { name: 'Glute bridge' }, intermediate: { name: 'Single-leg glute bridge' } },
    light: { beginner: { name: 'Dumbbell Romanian deadlift', note: 'Soft knees, push hips back' }, intermediate: { name: 'Dumbbell Romanian deadlift', note: 'Slow lowering' } },
    gym: { beginner: { name: 'Back extension or hip hinge with dumbbells' }, intermediate: { name: 'Romanian deadlift (barbell)' } },
  },
  lunge: {
    none: { beginner: { name: 'Reverse lunge', note: 'Hold a wall or chair for balance if needed' }, intermediate: { name: 'Bulgarian split squat', note: 'Back foot on a sofa or step' } },
    light: { beginner: { name: 'Dumbbell reverse lunge' }, intermediate: { name: 'Dumbbell split squat' } },
    gym: { beginner: { name: 'Leg curl machine' }, intermediate: { name: 'Walking lunge with dumbbells' } },
  },
  push: {
    none: { beginner: { name: 'Incline or knee push-up', note: 'Hands on a table or sofa to make it easier' }, intermediate: { name: 'Push-up' } },
    light: { beginner: { name: 'Dumbbell floor press' }, intermediate: { name: 'Dumbbell bench press' } },
    gym: { beginner: { name: 'Chest press machine' }, intermediate: { name: 'Bench press' } },
  },
  pull: {
    none: { beginner: { name: 'Backpack bent-over row', note: 'Pack with books for weight' }, intermediate: { name: 'Table row', note: 'Lie under a sturdy table and pull up' } },
    light: { beginner: { name: 'One-arm dumbbell row' }, intermediate: { name: 'One-arm dumbbell row', note: 'Pause at the top' } },
    gym: { beginner: { name: 'Lat pulldown' }, intermediate: { name: 'Seated cable row' } },
  },
  press: {
    none: { beginner: { name: 'Pike push-up from knees' }, intermediate: { name: 'Pike push-up' } },
    light: { beginner: { name: 'Seated dumbbell shoulder press' }, intermediate: { name: 'Standing dumbbell shoulder press' } },
    gym: { beginner: { name: 'Shoulder press machine' }, intermediate: { name: 'Overhead press' } },
  },
  calf: {
    none: { beginner: { name: 'Calf raise' }, intermediate: { name: 'Single-leg calf raise' } },
    light: { beginner: { name: 'Dumbbell calf raise' }, intermediate: { name: 'Single-leg calf raise with dumbbell' } },
    gym: { beginner: { name: 'Seated calf raise' }, intermediate: { name: 'Standing calf raise' } },
  },
  arms: {
    none: { beginner: { name: 'Chair dips', note: 'Keep the elbows pointing back' }, intermediate: { name: 'Diamond push-up from knees' } },
    light: { beginner: { name: 'Dumbbell biceps curl' }, intermediate: { name: 'Curl to press' } },
    gym: { beginner: { name: 'Cable triceps pushdown' }, intermediate: { name: 'Cable triceps pushdown' } },
  },
  plank: { none: { beginner: { name: 'Plank' }, intermediate: { name: 'Plank' } }, light: { beginner: { name: 'Plank' }, intermediate: { name: 'Plank' } }, gym: { beginner: { name: 'Plank' }, intermediate: { name: 'Plank' } } },
  deadbug: { none: { beginner: { name: 'Dead bug' }, intermediate: { name: 'Dead bug' } }, light: { beginner: { name: 'Dead bug' }, intermediate: { name: 'Dead bug' } }, gym: { beginner: { name: 'Dead bug' }, intermediate: { name: 'Dead bug' } } },
  sideplank: { none: { beginner: { name: 'Side plank from knees' }, intermediate: { name: 'Side plank' } }, light: { beginner: { name: 'Side plank from knees' }, intermediate: { name: 'Side plank' } }, gym: { beginner: { name: 'Side plank from knees' }, intermediate: { name: 'Side plank' } } },
  birddog: { none: { beginner: { name: 'Bird dog' }, intermediate: { name: 'Bird dog' } }, light: { beginner: { name: 'Bird dog' }, intermediate: { name: 'Bird dog' } }, gym: { beginner: { name: 'Bird dog' }, intermediate: { name: 'Bird dog' } } },
};

const TIMED: ReadonlySet<Pattern> = new Set(['plank', 'deadbug', 'sideplank', 'birddog']);

/** The order matters: the first exercises are kept when the session is short. */
const TEMPLATES: Record<string, { title: string; focus: string; patterns: Pattern[] }> = {
  'full-a': { title: 'Full body A', focus: 'Legs, chest, back, core', patterns: ['squat', 'push', 'pull', 'hinge', 'plank', 'calf'] },
  'full-b': { title: 'Full body B', focus: 'Hips, shoulders, back, core', patterns: ['hinge', 'press', 'pull', 'lunge', 'deadbug', 'arms'] },
  'full-c': { title: 'Full body C', focus: 'Legs, chest, back, core', patterns: ['lunge', 'push', 'pull', 'squat', 'sideplank', 'arms'] },
  'upper-a': { title: 'Upper body A', focus: 'Chest, back, shoulders', patterns: ['push', 'pull', 'press', 'arms', 'plank', 'birddog'] },
  'lower-a': { title: 'Lower body A', focus: 'Quads, hips, calves', patterns: ['squat', 'hinge', 'lunge', 'calf', 'plank', 'deadbug'] },
  'upper-b': { title: 'Upper body B', focus: 'Shoulders, back, chest', patterns: ['press', 'pull', 'push', 'arms', 'birddog', 'sideplank'] },
  'lower-b': { title: 'Lower body B', focus: 'Hips, hamstrings, calves', patterns: ['hinge', 'lunge', 'squat', 'calf', 'sideplank', 'deadbug'] },
};

const SPLITS: Record<number, string[]> = {
  1: ['full-a'],
  2: ['full-a', 'full-b'],
  3: ['full-a', 'full-b', 'full-c'],
  4: ['upper-a', 'lower-a', 'upper-b', 'lower-b'],
};

const EXERCISES_FOR_MINUTES: Record<WorkoutPrefs['minutes'], number> = { 20: 3, 30: 4, 45: 5, 60: 6 };

export function strengthSession(templateKey: string, prefs: WorkoutPrefs, goal: Goal): Pick<Session, 'title' | 'exercises' | 'note'> {
  const t = TEMPLATES[templateKey];
  const count = EXERCISES_FOR_MINUTES[prefs.minutes];
  const beginner = prefs.experience === 'beginner';
  const sets = beginner ? (prefs.minutes <= 30 ? 2 : 3) : prefs.minutes <= 30 ? 3 : 4;
  const reps = goal === 'gain' && !beginner ? '8-10' : beginner ? '10-12' : '8-12';
  const exercises: Exercise[] = t.patterns.slice(0, count).map((p) => {
    const move = LIBRARY[p][prefs.equipment][prefs.experience];
    return TIMED.has(p)
      ? { name: move.name, sets: beginner ? 2 : 3, seconds: beginner ? 20 : 40, note: move.note }
      : { name: move.name, sets, reps, note: move.note };
  });
  return {
    title: t.title,
    exercises,
    note: `${t.focus}. Rest 60-90 seconds between sets. Stop each set with 1-2 reps still in reserve.`,
  };
}

// ---------------------------------------------------------------------------
// Cardio, yoga and intervals
// ---------------------------------------------------------------------------

const YOGA_POSES: Exercise[] = [
  { name: 'Surya Namaskar (sun salutation)', reps: '4-6 rounds', note: 'Move with the breath, one breath per movement' },
  { name: 'Tadasana to Uttanasana', seconds: 45, note: 'Mountain pose, then a relaxed forward fold' },
  { name: 'Trikonasana (triangle pose)', seconds: 40, note: 'Each side' },
  { name: 'Virabhadrasana II (warrior II)', seconds: 40, note: 'Each side' },
  { name: 'Bhujangasana (cobra)', seconds: 30 },
  { name: 'Marjaryasana-Bitilasana (cat-cow)', seconds: 60 },
  { name: 'Balasana (child’s pose)', seconds: 60 },
  { name: 'Setu Bandhasana (bridge pose)', seconds: 40 },
  { name: 'Supta Matsyendrasana (supine twist)', seconds: 40, note: 'Each side' },
  { name: 'Shavasana (final rest)', seconds: 180 },
];

function yogaExercises(minutes: number): Exercise[] {
  // Always open with sun salutations and finish with rest; fit the middle to the time available.
  const middle = YOGA_POSES.slice(1, -1);
  const room = Math.max(2, Math.round((minutes - 8) / 3));
  return [YOGA_POSES[0], ...middle.slice(0, room), YOGA_POSES[YOGA_POSES.length - 1]];
}

function intervalExercises(prefs: WorkoutPrefs): { exercises: Exercise[]; note: string } {
  const beginner = prefs.experience === 'beginner';
  const on = beginner ? 20 : 30;
  const off = beginner ? 40 : 30;
  const moves = prefs.lowImpact
    ? ['Fast march on the spot', 'Squat with reach', 'Step-back lunges', 'Standing knee drives', 'Shadow boxing', 'Step jacks (no jumping)']
    : ['Jumping jacks', 'High knees', 'Squat to stand', 'Mountain climbers', 'Skater hops', 'Burpees (step back instead of jumping if needed)'];
  const rounds = Math.max(2, Math.floor((prefs.minutes - 8) / (((on + off) * moves.length) / 60)));
  return {
    exercises: moves.map((name) => ({ name, seconds: on, note: `${on}s hard, ${off}s rest` })),
    note: `${rounds} round${rounds === 1 ? '' : 's'} through the list. Warm up 4 minutes first.`,
  };
}

function cardioSession(kind: Exclude<ActivityPref, 'strength'>, prefs: WorkoutPrefs): Omit<Session, 'day' | 'kcal'> & { met?: number } {
  const beginner = prefs.experience === 'beginner';
  const minutes = prefs.minutes;
  switch (kind) {
    case 'walk':
      return {
        kind,
        title: 'Brisk walk',
        minutes,
        steps: minutes * STEPS_PER_MINUTE_BRISK,
        exercises: [
          { name: 'Brisk walk', seconds: minutes * 60, note: 'A pace where you can talk but not sing' },
          ...(beginner ? [] : [{ name: 'Faster bursts', reps: '5 x 1 minute', note: 'Walk as fast as you can, then ease off for 2 minutes' }]),
        ],
      };
    case 'run':
      if (prefs.lowImpact) {
        return { ...cardioSession('walk', prefs), kind: 'walk', title: 'Incline or hill walk (low impact)', note: 'Running is swapped for a low-impact walk. Use an incline or hills to lift the effort.' };
      }
      return beginner
        ? {
            kind,
            title: 'Run-walk intervals',
            minutes,
            exercises: [
              { name: 'Warm-up walk', seconds: 300 },
              { name: 'Jog 1 minute, walk 2 minutes', reps: `${Math.max(3, Math.floor((minutes - 10) / 3))} rounds`, note: 'Jog slowly enough to hold a conversation' },
              { name: 'Cool-down walk', seconds: 300 },
            ],
            met: 6.0,
          }
        : {
            kind,
            title: 'Easy run',
            minutes,
            exercises: [
              { name: 'Warm-up walk or jog', seconds: 300 },
              { name: 'Steady easy run', seconds: Math.max(10, minutes - 10) * 60, note: 'Conversational pace' },
              { name: 'Cool-down walk', seconds: 300 },
            ],
          };
    case 'cycle':
      return {
        kind,
        title: 'Steady ride',
        minutes,
        exercises: [{ name: 'Steady ride', seconds: minutes * 60, note: 'Moderate effort, able to talk in short sentences. Stationary bike is fine.' }],
      };
    case 'swim':
      return {
        kind,
        title: 'Easy swim',
        minutes,
        exercises: [{ name: 'Laps at an easy pace', reps: `${Math.max(4, Math.round(minutes / 4))} x 2 lengths`, note: 'Rest 30 seconds between sets; any stroke that feels comfortable' }],
        met: beginner ? 4.8 : 5.8,
      };
    case 'yoga':
      return { kind, title: 'Yoga and mobility', minutes, exercises: yogaExercises(minutes), note: 'Never force a stretch; breathe slowly and stay within comfort.' };
    case 'hiit': {
      const { exercises, note } = intervalExercises(prefs);
      return { kind, title: prefs.lowImpact ? 'Low-impact interval circuit' : 'Interval circuit', minutes, exercises, note, met: prefs.lowImpact ? 5.0 : 7.0 };
    }
  }
}

// ---------------------------------------------------------------------------
// The weekly plan
// ---------------------------------------------------------------------------

const TRAINING_DAYS: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 3, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

/** Strength first, then the others, alternating where there are enough of each so hard days are spread out. */
export function interleave(strength: number, other: number): ('S' | 'O')[] {
  const out: ('S' | 'O')[] = [];
  let s = strength;
  let o = other;
  while (s > 0 || o > 0) {
    if (s > 0) {
      out.push('S');
      s--;
    }
    if (o > 0) {
      out.push('O');
      o--;
    }
  }
  return out;
}

export function clampPrefs(p: WorkoutPrefs): WorkoutPrefs {
  const days = Math.min(6, Math.max(2, Math.round(p.days)));
  const activities = p.activities.length > 0 ? [...new Set(p.activities)] : (['strength', 'walk'] as ActivityPref[]);
  return { ...p, days, activities };
}

export function buildWorkoutPlan(input: { prefs: WorkoutPrefs; goal: Goal; weightKg: number; now?: number }): WorkoutPlan {
  const prefs = clampPrefs(input.prefs);
  const { goal, weightKg } = input;
  const wantsStrength = prefs.activities.includes('strength');
  const others = prefs.activities.filter((a): a is Exclude<ActivityPref, 'strength'> => a !== 'strength');

  // How many of the training days are strength.
  let strengthDays = 0;
  if (wantsStrength) {
    strengthDays = others.length === 0 ? Math.min(prefs.days, 4) : Math.min(4, Math.max(1, Math.round(prefs.days * 0.6)));
    if (goal === 'gain' && others.length > 0) strengthDays = Math.min(4, prefs.days - 1, strengthDays + 1);
    if (prefs.days === 2) strengthDays = others.length === 0 ? 2 : 1;
  }
  const otherDays = prefs.days - strengthDays;
  // Extra days beyond four strength sessions: easy walking (or yoga if they asked for it).
  const fillers: Exclude<ActivityPref, 'strength'>[] = others.length > 0 ? others : [prefs.activities.includes('yoga') ? 'yoga' : 'walk'];

  const order = interleave(strengthDays, otherDays);
  const split = SPLITS[Math.max(1, strengthDays)] ?? SPLITS[4];
  let strengthIndex = 0;
  let otherIndex = 0;
  const slots = TRAINING_DAYS[prefs.days];

  const sessions: Session[] = Array.from({ length: 7 }, (_, day) => ({
    day,
    kind: 'rest' as SessionKind,
    title: 'Rest day',
    minutes: 0,
    kcal: 0,
    exercises: [],
    note: 'Recover. A relaxed walk or 10 minutes of stretching is welcome but optional.',
  }));

  order.forEach((type, i) => {
    const day = slots[i];
    if (type === 'S') {
      const s = strengthSession(split[strengthIndex++ % split.length], prefs, goal);
      sessions[day] = { day, kind: 'strength', title: s.title, minutes: prefs.minutes, kcal: sessionKcal('strength', prefs.minutes, weightKg), exercises: s.exercises, note: s.note };
    } else {
      const kind = fillers[otherIndex++ % fillers.length];
      const c = cardioSession(kind, prefs);
      sessions[day] = { day, kind: c.kind, title: c.title, minutes: c.minutes, kcal: sessionKcal(c.kind, c.minutes, weightKg, c.met), steps: c.steps, exercises: c.exercises, note: c.note };
    }
  });

  const weeklyMinutes = sessions.reduce((s, x) => s + x.minutes, 0);
  const weeklyKcal = sessions.reduce((s, x) => s + x.kcal, 0);
  return { createdAt: input.now ?? Date.now(), prefs, goal, weightKg, sessions, tips: tipsFor(goal, prefs), weeklyMinutes, weeklyKcal };
}

function tipsFor(goal: Goal, prefs: WorkoutPrefs): string[] {
  const tips = [
    'Warm up for 5 minutes (easy walking, shoulder and hip circles) before each session and cool down afterwards.',
    prefs.experience === 'beginner'
      ? 'Start lighter than you think you need. Add 1-2 reps each week; when every set reaches the top of the range, add weight or pick a harder variation.'
      : 'Progress each week: add a rep, add weight, or slow the lowering phase. Every fourth week, drop the volume by about a third to recover.',
  ];
  if (goal === 'lose') {
    tips.push('Strength work while eating less helps you keep muscle, so most of the loss comes from fat. Keep your daily steps up on rest days too.');
  } else if (goal === 'gain') {
    tips.push('Gaining weight well needs enough food around training. Hit your calorie target and aim for slow, steady increases in the weights you lift.');
  } else {
    tips.push('Consistency matters more than intensity. Two good weeks in a row beat one heroic one.');
  }
  if (prefs.lowImpact) tips.push('Impact is kept low: no running or jumping. If a movement hurts a joint, swap it for an easier version or skip it.');
  tips.push('Stop if you feel sharp pain, dizziness or chest discomfort. This is general guidance, not medical advice; check with a doctor first if you have a health condition, are pregnant, or have been inactive for a long time.');
  return tips;
}

/** Today's session from a saved plan. */
export function sessionFor(plan: WorkoutPlan, date: Date = new Date()): Session {
  return plan.sessions[weekdayIndex(date)];
}
