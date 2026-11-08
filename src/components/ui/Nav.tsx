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
