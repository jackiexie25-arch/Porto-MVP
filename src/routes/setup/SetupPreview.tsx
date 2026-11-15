import { useEffect, useRef } from 'react';
import { FirstShiftCard, type CardPart } from '../../components/card/FirstShiftCard';
import type { CardModel } from '../../lib/card';
import styles from './Setup.module.css';

/**
 * The whole card as a worker will read it, with what's typed so far. The part being written is
 * marked with the ink rule and shows even while empty, so the family sees where their words go.
 */
export function SetupPreview({ model, parts, follow = false }: { model: CardModel; parts: readonly CardPart[]; follow?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = parts[0];

  // In the desktop column, keep the part being written in view as the card grows.
  useEffect(() => {
    if (!follow) return;
    const column = ref.current?.parentElement;
    const target = ref.current?.querySelector<HTMLElement>(`[data-part="${first}"]`);
    if (!column || !target) return;
    const top = target.offsetTop - column.offsetTop;
    if (top < column.scrollTop || top + target.offsetHeight > column.scrollTop + column.clientHeight) {
      column.scrollTop = Math.max(0, top - 64);
    }
  }, [follow, first, model]);

  return (
    <div ref={ref} className={styles.previewCard}>
      <FirstShiftCard model={model} variant="preview" current={parts} headingLevel={3} showEmergency={false} />
    </div>
  );
}
