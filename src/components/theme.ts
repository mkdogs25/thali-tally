import { Platform } from 'react-native';

/** Warm paper: beige page, off-white cards, terracotta accent and brown ink. */
export const colors = {
  bg: '#F5EEE1',
  card: '#FDFAF3',
  /** Slightly tinted surface for secondary buttons, chips and notes. */
  soft: '#F1E3D2',
  inputBg: '#FFFDF8',
  text: '#34261B',
  muted: '#7A6753',
  line: '#E4D3BF',
  track: '#EBDCC8',
  accent: '#A8442F',
  accentDark: '#7C2F20',
  onAccent: '#FDF8EE',
  green: '#5F7F4A',
  /** Warnings and "over target": a cooler, stronger red than the accent so the two stay distinguishable. */
  red: '#B3261E',
  protein: '#8A5F73',
  steps: '#4F7B8A',
};

/**
 * Libron (SIL Open Font License 1.1, by Nico Verbruggen, bundled unmodified from its v0.31 release).
 * The two names are what `useFonts` registers in the root layout. Weights are separate files, so bold is chosen
 * by family rather than by `fontWeight` (which custom fonts handle inconsistently across platforms).
 */
export const FONT = {
  regular: Platform.select({ web: '"Libron-Regular", Georgia, serif', default: 'Libron-Regular' }) as string,
  bold: Platform.select({ web: '"Libron-Bold", Georgia, serif', default: 'Libron-Bold' }) as string,
};

export const FONT_FILES = {
  'Libron-Regular': require('../../assets/fonts/Libron-Regular.ttf'),
  'Libron-Bold': require('../../assets/fonts/Libron-Bold.ttf'),
};

export const MEAL_ICON: Record<string, string> = { breakfast: '🌅', lunch: '🍛', snack: '🥜', dinner: '🌙' };
