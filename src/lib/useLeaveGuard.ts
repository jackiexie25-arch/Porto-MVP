import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * While `active` (something typed isn't saved), asks before leaving: a link to another page in the
 * app is held until the person chooses, and closing or reloading the tab gets the browser's own
 * question. The app uses a plain BrowserRouter, so the browser's Back button isn't caught.
 */
export function useLeaveGuard(active: boolean) {
  const [pending, setPending] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!active) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Older browsers need a value set to show their question.
      event.returnValue = '';
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Links within this page (the skip link) aren't leaving.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(url.pathname + url.search + url.hash);
    }

    window.addEventListener('beforeunload', onBeforeUnload);
    // Capture, so the app's own link handling never sees a held click.
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active]);

  return {
    /** Where the person was going, while the question is open. */
    pending,
    stay: () => setPending(null),
    leave: () => {
      const to = pending;
      setPending(null);
      if (to) navigate(to);
    },
  };
}
