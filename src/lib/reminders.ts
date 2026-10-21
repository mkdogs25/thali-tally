import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Reminders } from './db';

const MEAL_TIMES = [
  { id: 'meal-breakfast', hour: 9, minute: 0, body: 'Log your breakfast.' },
  { id: 'meal-lunch', hour: 13, minute: 30, body: 'Log your lunch.' },
  { id: 'meal-dinner', hour: 20, minute: 30, body: 'Log your dinner.' },
];
const WEIGH_IN_ID = 'weigh-in';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Replaces all scheduled reminders with the ones the user has switched on. Returns false if permission was refused. */
export async function applyReminders(r: Reminders): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!r.meals && !r.weighIn) return true;
  if (!(await ensurePermission())) return false;

  if (r.meals) {
    for (const m of MEAL_TIMES) {
      await Notifications.scheduleNotificationAsync({
        identifier: m.id,
        content: { title: 'Thali Tally', body: m.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: m.hour, minute: m.minute, channelId: 'reminders' },
      });
    }
  }
  if (r.weighIn) {
    await Notifications.scheduleNotificationAsync({
      identifier: WEIGH_IN_ID,
      content: { title: 'Thali Tally', body: 'Weekly weigh-in: step on the scale and log your weight.' },
      // weekday 2 = Monday (1 = Sunday)
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour: 8, minute: 0, channelId: 'reminders' },
    });
  }
  return true;
}
