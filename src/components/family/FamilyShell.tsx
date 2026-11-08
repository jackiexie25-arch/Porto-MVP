import type { ReactNode } from 'react';
import { copy } from '../../copy/en-AU';
import { AppShell } from '../layout/AppShell';

const links = [
  { to: '/cues', label: copy.familyNav.cues },
  { to: '/card', label: copy.familyNav.card },
  { to: '/setup', label: copy.familyNav.setup },
  { to: '/signout', label: copy.familyNav.signOut },
] as const;

const primary = { to: '/share', label: copy.familyNav.share };

/** The signed-in family layout, with "Share for a shift" as the one primary action. The inbox (Phase 5) adds a link. */
export function FamilyShell({ children, hideShare = false }: { children: ReactNode; hideShare?: boolean }) {
  return (
    <AppShell links={links} primary={hideShare ? undefined : primary}>
      {children}
    </AppShell>
  );
}
