/**
 * Where the person's data is kept. Signing in is always optional; this records which they chose and works out
 * what the app should say about how safe the data is.
 *
 *  - 'local': only on this device.
 *  - 'cloud': mirrored to the person's account (needs sign-in to take effect).
 */
export type StorageMode = 'local' | 'cloud';

export interface StorageState {
  /** What the person chose, or null if they have not chosen yet. */
  mode: StorageMode | null;
  /** Whether this build has a sync server at all. */
  configured: boolean;
  signedIn: boolean;
}

/** How safe the data actually is right now. */
export type Protection =
  /** Mirrored to the account. */
  | 'synced'
  /** Only on this device, by choice. */
  | 'local-only'
  /** Chose a cloud account but has not signed in, so only on this device for now. */
  | 'cloud-pending'
  /** Only on this device because this build cannot sync. */
  | 'unavailable';

export function protection(s: StorageState): Protection {
  if (!s.configured) return 'unavailable';
  if (s.mode === 'cloud') return s.signedIn ? 'synced' : 'cloud-pending';
  return 'local-only';
}

/** Data is uploaded only when a cloud account is both chosen and signed in. */
export const syncAllowed = (s: StorageState): boolean => s.configured && s.mode === 'cloud' && s.signedIn;

/** Ask which to use, once, on first run. Not asked at all when there is nothing to choose between. */
export const needsChoice = (s: StorageState): boolean => s.configured && s.mode === null;

/** Whether the data is exposed to loss (anything but synced). */
export const atRisk = (s: StorageState): boolean => protection(s) !== 'synced';

const LOSS = "clearing your browser's site data, uninstalling the app, or losing or resetting your phone can delete it for good";

/** What to tell the person about their data, in plain words. */
export const MESSAGE: Record<Protection, { short: string; long: string }> = {
  synced: {
    short: 'Backed up to your account and kept in step across your devices.',
    long: 'Your data is stored on your account as well as on this device, so it survives losing or resetting a device.',
  },
  'local-only': {
    short: 'Saved on this device only. Not guaranteed to be kept.',
    long: `Your data is saved only on this device, and there is no guarantee it will be kept: ${LOSS}, and it cannot be recovered. Choose a cloud account to keep a safe copy.`,
  },
  'cloud-pending': {
    short: 'Not signed in yet, so your data is on this device only and not guaranteed to be kept.',
    long: `You chose a cloud account but have not signed in, so for now your data is only on this device and is not guaranteed to be kept: ${LOSS}. Sign in to back it up.`,
  },
  unavailable: {
    short: 'Saved on this device only. Not guaranteed to be kept.',
    long: `Cloud accounts are not set up in this build, so your data is saved only on this device and is not guaranteed to be kept: ${LOSS}, and it cannot be recovered.`,
  },
};
