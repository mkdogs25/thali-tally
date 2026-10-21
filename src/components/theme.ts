import { Platform } from 'react-native';

/** Warm paper: beige page, off-white cards, brown accents and ink. */
export const colors = {
  bg: '#F5EEE1',
  card: '#FDFAF3',
  /** Slightly tinted surface for secondary buttons, chips and notes. */
  soft: '#EFE3CF',
  inputBg: '#FFFDF8',
  text: '#34261B',
  muted: '#7A6753',
  line: '#E0D2BD',
  track: '#E8DCC7',
  accent: '#8B5E3C',
  accentDark: '#5E3D24',
  onAccent: '#FDF8EE',
  green: '#5F7F4A',
  red: '#A94438',
  protein: '#8A5F73',
  steps: '#4F7B8A',
};

/**
 * Serif stack. Palatino rather than Georgia: it has lining numerals, so calorie and step counts sit on the
 * baseline instead of dipping below it. Android's own serif already does.
 */
export const SERIF = Platform.select({
  ios: 'Palatino',
  android: 'serif',
  default: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
}) as string;

export const MEAL_ICON: Record<string, string> = { breakfast: '🌅', lunch: '🍛', snack: '🥜', dinner: '🌙' };
