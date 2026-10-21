export type SourceId = 'apple-health' | 'health-connect' | 'strava';

/** Broad activity categories, enough to explain a workout and to avoid double-counting walking. */
export type ActivityKind = 'walk' | 'run' | 'hike' | 'cycle' | 'swim' | 'strength' | 'yoga' | 'cardio' | 'other';

export interface Workout {
  /** Stable across syncs: `<source>:<id from that source>`. */
  id: string;
  source: SourceId;
  /** The app or watch that recorded it, e.g. "Garmin Connect", "Apple Watch", "Strava". */
  app: string;
  kind: ActivityKind;
  name: string;
  startMs: number;
  endMs: number;
  kcal: number | null;
  distanceM: number | null;
}

export interface SourceDay {
  /** Total steps for the day as the source reports them, or null if it has none. */
  steps: number | null;
  /** Active (above-resting) energy for the day, or null if the source does not provide it. */
  activeKcal: number | null;
  workouts: Workout[];
}

export interface WeightSample {
  date: string;
  kg: number;
}

export type Availability = { ok: true } | { ok: false; reason: string };

export interface HealthSource {
  id: SourceId;
  label: string;
  /** True for the phone's own health hub (Apple Health / Health Connect): it already merges watches and apps. */
  hub: boolean;
  available(): Promise<Availability>;
  /** Ask for permission / sign in. Resolves with a human-readable error, or null on success. */
  connect(): Promise<string | null>;
  disconnect(): Promise<void>;
  /** Reads the given local day keys (YYYY-MM-DD). Days with nothing to report may be omitted. */
  readDays(days: string[]): Promise<Record<string, SourceDay>>;
  readWeights(fromDay: string, toDay: string): Promise<WeightSample[]>;
}
