import { useEffect, useId, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { copy } from '../../copy/en-AU';
import { ButtonLink } from './Button';
import { CloseIcon, MenuIcon } from './Icons';
import { Wordmark } from './Logo';
import styles from './Nav.module.css';

export interface NavItem {
  to: string;
  label: string;
  /** A small count beside the label, such as new notes. Never shown when zero. */
  badge?: number;
  /** Read after the count by screen readers only, such as "new" ("Inbox 1 new"). */
  badgeSuffix?: string;
}

/**
 * The count is real text, so the spoken name ("Inbox 1 new") starts with exactly what's on
 * screen ("Inbox 1"), and voice-control users can say what they see.
 */
function Badge({ count, suffix }: { count: number; suffix?: string }) {
  return (
    <>
      <span className={styles.badge}>{count}</span>
      {suffix ? <span className="visually-hidden"> {suffix}</span> : null}
    </>
  );
}

interface NavProps {
  links?: readonly NavItem[];
  primary?: NavItem;
  homeTo?: string;
}

/** Logo left, links in ink-soft, one primary button right. Collapses to logo + menu on phones. */
export function Nav({ links = [], primary, homeTo = '/' }: NavProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const hasMenu = links.length > 0 || primary;
  const badgeTotal = links.reduce((sum, l) => sum + (l.badge ?? 0), 0);

  return (
    <header className={styles.header}>
      <nav aria-label={copy.layout.mainNav} className={styles.nav}>
        <Link to={homeTo} className={styles.logoLink} aria-label={copy.layout.homeLink}>
          <Wordmark width={96} decorative />
        </Link>

        {hasMenu ? (
          <>
            <button
              type="button"
              className={styles.menuButton}
              aria-expanded={open}
              aria-controls={menuId}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <CloseIcon /> : <MenuIcon />}
              <span>{open ? copy.layout.menuClose : copy.layout.menuOpen}</span>
              {!open && badgeTotal ? <Badge count={badgeTotal} suffix={copy.layout.menuBadge} /> : null}
            </button>

            <div id={menuId} className={[styles.menu, open ? styles.menuOpen : ''].join(' ')}>
              <ul className={styles.links}>
                {links.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => [styles.link, isActive ? styles.active : ''].join(' ')}
                    >
                      {item.label}
                      {item.badge ? <Badge count={item.badge} suffix={item.badgeSuffix} /> : null}
                    </NavLink>
                  </li>
                ))}
              </ul>
              {primary ? (
                <ButtonLink to={primary.to} className={styles.primary}>
                  {primary.label}
                </ButtonLink>
              ) : null}
            </div>
          </>
        ) : null}
      </nav>
    </header>
  );
}
