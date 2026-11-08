import logoUrl from '../../assets/brand/porto-logo.svg';
import markUrl from '../../assets/brand/porto-mark.svg';
import { copy } from '../../copy/en-AU';

const WORDMARK_MIN = 88;
const MARK_MIN = 20;
const WORDMARK_RATIO = 2020 / 5620;

/**
 * The logo is always the supplied SVG, never rebuilt in a font, recoloured or shadowed.
 * Place the wordmark on ground or surface only, never on apricot.
 */
export function Wordmark({ width = 112, decorative = false }: { width?: number; decorative?: boolean }) {
  const w = Math.max(width, WORDMARK_MIN);
  return (
    <img
      src={logoUrl}
      width={w}
      height={Math.round(w * WORDMARK_RATIO)}
      alt={decorative ? '' : copy.layout.logoAlt}
    />
  );
}

export function Mark({ size = 32, decorative = false }: { size?: number; decorative?: boolean }) {
  const s = Math.max(size, MARK_MIN);
  return <img src={markUrl} width={s} height={s} alt={decorative ? '' : copy.layout.logoAlt} />;
}
