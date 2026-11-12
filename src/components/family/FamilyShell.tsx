import type { ReactNode } from 'react';
import { copy } from '../../copy/en-AU';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { AppShell } from '../layout/AppShell';

const primary = { to: '/share', label: copy.familyNav.share };

/**
 * The signed-in family layout, with "Share for a shift" always in reach in the nav. Wide pages (the
 * cue library and editor) use two columns on desktop, lined up with the nav.
 */
export function FamilyShell({
  children,
  hideShare = false,
  width = 'narrow',
}: {
  children: ReactNode;
  hideShare?: boolean;
  width?: 'narrow' | 'wide';
}) {
  const { pendingNotes } = useFamilyData();
  const links = [
    { to: '/cues', label: copy.familyNav.cues },
    { to: '/card', label: copy.familyNav.card },
    { to: '/inbox', label: copy.familyNav.inbox, badge: pendingNotes, badgeSuffix: copy.inbox.navBadge },
    { to: '/account', label: copy.familyNav.account },
  ];
  return (
    <AppShell links={links} primary={hideShare ? undefined : primary} width={width}>
      {children}
    </AppShell>
  );
}
