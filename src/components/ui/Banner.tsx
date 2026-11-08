import type { ReactNode } from 'react';
import { copy } from '../../copy/en-AU';
import { AlertIcon, CheckIcon, InfoIcon } from './Icons';
import styles from './Banner.module.css';

export type BannerTone = 'success' | 'error' | 'info';

const icons = { success: CheckIcon, error: AlertIcon, info: InfoIcon } as const;
const iconLabels = {
  success: copy.common.successIconLabel,
  error: copy.common.errorIconLabel,
  info: copy.common.infoIconLabel,
} as const;

/**
 * Calm messages. Errors have no colour: ink text, ink border and a "!" icon.
 * All tones use a polite live region so nothing interrupts. Banners never auto-dismiss.
 */
export function Banner({ tone, children }: { tone: BannerTone; children: ReactNode }) {
  const Icon = icons[tone];
  return (
    <div role="status" className={[styles.banner, styles[tone]].join(' ')}>
      <Icon size={20} className={styles.icon} />
      <span className="visually-hidden">{iconLabels[tone]}: </span>
      <div className={styles.text}>{children}</div>
    </div>
  );
}
