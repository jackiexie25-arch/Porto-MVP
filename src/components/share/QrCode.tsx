import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import styles from './QrCode.module.css';

const QUIET_ZONE = 4;

/** Path data for every dark module, so the code is one small SVG path. */
export function qrPath(text: string): { size: number; d: string } {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) d += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return { size: count + QUIET_ZONE * 2, d };
}

/** Made in the browser: the link never goes to a QR service. Ink on white for reliable scanning. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { size, d } = useMemo(() => qrPath(value), [value]);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      className={styles.qr}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} className={styles.background} />
      <path d={d} className={styles.modules} />
    </svg>
  );
}
