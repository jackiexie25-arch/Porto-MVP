import { useEffect, useRef } from 'react';
import { FirstShiftCard, type CardPart } from '../../components/card/FirstShiftCard';
import { copy } from '../../copy/en-AU';
import type { CardModel } from '../../lib/card';
import styles from './Setup.module.css';

/**
 * The whole card as a worker will read it, with what's typed so far. The part being written is
 * marked with the ink rule and shows even while empty, so the family sees where their words go.
 * In the desktop column (`follow`) the card is its own framed, scrolling sheet that keeps the
 * marked part in view.
 */
export function SetupPreview({ model, parts, follow = false }: { model: CardModel; parts: readonly CardPart[]; follow?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = parts[0];

  useEffect(() => {
    if (!follow) return;
    const frame = ref.current;
    const target = frame?.querySelector<HTMLElement>(`[data-part="${first}"]`);
    if (!frame || !target) return;
    const top = target.getBoundingClientRect().top - frame.getBoundingClientRect().top + frame.scrollTop;
    // Only moves when the marked part has slipped out of view, so the card never jumps while read.
    if (top < frame.scrollTop || top + Math.min(target.offsetHeight, frame.clientHeight) > frame.scrollTop + frame.clientHeight) {
      frame.scrollTop = Math.max(0, top - 24);
    }
  }, [follow, first, model]);

  return (
    <div
      ref={ref}
      className={follow ? styles.previewFrame : styles.previewCard}
      // The desktop frame scrolls on its own, so it can take focus for keyboard scrolling.
      tabIndex={follow ? 0 : undefined}
      role={follow ? 'region' : undefined}
      aria-label={follow ? copy.setup.preview.frameLabel : undefined}
    >
      <FirstShiftCard model={model} variant="preview" current={parts} headingLevel={3} showEmergency={false} />
    </div>
  );
}
