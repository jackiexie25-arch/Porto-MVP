import type { ReactNode } from 'react';
import { copy } from '../../copy/en-AU';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { AppShell } from '../layout/AppShell';

const primary = { to: '/share', label: copy.familyNav.share };

/** The signed-in family layout, with "Share for a shift" as the one primary action. */
export function FamilyShell({ children, hideShare = false }: { children: ReactNode; hideShare?: boolean }) {
  const { pendingNotes } = useFamilyData();
  const links = [
    { to: '/cues', label: copy.familyNav.cues },
    { to: '/card', label: copy.familyNav.card },
    { to: '/inbox', label: copy.familyNav.inbox, badge: pendingNotes, ariaLabel: copy.inbox.navLabel(pendingNotes) },
    { to: '/account', label: copy.familyNav.account },
  ];
  return (
    <AppShell links={links} primary={hideShare ? undefined : primary}>
      {children}
    </AppShell>
  );
}
