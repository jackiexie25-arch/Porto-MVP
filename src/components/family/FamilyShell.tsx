import type { ReactNode } from 'react';
import { copy } from '../../copy/en-AU';
import { AppShell } from '../layout/AppShell';

const links = [
  { to: '/card', label: copy.familyNav.card },
  { to: '/setup', label: copy.familyNav.setup },
  { to: '/signout', label: copy.familyNav.signOut },
] as const;

/** The signed-in family layout. More links arrive with cues (Phase 3), sharing (4) and the inbox (5). */
export function FamilyShell({ children }: { children: ReactNode }) {
  return <AppShell links={links}>{children}</AppShell>;
}
