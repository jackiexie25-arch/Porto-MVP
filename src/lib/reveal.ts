import { useEffect, useRef } from 'react';

/**
 * Moves focus to something that needs attention (a field with an error, or an error message) and
 * scrolls it to the middle of the screen, so it isn't hidden under the top of the page or the keyboard.
 */
export function reveal(el: HTMLElement | null | undefined) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: 'center' });
}

/** A ref for an error message: whenever `message` is set (or changes), it's revealed. */
export function useRevealOn<T extends HTMLElement>(message: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (message) reveal(ref.current);
  }, [message]);
  return ref;
}
