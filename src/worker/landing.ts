/** Space left between the pinned search and the answer, and the least of the answer that must show. */
export const LANDING_GAP = 16;
const MIN_VISIBLE = 160;

/**
 * On a wide screen the search stays pinned while the card scrolls. When an answer arrives out of
 * sight, this is how far to scroll so it lands just under the pinned search, or null when enough of
 * it is already in view. Moving only that far keeps the page where it was as much as possible.
 */
export function landingDelta(answerTop: number, pinnedBottom: number, viewportHeight: number): number | null {
  const target = pinnedBottom + LANDING_GAP;
  const inView = answerTop >= target - 1 && answerTop <= viewportHeight - MIN_VISIBLE;
  return inView ? null : Math.round(answerTop - target);
}
