import { Alert, Platform } from 'react-native';

/**
 * React Native's Alert does nothing on the web, which silently broke every confirmation and message there.
 * These use the browser's own dialogs on the web and the native alert on phones.
 */

/** Shows a message. */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** Asks before doing something; runs `onConfirm` only if the person agrees. */
export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}): void {
  if (Platform.OS === 'web') {
    if (window.confirm(opts.message ? `${opts.title}\n\n${opts.message}` : opts.title)) void opts.onConfirm();
    return;
  }
  Alert.alert(opts.title, opts.message, [
    { text: 'Cancel', style: 'cancel' },
    { text: opts.confirmLabel, style: opts.destructive ? 'destructive' : 'default', onPress: () => void opts.onConfirm() },
  ]);
}
