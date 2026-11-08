import type { ReactNode } from 'react';
import { copy } from '../../copy/en-AU';
import { Nav, type NavItem } from '../ui';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
  links?: readonly NavItem[];
  primary?: NavItem;
  width?: 'narrow' | 'wide';
}

/** Skip link, nav and a main landmark with the standard 16px phone gutter. */
export function AppShell({ children, links, primary, width = 'narrow' }: AppShellProps) {
  return (
    <>
      <a className="skip-link" href="#main">
        {copy.layout.skipLink}
      </a>
      <Nav links={links} primary={primary} />
      <main id="main" tabIndex={-1} className={[styles.main, styles[width]].join(' ')}>
        {children}
      </main>
    </>
  );
}
