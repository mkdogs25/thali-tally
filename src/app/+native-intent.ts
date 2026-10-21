/**
 * Strava redirects back to `thalitally://localhost/strava` after sign-in. The in-app browser session
 * reads that URL itself, so the router must not treat it as a screen to navigate to.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  if (path.includes('localhost/strava') || path.endsWith('/strava')) return null;
  return path;
}
