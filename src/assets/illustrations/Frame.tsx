import type { ReactNode } from 'react';
import s from './illustration.module.css';

export interface IllustrationProps {
  /** Text alternative. Leave out when nearby text already says the same thing. */
  label?: string;
  className?: string;
}

const LEAF = 'M0 0C5 -7 15 -8 22 0C15 7 5 7 0 0Z';

export interface LeafSpec {
  x: number;
  y: number;
  rotate: number;
  tone: 'blob' | 'sky';
}

/** Every scene sits on a soft surface blob over ground, with a few small leaves nearby. */
export function Frame({
  label,
  className,
  blob,
  leaves,
  children,
}: IllustrationProps & { blob: string; leaves: readonly LeafSpec[]; children: ReactNode }) {
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };
  return (
    <svg viewBox="0 0 320 240" className={[s.svg, className ?? ''].join(' ')} focusable="false" {...a11y}>
      <path className={s.blob} d={blob} />
      {leaves.map((leaf) => (
        <path
          key={`${leaf.x}-${leaf.y}`}
          className={leaf.tone === 'sky' ? s.leafSky : s.leafBlob}
          d={LEAF}
          transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.rotate})`}
        />
      ))}
      {children}
    </svg>
  );
}
