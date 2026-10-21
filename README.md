# Thali Tally

A vegetarian Indian calorie, protein and step tracker. Everything is stored on the phone.

## What it does

- **Log food** four ways: search Indian dishes/ingredients, build a home recipe from raw ingredient weights,
  photograph the meal and pick the dish, or scan a packaged-food barcode. Quick add for anything else.
- **Steps and calories burned** read natively from the phone, or from connected health apps (see below).
- **Connected apps**: Apple Health, Health Connect (Android) and Strava, which together bring in smartwatches and fitness apps.
- **Regular foods**: tell the app what you actually eat or cook (built-in dishes or your own saved recipes) and which meals they are for; the sample day of meals is built from them.
- **Workout plan**: say which activities you like (strength, walking, running, cycling, swimming, yoga, interval circuits), how many days, how long, what equipment you have and your experience, and it builds a week with exercises, sets and reps, step targets and calorie estimates. Today's session shows on the Today screen.
- **Optional account** with cloud sync between your phone and the web (see *Cloud sync* below).
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
| Steps / energy / workouts (Android) | `react-native-health-connect` → Android Health Connect |
| Steps / energy / workouts (iOS) | `@kingstinct/react-native-healthkit` → Apple Health |
| Strava | Strava REST API over OAuth; tokens in `expo-secure-store` |
| Camera / barcode | `expo-image-picker`, `expo-camera` |
| Reminders | `expo-notifications` (local) |
| Chart | `react-native-svg` |
| Typeface | [Libron](https://github.com/nicoverbruggen/libron) (bundled, SIL OFL 1.1) |
| Account and sync (optional) | Supabase (Postgres + email sign-in) via `@supabase/supabase-js`; the phone's SQLite stays the source of truth |
| Web | `react-native-web`; SQLite runs in the browser via WebAssembly (`metro.config.js` registers `.wasm`) |
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

## Cloud sync (optional account)

Without an account the app is completely local. With one, your food log, weights, recipes, profile, diet plan, regular
foods and workout plan are mirrored to a server and kept in step across your phone and the web. Steps, workouts, calories
burned and connected-app sign-ins always stay on each device.

How it behaves: the phone's database is still the source of truth and works offline. Changes are uploaded a few seconds
after you make them, when the app returns to the foreground, and every five minutes. If two devices edit the same thing,
the later edit wins. Deletes reach other devices. If you sign in as a different account on a phone that already holds
someone else's data, the app asks before anything is replaced; nothing is merged silently.

**Setup (about ten minutes, free tier is plenty).** You need your own Supabase project, because the data is stored in
it:

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql` and run it. It creates the tables and the
   row-level-security policies that stop one person reading another's rows. Do not skip it. It is safe to run twice.
3. **Authentication › Providers**: email is on by default. Under **Authentication › URL Configuration** set the Site URL
   to your web address (for example `https://mkdogs25.github.io/thali-tally/`) so confirmation emails link back to it.
   You can switch email confirmation off under the email provider if you prefer.
4. **Project Settings › API**: copy the *Project URL* and the *anon / publishable* key. Both are public by design; the
   data is protected by the policies in step 2, not by hiding these.
5. In GitHub, **Settings › Secrets and variables › Actions › Variables**, add `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
   The next build of the web app and the Android and iPhone apps picks them up. For local development, put
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

If those variables are missing the build is simply local-only and the Account card says so.

What is and isn't tested: the sync logic is tested with two simulated phones, and the full sign-up, sign-in and sync flow
runs end to end in a browser against a stand-in for Supabase's API. It has **not** been run against a real Supabase
project, so expect to check the first real sign-in yourself.

## Connected apps (watches, Apple Health, Google/Android, Strava)

Open **Settings → Connected apps**. Everything is read-only and stays on the phone.

| Connect | What it brings in |
| --- | --- |
| **Apple Health** (iPhone) | Steps, active energy, workouts, weight. Apple Watch, Garmin Connect, Fitbit, Oura, WHOOP, Withings, Polar and Strava can all write into it. |
| **Health Connect** (Android) | Steps, active calories, exercise sessions, distance, weight. Samsung Health, Garmin Connect, Fitbit, Mi Fitness, Oura, Withings, Polar, Zepp and Wear OS watches write into it. Google Fit's API is being retired in favour of it. |
| **Strava** | Your activities with the calories Strava worked out. |

**Smartwatches** are reached through their own apps: turn on "sync to Health Connect" / "sync to Apple Health" in the
watch's app once. There is no per-brand integration to maintain, and workouts that arrive from both a hub and Strava
are matched by time and counted once. Fitbit's own cloud API was retired in September 2026, so Fitbit data comes in
through those hubs.

**Strava setup** (needs your own free API app, because Strava's token exchange requires a client secret and this
app has no server): create an application at <https://www.strava.com/settings/api>, set *Authorization Callback Domain* to
`localhost`, then paste the Client ID and Client Secret into the app. They are kept in Keychain / Keystore. A new Strava
API app serves one athlete (you), which is all this needs.

**How energy is worked out**: if a hub reports active energy, that figure (it already covers walking and every workout
the hub knows about) is used, and only workouts from outside the hub are added on top. Otherwise it is steps × stride ×
weight plus workout energy, with the walking already in the step count taken back off so a run is not counted twice.

Needs the development build: Apple Health and Health Connect are native modules that Expo Go cannot load. Expo Go still
runs the app and reads the phone's own step sensor.

## Web app (GitHub Pages)

The web version is published at **https://mkdogs25.github.io/thali-tally/** and redeploys on every push to the
default branch (`.github/workflows/pages.yml`, about a minute, independent of the native builds).

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Until that is switched on the
deploy job fails with a "Pages is not enabled" style error; after enabling it, re-run the workflow.

Notes:
- It is a static single-page app served from the `/thali-tally/` sub-path, so the build sets `EXPO_BASE_URL`
  (see `app.config.js`) and copies `index.html` to `404.html`. Pages answers unknown paths such as `/thali-tally/settings`
  with `404.html`, which is what makes refreshes and shared deep links work. The browser console shows a 404 on those
  loads; that is expected.
- Data lives in the browser's own storage (SQLite compiled to WebAssembly), so it stays on each device and browser
  and is lost if site data is cleared, unless you sign in to an account to sync it.
- Steps, Apple Health, Health Connect and Strava are phone-app features and are not available on the web.
- The downloadable web release zip is the same app built for a site root instead.

## Releases (GitHub Actions)

Every push runs `.github/workflows/release.yml`: typecheck and tests first, then three builds in parallel, each
published as its **own GitHub Release** (tagged `<platform>-v<version>-build.<run number>`). Branches other than the
default branch are marked pre-release. The run number is stamped in as the Android `versionCode` / iOS build number,
so each build installs over the last one.

| Release | File | Notes |
| --- | --- | --- |
| Android | `…-android.apk` | Signed with the debug key: installs on your own phones, not uploadable to the Play Store. Includes Health Connect, so steps count all day. |
| iPhone | `…-ios-unsigned.ipa` | **Unsigned.** An installable iPhone app needs an Apple Developer account. Re-sign it with Sideloadly or AltStore using a free Apple ID (expires after 7 days), or add signing credentials to the workflow for TestFlight. |
| Web | `…-web.zip` | Static site built for a site root; unzip and host anywhere. A live copy is on GitHub Pages (above). No step counting on the web. |

The iOS job runs on a macOS runner, which GitHub bills at a higher rate on private repositories. To change the
version number, edit `version` in `package.json`.

## How accurate are the numbers?

- **Steps**: Apple Health and Health Connect values come from the operating system, not from this app. On Android,
  Health Connect only has steps if some app records them (Google Fit / Fitbit / Samsung Health / the phone's own recorder).
  Until you connect one, iPhone uses its own motion sensor and Android counts only while the app is open.
- **Calories burned** are estimates. Walking = steps × stride (0.415 × height for men, 0.413 for women) × weight ×
  0.5 kcal/kg/km. Resting burn = Mifflin-St Jeor BMR. Gym workouts are not counted.
- **Food values** are per 100 g raw, transcribed from ICMR-NIN IFCT 2017 / NIN tables. Dishes are computed from
  raw ingredient weights. The unit tests check every ingredient's calories against its protein/carbs/fat, which
  catches typos, but the table should still be spot-checked against the printed IFCT before relying on it medically.
- **Protein targets** are 0.8 to 1.0 g per kg of body weight, scaled by activity (0.8 sedentary or light, 0.9 moderate, 1.0 very
  active), and for weight loss are worked out on your target weight. That is deliberately at the modest end. If you lift
  seriously, or are losing weight and want to protect muscle, a dietitian may suggest more.
- **Workout plans** are rule-based templates, not a coach: exercises are chosen by your equipment, experience and time, and
  calories use standard MET tables (energy above resting = (MET − 1) × kg × hours).
- **Photos** cannot give reliable calories on their own; the app asks you to confirm dish and portion.
  There is no bundled recognition model yet — see `src/lib/classifier.ts` for the plug-in point.

## Credits

The typeface is **Libron** by Nico Verbruggen, from <https://github.com/nicoverbruggen/libron> (v0.31; itself based on
Newsreader from Production Type). It is licensed under the SIL Open Font License 1.1 and bundled unmodified; the licence and
copyright notice are in `assets/fonts/`.

Not medical advice.
