export interface FamilyStatus {
  signedIn: boolean;
  consented: boolean;
  profileId: string | null;
}

export type FamilyStep = '/signin' | '/consent' | '/start' | '/home';

/** Where a family should be, given how far through sign-up they are. */
export function nextFamilyStep(status: FamilyStatus): FamilyStep {
  if (!status.signedIn) return '/signin';
  if (!status.consented) return '/consent';
  if (!status.profileId) return '/start';
  return '/home';
}

export type FamilyNeed = 'session' | 'consent' | 'profile';

/** True when the family has reached the stage a page needs. */
export function meetsNeed(status: FamilyStatus, need: FamilyNeed): boolean {
  if (!status.signedIn) return false;
  if (need === 'session') return true;
  if (!status.consented) return false;
  if (need === 'consent') return true;
  return status.profileId !== null;
}
