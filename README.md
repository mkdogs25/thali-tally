# Thali Tally

A vegetarian Indian calorie, protein and step tracker. Everything is stored on the phone.

## What it does

- **Log food** four ways: search Indian dishes/ingredients, build a home recipe from raw ingredient weights,
  photograph the meal and pick the dish, or scan a packaged-food barcode. Quick add for anything else.
- **Steps and calories burned** read natively from the phone (details below).
- **Diet plan**: enter age, height, weight, activity, a goal (lose / maintain / gain), target weight and a
  time period. The app works out daily calories and protein, caps the pace at a safe rate (≤1 % of body
  weight or 1 kg per week for loss, 0.5 kg for gain, never below 1200 kcal women / 1500 kcal men) and tells
  you when your timeframe is too aggressive. It also suggests a day of vegetarian Indian meals.
- **Progress**: weight chart against your plan, 7-day calories and steps.
- **Reminders**: meal logging and weekly weigh-in (local notifications).

## Tech stack

| Concern | Choice |
| --- | --- |
| App | Expo (React Native) + TypeScript, Expo Router for navigation |
| Local storage | `expo-sqlite` (one on-device SQLite file; no server, no account) |
| Steps (iOS) | `expo-sensors` Pedometer → Apple Core Motion |
| Steps (Android) | `react-native-health-connect` → Android Health Connect |
| Camera / barcode | `expo-image-picker`, `expo-camera` |
| Reminders | `expo-notifications` (local) |
| Chart | `react-native-svg` |
| Food data | Bundled in `src/lib/foods.ts` (no network needed) |

## Run it

```bash
npm install
npm test            # unit tests for the nutrition / plan / step maths
npm run typecheck
```

**iPhone**: `npx expo start`, open in Expo Go. Steps, camera, barcode and reminders all work in Expo Go.

**Android**: all-day step counting needs Health Connect, which Expo Go cannot load. Build the development app once:

```bash
npx expo run:android                              # with Android Studio / SDK installed
# or, without a local SDK:
npx eas-cli build --profile development --platform android
```

then `npx expo start --dev-client`. In Expo Go the app still works on Android but counts steps **only while it is open**
and says so on screen.

## How accurate are the numbers?

- **Steps**: iOS and Android Health Connect values come from the operating system, not from this app. On Android,
  Health Connect only has steps if some app records them (Google Fit / Fitbit / Samsung Health / the phone's own recorder).
- **Calories burned** are estimates. Walking = steps × stride (0.415 × height for men, 0.413 for women) × weight ×
  0.5 kcal/kg/km. Resting burn = Mifflin-St Jeor BMR. Gym workouts are not counted.
- **Food values** are per 100 g raw, transcribed from ICMR-NIN IFCT 2017 / NIN tables. Dishes are computed from
  raw ingredient weights. The unit tests check every ingredient's calories against its protein/carbs/fat, which
  catches typos, but the table should still be spot-checked against the printed IFCT before relying on it medically.
- **Photos** cannot give reliable calories on their own; the app asks you to confirm dish and portion.
  There is no bundled recognition model yet — see `src/lib/classifier.ts` for the plug-in point.

Not medical advice.
