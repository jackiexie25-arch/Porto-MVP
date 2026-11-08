import type { ReactNode } from 'react';
import { copy } from '../../copy/en-AU';
import { AppShell } from '../layout/AppShell';

const links = [
  { to: '/cues', label: copy.familyNav.cues },
  { to: '/card', label: copy.familyNav.card },
  { to: '/setup', label: copy.familyNav.setup },
  { to: '/signout', label: copy.familyNav.signOut },
] as const;

/** The signed-in family layout. Sharing (Phase 4) and the inbox (Phase 5) add their links. */
export function FamilyShell({ children }: { children: ReactNode }) {
  return <AppShell links={links}>{children}</AppShell>;
}
