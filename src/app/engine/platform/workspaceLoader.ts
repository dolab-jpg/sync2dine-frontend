/** Authenticated shell waits on profile/org restore before choosing sales vs restaurant. */
export function shouldShowWorkspaceLoader(isLoggedIn: boolean, experienceReady: boolean): boolean {
  return isLoggedIn && !experienceReady;
}
