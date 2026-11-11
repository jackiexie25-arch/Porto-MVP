import { useEffect, useLayoutEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** The last location a page heading has handled, so each new page moves focus once. */
let handledKey: string | null = null;

/**
 * On a new page, start at the top. Back and forward are left alone so the browser can restore
 * where the person was, and links to an anchor (#section) scroll to it as usual.
 */
export function RouteScroll() {
  const { key, hash } = useLocation();
  const type = useNavigationType();
  useLayoutEffect(() => {
    if (type !== 'POP' && !hash) window.scrollTo(0, 0);
  }, [key, type, hash]);
  return null;
}

type PageHeadingProps = ComponentPropsWithoutRef<'h1'> & {
  /** Take focus when the heading first appears, even without a route change (a done state). */
  focusOnMount?: boolean;
};

/**
 * A page's h1. After a route change (not back or forward), focus moves here so screen reader and
 * keyboard users start at the new page's heading. If the page is still loading, focus moves when
 * the heading appears. The first page load leaves focus where the browser puts it.
 */
export function PageHeading({ focusOnMount = false, ...rest }: PageHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { key, hash } = useLocation();
  const type = useNavigationType();

  useEffect(() => {
    if (handledKey === key) return;
    handledKey = key;
    if (focusOnMount || (type !== 'POP' && !hash)) ref.current?.focus({ preventScroll: true });
  }, [key, type, hash, focusOnMount]);

  return <h1 ref={ref} tabIndex={-1} {...rest} />;
}
